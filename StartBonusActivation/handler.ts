import { Context } from "@azure/functions";
import { isBefore } from "date-fns";
import { QueryError } from "documentdb";
import * as df from "durable-functions";
import { DurableOrchestrationClient } from "durable-functions/lib/src/durableorchestrationclient";
import * as express from "express";
import { Either, left, right, toError } from "fp-ts/lib/Either";
import {
  fromEither,
  TaskEither,
  taskEither,
  tryCatch
} from "fp-ts/lib/TaskEither";
import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorConflict,
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorGone,
  IResponseErrorInternal,
  IResponseSuccessAccepted,
  IResponseSuccessRedirectToResource,
  ResponseErrorConflict,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorGone,
  ResponseErrorInternal,
  ResponseSuccessAccepted,
  ResponseSuccessRedirectToResource
} from "italia-ts-commons/lib/responses";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import {
  MaxRetries,
  RetriableTask,
  RetryAborted,
  TransientError,
  withRetries
} from "italia-ts-commons/lib/tasks";
import { BonusActivation } from "../generated/models/BonusActivation";
import { BonusActivationStatusEnum } from "../generated/models/BonusActivationStatus";
import { BonusCode } from "../generated/models/BonusCode";
import { Dsu } from "../generated/models/Dsu";
import { EligibilityCheckSuccessEligible } from "../generated/models/EligibilityCheckSuccessEligible";
import {
  BonusActivationModel,
  NewBonusActivation,
  RetrievedBonusActivation
} from "../models/bonus_activation";
import { EligibilityCheckModel } from "../models/eligibility_check";
import { genRandomBonusCode } from "../utils/bonusCode";
import {
  makeStartBonusActivationOrchestratorId,
  makeStartEligibilityCheckOrchestratorId
} from "../utils/orchestrators";

import { Millisecond } from "italia-ts-commons/lib/units";
import { FamilyMembers } from "../generated/models/FamilyMembers";
import { BonusLeaseModel, RetrievedBonusLease } from "../models/bonus_lease";
import { generateFamilyUID } from "../utils/hash";

const checkOrchestratorIsRunning = (
  client: DurableOrchestrationClient,
  orchestratorId: string
): TaskEither<Error, boolean> =>
  tryCatch(() => client.getStatus(orchestratorId), toError).map(
    status => status.runtimeStatus === df.OrchestrationRuntimeStatus.Running
  );

const makeBonusActivationResourceUri = (
  fiscalcode: FiscalCode,
  bonusId: string
) => `/bonus/vacanze/activations/${fiscalcode}/${bonusId}`;

/**
 * Converts a Promise<Either> into a TaskEither
 * This is needed because our models return unconvenient type. Both left and rejection cases are handled as a TaskEither left
 * @param lazyPromise a lazy promise to convert
 *
 * @returns either the query result or a query failure
 */
const fromQueryEither = <R>(
  lazyPromise: () => Promise<Either<QueryError | Error, R>>
): TaskEither<Error, R> =>
  tryCatch(lazyPromise, toError).chain(errorOrResult =>
    fromEither(errorOrResult).mapLeft(toError)
  );

/**
 * Converts a Promise<Either> into a RetriableTask
 * This is needed because our models return unconvenient type. Both left and rejection cases are handled as a TaskEither left
 * @param lazyPromise a lazy promise to convert
 * @param shouldRetry a function that define which kind of query error must be treated as retrieable
 *
 * @returns either the query result or a query failure
 */
const fromQueryEitherToRetriableTask = <R>(
  lazyPromise: () => Promise<Either<QueryError | Error, R>>,
  shouldRetry: (q: QueryError) => boolean
): RetriableTask<Error, R> => {
  return tryCatch(lazyPromise, _ => _ as QueryError | Error)
    .foldTaskEither<Error | QueryError, R>(
      _ => fromEither(left(_)),
      _ => fromEither(_)
    )
    .mapLeft(errorOrQueryError => {
      return errorOrQueryError instanceof Error
        ? errorOrQueryError
        : shouldRetry(errorOrQueryError)
        ? TransientError
        : toError(errorOrQueryError);
    });
};

