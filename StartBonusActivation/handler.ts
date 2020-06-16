import { Context } from "@azure/functions";
import { isBefore } from "date-fns";
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

import { readableReport } from "italia-ts-commons/lib/reporters";
import { Millisecond } from "italia-ts-commons/lib/units";
import { BonusActivation as ApiBonusActivation } from "../generated/definitions/BonusActivation";
import { BonusActivationWithFamilyUID } from "../generated/models/BonusActivationWithFamilyUID";
import { FamilyUID } from "../generated/models/FamilyUID";
import { BonusLeaseModel } from "../models/bonus_lease";
import { OrchestratorInput } from "../StartBonusActivationOrchestrator/handler";
import { toApiBonusActivation } from "../utils/conversions";
import { generateFamilyUID } from "../utils/hash";
import {
  fromQueryEither,
  QueryError
} from "io-functions-commons/dist/src/utils/documentdb";

export const BONUS_CREATION_MAX_ATTEMPTS = 5;

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
      fromEither(left(ResponseErrorInternal(`Error reading DSU: ${err.body}`))),
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
  familyUID: FamilyUID,
  dsu: Dsu
): TaskEither<IResponseErrorInternal, BonusActivationWithFamilyUID> => {
  const shouldRetry = (err: QueryError) => {
    // CosmosDB conflict: primary key violation
    return err.code === 409;
  };

  const retriableBonusActivationTask = tryCatch(
    genRandomBonusCode,
    toError
  ).foldTaskEither<QueryError | TransientError, RetrievedBonusActivation>(
    _ =>
      fromEither<QueryError, RetrievedBonusActivation>(left(_)).mapLeft(
        err => ({
          code: "error",
          body: err.message
        })
      ),
    (bonusCode: BonusCode) =>
      fromQueryEither(() => {
        const bonusActivation: NewBonusActivation = {
          applicantFiscalCode: fiscalCode,
          createdAt: new Date(),
          dsuRequest: dsu,
          familyUID,
          id: bonusCode as BonusCode & NonEmptyString,
          kind: "INewBonusActivation",
          status: BonusActivationStatusEnum.PROCESSING
        };
        return bonusActivationModel.create(bonusActivation, fiscalCode);
      }).mapLeft(err => (shouldRetry(err) ? TransientError : err))
  );

  return withRetries<Error, RetrievedBonusActivation>(
    BONUS_CREATION_MAX_ATTEMPTS,
    () => 50 as Millisecond
  )(retriableBonusActivationTask).mapLeft(errorOrMaxRetry =>
    errorOrMaxRetry === MaxRetries || errorOrMaxRetry === RetryAborted
      ? ResponseErrorInternal(
          `Error creating BonusActivation: cannot create a db record after ${BONUS_CREATION_MAX_ATTEMPTS} attempts`
        )
      : ResponseErrorInternal(
          `Error creating BonusActivation: ${errorOrMaxRetry.message}`
        )
  );
};

/**
 * Try to acquire a lease for the current family.
 * This is used as a lock: given that a bonus can be requested only once per family, this operation succeeeds only if no lease has been acquired (and not released) before
 *
 * @param bonusLeaseModel an instance of BonusLeaseModel
 * @param familyMembers the family of the requesting user
 *
 * @returns either a conflict error or the unique hash id of the family
 */
const acquireLockForUserFamily = (
  bonusLeaseModel: BonusLeaseModel,
  familyUID: FamilyUID
): TaskEither<IResponseErrorConflict, FamilyUID> => {
  return fromQueryEither(() =>
    bonusLeaseModel.create(
      {
        id: familyUID,
        kind: "INewBonusLease"
      },
      familyUID
    )
  ).bimap(
    err =>
      // consider any error a failure for lease already prensent
      ResponseErrorConflict(
        `Failed while acquiring lease for familyUID ${familyUID}: ${err.body}`
      ),
    _ => familyUID
  );
};

