import { Context } from "@azure/functions";
import { isBefore } from "date-fns";
import * as df from "durable-functions";
import { DurableOrchestrationClient } from "durable-functions/lib/src/durableorchestrationclient";
import * as express from "express";
import { isLeft, left, right, toError } from "fp-ts/lib/Either";
import {
  fromEither,
  fromLeft,
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

import { identity } from "fp-ts/lib/function";
import { toString } from "fp-ts/lib/function";
import {
  fromQueryEither,
  QueryError
} from "io-functions-commons/dist/src/utils/documentdb";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { Millisecond } from "italia-ts-commons/lib/units";
import { ContinueBonusActivationInput } from "../ContinueBonusActivation/handler";
import { BonusActivation as ApiBonusActivation } from "../generated/definitions/BonusActivation";
import { InstanceId } from "../generated/definitions/InstanceId";
import { BonusActivationWithFamilyUID } from "../generated/models/BonusActivationWithFamilyUID";
import { FamilyUID } from "../generated/models/FamilyUID";
import { BonusLeaseModel } from "../models/bonus_lease";
import { OrchestratorInput } from "../StartBonusActivationOrchestrator/handler";
import { trackException } from "../utils/appinsights";
import { toApiBonusActivation } from "../utils/conversions";
import { generateFamilyUID } from "../utils/hash";

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
): TaskEither<
  IResponseErrorInternal | IResponseSuccessAccepted<InstanceId>,
  false