/**
 * Check if the current user has a pending activation request.
 * If there's no pending requests right(false) is returned
 * @param client
 * @param fiscalCode
 *
 * @returns either false or a custom response indicating whether there's a process running or there has been an internal error during the check
 */
const checkBonusActivationIsRunning = (
  client: DurableOrchestrationClient,
  fiscalCode: FiscalCode
): TaskEither<IResponseErrorInternal | IResponseSuccessAccepted, false> =>
  checkOrchestratorIsRunning(
    client,
    makeStartBonusActivationOrchestratorId(fiscalCode)
  ).foldTaskEither<IResponseErrorInternal | IResponseSuccessAccepted, false>(
    err =>
      fromEither(
        left(
          ResponseErrorInternal(
            `Error checking BonusActivationOrchestrator: ${err.message}`
          )
        )
      ),
    isRunning =>
      isRunning
        ? fromEither(left(ResponseSuccessAccepted()))
        : fromEither(right(false))
  );

/**
 * Check if the current user has a pending dsu validation request.
 * If there's no pending requests right(false) is returned
 * @param client
 * @param fiscalCode
 *
 * @returns either false or a custom response indicating whether there's a process running or there has been an internal error during the check
 */
const checkEligibilityCheckIsRunning = (
  client: DurableOrchestrationClient,
  fiscalCode: FiscalCode
): TaskEither<
  IResponseErrorInternal | IResponseErrorForbiddenNotAuthorized,
  false
> =>
  checkOrchestratorIsRunning(
    client,
    makeStartEligibilityCheckOrchestratorId(fiscalCode)
  ).foldTaskEither<
    IResponseErrorInternal | IResponseErrorForbiddenNotAuthorized,
    false
  >(
    err =>
      fromEither(
        left(
          ResponseErrorInternal(
            `Error checking EligibilityCheckOrchestrator: ${err.message}`
          )
        )
      ),
    isRunning =>
      isRunning
        ? fromEither(left(ResponseErrorForbiddenNotAuthorized))
        : fromEither(right(false))
  );

/**
 * Query for a valid DSU relative to the current user.
 * @param eligibilityCheckModel the model instance for EligibilityCheck
 * @param fiscalCode the id of the current user
 *
 * @returns either a valid DSU or a response relative to the state of the DSU
 */
const getLatestValidDSU = (
  eligibilityCheckModel: EligibilityCheckModel,
  fiscalCode: FiscalCode
): TaskEither<
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorGone
  | IResponseErrorInternal,
  Dsu
> =>
  fromQueryEither(() =>
    eligibilityCheckModel.find(fiscalCode, fiscalCode)
  ).foldTaskEither(
    err =>
      fromEither(
        left(ResponseErrorInternal(`Error reading DSU: ${err.message}`))
      ),
    maybeDoc => {
      return maybeDoc.fold<
        TaskEither<
          | IResponseErrorForbiddenNotAuthorized
          | IResponseErrorGone
          | IResponseErrorInternal,
          Dsu
        >
      >(fromEither(left(ResponseErrorForbiddenNotAuthorized)), doc =>
        // the found document is not in eligible status
        !EligibilityCheckSuccessEligible.is(doc)
          ? fromEither(left(ResponseErrorForbiddenNotAuthorized))
          : // the check is expired
          isBefore(doc.validBefore, new Date())
          ? fromEither(left(ResponseErrorGone(`DSU expired`)))
          : // the check is fine, I can extract the DSU data from it
            fromEither(right(doc.dsuRequest))
      );
    }
  );

/**
 * Create a new BonusActivation request record
 * @param bonusActivationModel an instance of BonusActivationModel
 * @param fiscalCode the id of the requesting user
 * @param dsu the valid DSU of the current user
 *
 * @returns either the created record or
 */
