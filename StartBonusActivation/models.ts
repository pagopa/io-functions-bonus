import { isBefore } from "date-fns";
import { right, toError } from "fp-ts/lib/Either";
import { Option } from "fp-ts/lib/Option";
import {
  fromEither,
  fromLeft,
  TaskEither,
  taskEither,
  taskify,
  tryCatch
} from "fp-ts/lib/TaskEither";
import {
  IResponseErrorConflict,
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorGone,
  IResponseErrorInternal,
  ResponseErrorConflict,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorGone,
  ResponseErrorInternal
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
import {
  EligibilityCheckModel,
  RetrievedEligibilityCheck
} from "../models/eligibility_check";
import { genRandomBonusCode } from "../utils/bonusCode";

import { QueueService } from "azure-storage";
import { toString } from "fp-ts/lib/function";
import { CosmosErrors } from "io-functions-commons/dist/src/utils/cosmosdb_model";
import { Millisecond } from "italia-ts-commons/lib/units";
import { ContinueBonusActivationInput } from "../ContinueBonusActivation";
import { BonusActivation } from "../generated/definitions/BonusActivation";
import { BonusActivationWithFamilyUID } from "../generated/models/BonusActivationWithFamilyUID";
import { FamilyUID } from "../generated/models/FamilyUID";
import { Timestamp } from "../generated/models/Timestamp";
import { BonusLeaseModel } from "../models/bonus_lease";
import {
  BonusProcessing,
  BonusProcessingModel,
  NewBonusProcessing
} from "../models/bonus_processing";
import { cosmosErrorsToReadableMessage } from "../utils/errors";
import { errorToCosmosErrors } from "./utils";

const CREATION_MAX_RETRIES_ON_CONFLICT = 5;
const CREATION_DELAY_ON_CONFLICT = 50 as Millisecond;

// When attempting to create the bonus document on cosmos, we will retry in case
// of a (very unlikely) conflict with an existing bonus with the same BonusID.
// The retry policy has a constant delay.
const withRetryPolicy = withRetries<CosmosErrors, RetrievedBonusActivation>(
  CREATION_MAX_RETRIES_ON_CONFLICT,
  () => CREATION_DELAY_ON_CONFLICT
);

export interface IApiBonusActivationWithValidBefore {
  apiBonusActivation: BonusActivation;
  validBefore: Timestamp;
}

export const eligibilityCheckToResponse = (
  doc: RetrievedEligibilityCheck,
  now: () => Date = () => new Date()
): TaskEither<
  IResponseErrorForbiddenNotAuthorized | IResponseErrorGone,
  EligibilityCheckSuccessEligible
> =>
  // the found document is not in eligible status
  !EligibilityCheckSuccessEligible.is(doc)
    ? fromLeft(ResponseErrorForbiddenNotAuthorized)
    : // the check is expired
    isBefore(doc.validBefore, now())
    ? fromLeft(ResponseErrorGone("DSU expired"))
    : // the check is fine, I can extract the DSU data from it
      fromEither(right(doc));

/**
 * Query for a valid DSU relative to the current user.
 * @param eligibilityCheckModel the model instance for EligibilityCheck
 * @param fiscalCode the id of the current user
 *
 * @returns either a valid DSU or a response relative to the state of the DSU
 */
export const getLatestValidDSU = (
  eligibilityCheckModel: EligibilityCheckModel,
  fiscalCode: FiscalCode
): TaskEither<
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorGone
  | IResponseErrorInternal,
  EligibilityCheckSuccessEligible
> =>
  eligibilityCheckModel.find(fiscalCode, fiscalCode).foldTaskEither(
    err =>
      fromLeft(
        ResponseErrorInternal(
          `Error reading DSU: ${cosmosErrorsToReadableMessage(err)}`
        )
      ),
    maybeEligibilityCheck =>
      maybeEligibilityCheck.fold<ReturnType<typeof getLatestValidDSU>>(
        fromLeft(ResponseErrorForbiddenNotAuthorized),
        eligibilityCheckToResponse
      )
  );

// CosmosDB conflict: primary key violation
const shouldRetryOn409 = (err: CosmosErrors) =>
  err.kind === "COSMOS_ERROR_RESPONSE" && err.error.code === 409;

const genRandomBonusCodeTask = tryCatch(genRandomBonusCode, toError);

const makeNewBonusActivation = (
  fiscalCode: FiscalCode,
  familyUID: FamilyUID,
  dsu: Dsu,
  bonusCode: BonusCode
): NewBonusActivation => ({
  applicantFiscalCode: fiscalCode,
  createdAt: new Date(),
  dsuRequest: dsu,
  familyUID,
  id: bonusCode as BonusCode & NonEmptyString,
  kind: "INewBonusActivation",
  status: BonusActivationStatusEnum.PROCESSING
});

/**
 * Create a new BonusActivation request record
 * @param bonusActivationModel an instance of BonusActivationModel
 * @param fiscalCode the id of the requesting user
 * @param dsu the valid DSU of the current user
 *
 * @returns either the created record or
 */
export const createBonusActivation = (
  bonusActivationModel: BonusActivationModel,
  fiscalCode: FiscalCode,
  familyUID: FamilyUID,
  dsu: Dsu
): TaskEither<IResponseErrorInternal, BonusActivationWithFamilyUID> => {
  const retriableBonusActivationTask = genRandomBonusCodeTask
    .mapLeft(errorToCosmosErrors)
    .foldTaskEither<CosmosErrors | TransientError, RetrievedBonusActivation>(
      fromLeft,
      (bonusCode: BonusCode) => {
        const bonusActivation = makeNewBonusActivation(
          fiscalCode,
          familyUID,
          dsu,
          bonusCode
        );
        return bonusActivationModel
          .create(bonusActivation)
          .mapLeft(err => (shouldRetryOn409(err) ? TransientError : err));
      }

      // The following cast is due to the fact that
      // TaskEither<QueryError | TransientError, ...>
      // cannot be passed as parameter to withRetries<QueryError, ...>
      // since the union (QueryError) has different types (string vs number)
      // for the same field (code)
    ) as RetriableTask<CosmosErrors, RetrievedBonusActivation>;

  return withRetryPolicy(
    retriableBonusActivationTask
  ).mapLeft(errorOrMaxRetry =>
    errorOrMaxRetry === MaxRetries || errorOrMaxRetry === RetryAborted
      ? ResponseErrorInternal(
          `Error creating BonusActivation: cannot create a db record after ${CREATION_MAX_RETRIES_ON_CONFLICT} attempts`
        )
      : ResponseErrorInternal(
          `Error creating BonusActivation: ${cosmosErrorsToReadableMessage(
            errorOrMaxRetry
          )}`
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
export const acquireLockForUserFamily = (
  bonusLeaseModel: BonusLeaseModel,
  familyUID: FamilyUID
): TaskEither<IResponseErrorConflict | IResponseErrorInternal, unknown> =>
  bonusLeaseModel
    .create({
      id: familyUID,
      kind: "INewBonusLease"
    })
    .mapLeft(err =>
      err.kind === "COSMOS_ERROR_RESPONSE" && err.error.code === 409
        ? ResponseErrorConflict(
            `There's already a lease for familyUID ${familyUID}`
          )
        : ResponseErrorInternal(
            `Error while acquiring lease for familyUID ${familyUID}: ${cosmosErrorsToReadableMessage(
              err
            )}`
          )
    );

/**
 * Release the lock that was eventually acquired for this request. A release attempt on a lock that doesn't exist is considered successful.
 *
 * @param bonusLeaseModel an instance of BonusLeaseModel
 * @param familyMembers the family of the requesting user
 *
 * @returns either a conflict error or the unique hash id of the family
 */
export const relaseLockForUserFamily = (
  bonusLeaseModel: BonusLeaseModel,
  familyUID: FamilyUID
): TaskEither<IResponseErrorInternal, FamilyUID> => {
  return bonusLeaseModel.deleteOneById(familyUID).foldTaskEither(
    err =>
      err.kind === "COSMOS_ERROR_RESPONSE" && err.error.code === 404
        ? taskEither.of(familyUID)
        : fromLeft(
            ResponseErrorInternal(
              `Error releasing lock: ${cosmosErrorsToReadableMessage(err)}`
            )
          ),
    _ => taskEither.of(familyUID)
  );
};

/**
 * Enqueue bonusId to schedule a bonus activation procedure
 */
export const getEnqueueBonusActivation = (
  queueService: QueueService,
  queueName: NonEmptyString
) => {
  const createMessage = taskify(queueService.createMessage.bind(queueService));
  return (
    input: ContinueBonusActivationInput
  ): TaskEither<IResponseErrorInternal, QueueService.QueueMessageResult> => {
    // see https://github.com/Azure/Azure-Functions/issues/1091
    const message = Buffer.from(JSON.stringify(input)).toString("base64");
    return createMessage(queueName, message).mapLeft(err =>
      ResponseErrorInternal(`Cannot enqueue bonus activation: ${toString(err)}`)
    );
  };
};

export type EnqueueBonusActivationT = ReturnType<
  typeof getEnqueueBonusActivation
>;

/**
 * Read the BonusProcessing record related the current user, if any
 * @param context
 *
 */
export const getBonusProcessing = (
  bonusProcessingModel: BonusProcessingModel,
  // tslint:disable-next-line: variable-name
  fiscalCode: FiscalCode
): TaskEither<CosmosErrors, Option<BonusProcessing>> =>
  bonusProcessingModel.find(fiscalCode, fiscalCode);

const makeNewBonusProcessing = (
  id: FiscalCode,
  bonusId: BonusCode
): NewBonusProcessing => ({
  bonusId,
  id: id as BonusCode & NonEmptyString,
  kind: "INewBonusProcessing"
});

/**
 * Save a new BonusProcessing record related the current user
 * @param context
 *
 */
export const saveBonusProcessing = (
  bonusProcessingModel: BonusProcessingModel,
  // tslint:disable-next-line: variable-name
  { id, bonusId }: BonusProcessing
): TaskEither<CosmosErrors, BonusProcessing> =>
  bonusProcessingModel.create(makeNewBonusProcessing(id, bonusId));