> =>
  tryCatch(
    () => client.getStatus(makeStartBonusActivationOrchestratorId(fiscalCode)),
    toError
  )
    .map(status => ({
      customStatus: status.customStatus,
      isRunning: status.runtimeStatus === df.OrchestrationRuntimeStatus.Running
    }))
    .foldTaskEither(
      err =>
        fromEither(
          left(
            ResponseErrorInternal(
              `Cannot get BonusActivationOrchestrator status: ${err.message}`
            )
          )
        ),
      ({ customStatus, isRunning }) =>
        isRunning
          ? tryCatch(
              async () => {
                // In case we have found a running bonus activation orchestrator
                // we must return (202) the related bonus ID to the caller of the API:
                // the client needs to know the endpoint to poll to get the bonus details.
                // That's why here we try to get the bonus ID from the
                // running orchestrator custom status.
                return NonEmptyString.decode(customStatus).fold<
                  IResponseErrorInternal | IResponseSuccessAccepted<InstanceId>
                >(
                  errs =>
                    ResponseErrorInternal(
                      `Cannot decode the ID of the bonus being processed: '${readableReport(
                        errs
                      )}'`
                    ),
                  bonusId =>
                    ResponseSuccessAccepted(
                      "Still running",
                      InstanceId.encode({
                        id: bonusId
                      })
                    )
                );
              },
              err =>
                ResponseErrorInternal(
                  `Cannot get the ID of the bonus being processed: ${toString(
                    err
                  )}`
                )
              // collapse the right parts into lefts
              // as the only right value here may be the boolean 'false'
            ).foldTaskEither<
              IResponseErrorInternal | IResponseSuccessAccepted<InstanceId>,
              false
            >(fromLeft, fromLeft)
          : taskEither.of(false)
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

  const retriableBonusActivationTask = tryCatch(genRandomBonusCode, toError)
    .mapLeft(
      (err: Error): QueryError => ({
        body: err.message,
        code: "error"
      })
    )
    .foldTaskEither<QueryError | TransientError, RetrievedBonusActivation>(
      _ => fromEither(left(_)),
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
          return bonusActivationModel.create(
            bonusActivation,
            bonusActivation.id
          );
        }).mapLeft(err => {
          return shouldRetry(err) ? TransientError : err;
        })

      // The following cast is due to the fact that
      // TaskEither<QueryError | TransientError, ...>
      // cannot be passed as parameter to withRetries<QueryError, ...>
      // since the union (QueryError) has different types (string vs number)
      // for the same field (code)
    ) as RetriableTask<QueryError, RetrievedBonusActivation>;

  return withRetries<QueryError, RetrievedBonusActivation>(
    BONUS_CREATION_MAX_ATTEMPTS,
    () => 50 as Millisecond
  )(retriableBonusActivationTask).mapLeft(errorOrMaxRetry =>
    errorOrMaxRetry === MaxRetries || errorOrMaxRetry === RetryAborted
      ? ResponseErrorInternal(
          `Error creating BonusActivation: cannot create a db record after ${BONUS_CREATION_MAX_ATTEMPTS} attempts`
        )
      : ResponseErrorInternal(
          `Error creating BonusActivation: ${errorOrMaxRetry.body}`
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
): TaskEither<IResponseErrorConflict | IResponseErrorInternal, unknown> => {
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
      err.code === 409
        ? ResponseErrorConflict(
            `There's already a lease for familyUID ${familyUID}`
          )
        : ResponseErrorInternal(
            `Error while acquiring lease for familyUID ${familyUID}: ${err.body}`
          ),
    _ => {
      return _;
    }
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
  input: OrchestratorInput,
  fiscalCode: FiscalCode
): TaskEither<IResponseErrorInternal, string> =>
  tryCatch(
    () =>
      client.startNew(
        "StartBonusActivationOrchestrator",
        makeStartBonusActivationOrchestratorId(fiscalCode),
        input
      ),
    _ =>
      ResponseErrorInternal(
        `Error starting the orchestrator: ${toError(_).message}`
      )
  );

type StartBonusActivationResponse =
  | IResponseErrorInternal
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorGone
  | IResponseErrorConflict
  | IResponseSuccessAccepted<InstanceId>
  | IResponseSuccessRedirectToResource<ApiBonusActivation, InstanceId>;

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
    const dfClient = df.getClient(context);

    return taskEither
      .of<StartBonusActivationResponse, void>(void 0)
      .chainSecond(checkEligibilityCheckIsRunning(dfClient, fiscalCode))
      .chainSecond(checkBonusActivationIsRunning(dfClient, fiscalCode))
      .chainSecond(getLatestValidDSU(eligibilityCheckModel, fiscalCode))
      .map((dsu: Dsu) => ({
        dsu,
        familyUID: generateFamilyUID(dsu.familyMembers)
      }))
      .chain(({ dsu, familyUID }) =>
        acquireLockForUserFamily(bonusLeaseModel, familyUID).map(_ => ({
          dsu,
          familyUID
        }))
      )
      .chain<ApiBonusActivation>(({ dsu, familyUID }) =>
        createBonusActivation(bonusActivationModel, fiscalCode, familyUID, dsu)
          .chain<{
            bonusActivation: BonusActivationWithFamilyUID;
            apiBonusActivation: ApiBonusActivation;
          }>(bonusActivation => {
            const errorOrApiBonusActivation = toApiBonusActivation(
              bonusActivation
            );
            if (isLeft(errorOrApiBonusActivation)) {
              return fromLeft(
                ResponseErrorInternal(
                  `Error converting BonusActivation to ApiBonusActivation: ${readableReport(
                    errorOrApiBonusActivation.value
                  )}`
                )
              );
            }
            return taskEither.of({
              apiBonusActivation: errorOrApiBonusActivation.value,
              bonusActivation
            });
          })
          .chain(({ bonusActivation, apiBonusActivation }) =>
            runStartBonusActivationOrchestrator(
              dfClient,
              OrchestratorInput.encode({ bonusId: bonusActivation.id }),
              fiscalCode
            ).map(_ => apiBonusActivation)
          )
          .foldTaskEither(
            // bonus creation failed
            response => {
              trackException({
                exception: new Error(response.detail),
                properties: {
                  name: "bonus.activation.start"
                }
              });
              return relaseLockForUserFamily(
                bonusLeaseModel,
                familyUID
              ).foldTaskEither(
                _ => fromLeft(response),
                _ => fromLeft(response)
              );
            },
            // bonus creation succeeded
            apiBonusActivation => taskEither.of(apiBonusActivation)
          )
      )
      .fold(identity, apiBonusActivation => {
        // Send the (bonusId, applicantFiscalCode) to the bonus activations queue
        // in order to be processed later (asynchronously)
        // tslint:disable-next-line: no-object-mutation
        context.bindings.bonusActivation = ContinueBonusActivationInput.encode({
          applicantFiscalCode: apiBonusActivation.applicant_fiscal_code,
          bonusId: apiBonusActivation.id
        });
        return ResponseSuccessRedirectToResource(
          apiBonusActivation,
          makeBonusActivationResourceUri(fiscalCode, apiBonusActivation.id),
          InstanceId.encode({
            id: (apiBonusActivation.id as unknown) as NonEmptyString
          })
        );
      })
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