const createBonusActivation = (
  bonusActivationModel: BonusActivationModel,
  fiscalCode: FiscalCode,
  dsu: Dsu,
  maxAttempts: number = 5
): TaskEither<IResponseErrorInternal, BonusActivation> => {
  const shouldRetry = (err: QueryError) => {
    // CosmosDB conflict: primary key violation
    return err.code === 409;
  };

  const retriableBonusActivationTask = tryCatch(
    genRandomBonusCode,
    toError
  ).foldTaskEither<Error | TransientError, RetrievedBonusActivation>(
    _ => fromEither(left(_)),
    (bonusCode: BonusCode) =>
      fromQueryEitherToRetriableTask(() => {
        const bonusActivation: NewBonusActivation = {
          applicantFiscalCode: fiscalCode,
          createdAt: new Date(),
          dsuRequest: dsu,
          familyUID: generateFamilyUID(dsu.familyMembers),
          id: bonusCode as BonusCode & NonEmptyString,
          kind: "INewBonusActivation",
          status: BonusActivationStatusEnum.PROCESSING
        };
        return bonusActivationModel.create(bonusActivation, fiscalCode);
      }, shouldRetry)
  );

  return withRetries<Error, RetrievedBonusActivation>(
    maxAttempts,
    () => 50 as Millisecond
  )(retriableBonusActivationTask).mapLeft(errorOrMaxRetry =>
    errorOrMaxRetry === MaxRetries || errorOrMaxRetry === RetryAborted
      ? ResponseErrorInternal(
          `Error creating BonusActivation: cannot create a db record after ${maxAttempts} attemps`
        )
      : ResponseErrorInternal(
          `Error creating BonusActivation: ${errorOrMaxRetry.message}`
        )
  );
};

const acquireLockForUserFamily = (
  bonusLeaseModel: BonusLeaseModel,
  familyMembers: FamilyMembers
): TaskEither<IResponseErrorConflict, RetrievedBonusLease> => {
  const familyUID = generateFamilyUID(familyMembers) as NonEmptyString;
  return fromQueryEither(() =>
    bonusLeaseModel.create(
      {
        id: familyUID,
        kind: "INewBonusLease"
      },
      familyUID
    )
  ).mapLeft(err =>
    // consider any error a failure for lease already present
    ResponseErrorConflict(
      `Failed while acquiring lease for familiUID ${familyUID}: ${err.message}`
    )
  );
};

type StartBonusActivationResponse =
  | IResponseErrorInternal
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorGone
  | IResponseErrorConflict
  | IResponseSuccessAccepted
  | IResponseSuccessRedirectToResource<BonusActivation, BonusActivation>;

type IStartBonusActivationHandler = (
  context: Context,
  fiscalCode: FiscalCode
) => Promise<StartBonusActivationResponse>;

export function StartBonusActivationHandler(
  bonusActivationModel: BonusActivationModel,
  bonusLeaseModel: BonusLeaseModel,
  eligibilityCheckModel: EligibilityCheckModel
): IStartBonusActivationHandler {
  return async (context, fiscalCode) => {
    const client = df.getClient(context);

    return taskEither
      .of<StartBonusActivationResponse, void>(void 0)
      .chain(_ => checkEligibilityCheckIsRunning(client, fiscalCode))
      .chain(_ => checkBonusActivationIsRunning(client, fiscalCode))
      .chain(_ => getLatestValidDSU(eligibilityCheckModel, fiscalCode))
      .chain((dsu: Dsu) =>
        acquireLockForUserFamily(bonusLeaseModel, dsu.familyMembers).map(
          _ => dsu
        )
      )
      .chain((dsu: Dsu) =>
        createBonusActivation(bonusActivationModel, fiscalCode, dsu)
      )
      .chain(_ => {
        // TODO: call orchestrator
        return taskEither.of(_);
      })
      .fold(
        l => l,
        bonusActivation =>
          ResponseSuccessRedirectToResource(
            bonusActivation,
            makeBonusActivationResourceUri(fiscalCode, bonusActivation.id),
            bonusActivation
          )
      )
      .run();
  };
}

export function StartBonusActivation(
  bonusActivationModel: BonusActivationModel,
  bonusLeaseModel: BonusLeaseModel,
  eligibilityCheckModel: EligibilityCheckModel
): express.RequestHandler {
  const handler = StartBonusActivationHandler(
    bonusActivationModel,
    bonusLeaseModel,
    eligibilityCheckModel
  );

  const middlewaresWrap = withRequestMiddlewares(
    // Extract Azure Functions bindings
    ContextMiddleware(),
    FiscalCodeMiddleware
  );

  return wrapRequestHandler(middlewaresWrap(handler));
}
