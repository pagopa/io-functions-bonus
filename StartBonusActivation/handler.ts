import { Context } from "@azure/functions";
import { isBefore } from "date-fns";
import { QueryError } from "documentdb";
import * as df from "durable-functions";
import { DurableOrchestrationClient } from "durable-functions/lib/src/durableorchestrationclient";
import * as express from "express";
import { sequenceT } from "fp-ts/lib/Apply";
import { Either, left, right, toError } from "fp-ts/lib/Either";
import {
  fromEither,
  TaskEither,
  taskEither,
  taskEitherSeq,
  tryCatch
} from "fp-ts/lib/TaskEither";
import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorGone,
  IResponseErrorInternal,
  IResponseSuccessAccepted,
  IResponseSuccessRedirectToResource,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorGone,
  ResponseErrorInternal,
  ResponseSuccessAccepted,
  ResponseSuccessRedirectToResource
} from "italia-ts-commons/lib/responses";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { BonusActivation } from "../generated/models/BonusActivation";
import { BonusActivationStatusEnum } from "../generated/models/BonusActivationStatus";
import { BonusCode } from "../generated/models/BonusCode";
import { Dsu } from "../generated/models/Dsu";
import { EligibilityCheckSuccessEligible } from "../generated/models/EligibilityCheckSuccessEligible";
import {
  BonusActivationModel,
  NewBonusActivation
} from "../models/bonus_activation";
import { EligibilityCheckModel } from "../models/eligibility_check";
import { genRandomBonusCode } from "../utils/bonusCode";
import {
  makeStartBonusActivationOrchestratorId,
  makeStartEligibilityCheckOrchestratorId
} from "../utils/orchestrators";
import { repeatUntil } from "../utils/repeatUntil";

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
 * @param queryName an optional name for the query, for logging purpose
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
 * Generate a random bonus code. The operation may fail, so it has a retry mechanism
 *
 * @returns either a bonus code or a failure response
 */
const tryGenerateBonusCode = () =>
  repeatUntil(() => tryCatch(genRandomBonusCode, toError));

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
  dsu: Dsu
): TaskEither<IResponseErrorInternal, BonusActivation> => {
  const shouldRepeat = (l: QueryError | Error) => {
    // TODO: fix this condition
    return !(l instanceof Error) && !!l.code && l.code === 409;
  };

  const lazyQueryTask = () =>
    tryGenerateBonusCode().chain(bonusCode =>
      fromQueryEither(() => {
        const bonusActivation: NewBonusActivation = {
          applicantFiscalCode: fiscalCode,
          createdAt: new Date(),
          dsuRequest: dsu,
          id: bonusCode as BonusCode & NonEmptyString,
          kind: "INewBonusActivation",
          status: BonusActivationStatusEnum.PROCESSING
        };
        return bonusActivationModel.create(bonusActivation, fiscalCode);
      })
    );

  return repeatUntil(lazyQueryTask, shouldRepeat).mapLeft(err =>
    ResponseErrorInternal(`Error creating BonusActivation: ${err.message}`)
  );
};

type StartBonusActivationResponse =
  | IResponseErrorInternal
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorGone
  | IResponseSuccessAccepted
  | IResponseSuccessRedirectToResource<BonusActivation, BonusActivation>;

type IStartBonusActivationHandler = (
  context: Context,
  fiscalCode: FiscalCode
) => Promise<StartBonusActivationResponse>;

export function StartBonusActivationHandler(
  bonusActivationModel: BonusActivationModel,
  eligibilityCheckModel: EligibilityCheckModel
): IStartBonusActivationHandler {
  return async (context, fiscalCode) => {
    const client = df.getClient(context);

    return sequenceT(taskEitherSeq)(
      checkEligibilityCheckIsRunning(client, fiscalCode) as TaskEither<
        StartBonusActivationResponse,
        false
      >,
      checkBonusActivationIsRunning(client, fiscalCode) as TaskEither<
        StartBonusActivationResponse,
        false
      >,
      getLatestValidDSU(eligibilityCheckModel, fiscalCode) as TaskEither<
        StartBonusActivationResponse,
        Dsu
      >
    )

      .chain(_ => {
        // TODO: lock for familiuid
        return taskEither.of(_);
      })
      .chain(([, , dsu]) =>
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
  eligibilityCheckModel: EligibilityCheckModel
): express.RequestHandler {
  const handler = StartBonusActivationHandler(
    bonusActivationModel,
    eligibilityCheckModel
  );

  const middlewaresWrap = withRequestMiddlewares(
    // Extract Azure Functions bindings
    ContextMiddleware(),
    FiscalCodeMiddleware
  );

  return wrapRequestHandler(middlewaresWrap(handler));
}