/**
 * Release the lock that was eventually acquired for this request. A release attempt on a lock that doesn't exist is considered successful.
 *
 * @param bonusLeaseModel an instance of BonusLeaseModel
 * @param familyMembers the family of the requesting user
 *
 * @returns either a conflict error or the unique hash id of the family
 */
const relaseLockForUserFamily = (
  bonusLeaseModel: BonusLeaseModel,
  familyUID: FamilyUID
): TaskEither<IResponseErrorInternal, FamilyUID> => {
  return fromQueryEither(() => bonusLeaseModel.deleteOneById(familyUID)).bimap(
    err => ResponseErrorInternal(`Error releasing lock: ${err.body}`),
    _ => familyUID
  );
};

/**
 * Start a new instance of StartBonusActivationOrchestrator
 *
 * @param client an instance of durable function client
 * @param bonusActivation a record of bonus activation
 * @param fiscalCode the fiscal code of the requesting user. Needed to make a unique id for the orchestrator instance
 *
 * @returns either an internal error or the id of the created orchestrator
 */
const runStartBonusActivationOrchestrator = (
  client: DurableOrchestrationClient,
  bonusActivation: BonusActivationWithFamilyUID,
  fiscalCode: FiscalCode
): TaskEither<IResponseErrorInternal, string> =>
  fromEither(OrchestratorInput.decode({ bonusActivation }))
    .mapLeft(err =>
      // validate input here, so we can make the http handler fail too. This shouldn't happen anyway
      ResponseErrorInternal(
        `Error validating orchestrator input: ${readableReport(err)}`
      )
    )
    .chain(orchestratorInput =>
      tryCatch(
        () =>
          client.startNew(
            "StartBonusActivationOrchestrator",
            makeStartBonusActivationOrchestratorId(fiscalCode),
            orchestratorInput
          ),
        _ =>
          ResponseErrorInternal(
            `Error starting the orchestrator: ${toError(_).message}`
          )
      )
    );

type StartBonusActivationResponse =
  | IResponseErrorInternal
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorGone
  | IResponseErrorConflict
  | IResponseSuccessAccepted
  | IResponseSuccessRedirectToResource<ApiBonusActivation, ApiBonusActivation>;

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

      .chain<BonusActivationWithFamilyUID>((dsu: Dsu) => {
        // this part is on a sub-chain as it handles the lock/unlock protection mechanism
        // familyUID serves as lock context and thus is needed in scope for every sub-task
        const familyUID = generateFamilyUID(dsu.familyMembers);
        return (
          taskEither
            .of<StartBonusActivationResponse, void>(void 0)
            .chain(_ => acquireLockForUserFamily(bonusLeaseModel, familyUID))
            .chain(_ =>
              createBonusActivation(
                bonusActivationModel,
                fiscalCode,
                familyUID,
                dsu
              )
            )
            .chain(bonusActivation =>
              runStartBonusActivationOrchestrator(
                client,
                bonusActivation,
                fiscalCode
              ).map(_ => bonusActivation)
            )
            // the following is basically:
            // on right, just pass it
            // on left, perform unlock but then pass the original left value
            .foldTaskEither(
              l =>
                relaseLockForUserFamily(
                  bonusLeaseModel,
                  familyUID
                ).foldTaskEither(
                  _ => fromEither(left(l)),
                  _ => fromEither(left(l))
                ),
              r => fromEither(right(r))
            )
        );
      })
      .chain(bonusActivation =>
        fromEither(toApiBonusActivation(bonusActivation)).mapLeft(err =>
          // validate output
          ResponseErrorInternal(
            `Error converting bonusActivation to apiBonusActivation: ${readableReport(
              err
            )}`
          )
        )
      )
      .fold(
        l => l,
        apiBonusActivation =>
          ResponseSuccessRedirectToResource(
            apiBonusActivation,
            makeBonusActivationResourceUri(fiscalCode, apiBonusActivation.id),
            apiBonusActivation
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
