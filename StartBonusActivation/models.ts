import { isBefore } from "date-fns";
import { right, toError } from "fp-ts/lib/Either";
import {
  fromEither,
  fromLeft,
  TaskEither,
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

import {
  fromQueryEither,
  QueryError
} from "io-functions-commons/dist/src/utils/documentdb";
import * as t from "io-ts";
import { Millisecond } from "italia-ts-commons/lib/units";
import { BonusActivation } from "../generated/definitions/BonusActivation";
import { BonusActivationWithFamilyUID } from "../generated/models/BonusActivationWithFamilyUID";
import { FamilyUID } from "../generated/models/FamilyUID";
import { Timestamp } from "../generated/models/Timestamp";
import { BonusLeaseModel } from "../models/bonus_lease";
import { errorToQueryError } from "./utils";

const CREATION_MAX_RETRIES_ON_CONFLICT = 5;
const CREATION_DELAY_ON_CONFLICT = 50 as Millisecond;

// When attempting to create the bonus document on cosmos, we will retry in case
// of a (very unlikely) conflict with an existing bonus with the same BonusID.
// The retry policy has a constant delay.
const withRetryPolicy = withRetries<QueryError, RetrievedBonusActivation>(
  CREATION_MAX_RETRIES_ON_CONFLICT,
  () => CREATION_DELAY_ON_CONFLICT
);

export interface IApiBonusActivationWithValidBefore {
  apiBonusActivation: BonusActivation;
  validBefore: Timestamp;
}

const eligibilityCheckToResponse = (
  doc: RetrievedEligibilityCheck
): TaskEither<
  IResponseErrorForbiddenNotAuthorized | IResponseErrorGone,
  EligibilityCheckSuccessEligible
> =>
  // the found document is not in eligible status
  !EligibilityCheckSuccessEligible.is(doc)
    ? fromLeft(ResponseErrorForbiddenNotAuthorized)
    : // the check is expired
    isBefore(doc.validBefore, new Date())
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
  fromQueryEither(() =>
    eligibilityCheckModel.find(fiscalCode, fiscalCode)
  ).foldTaskEither(
    err => fromLeft(ResponseErrorInternal(`Error reading DSU: ${err.body}`)),
    maybeEligibilityCheck =>
      maybeEligibilityCheck.fold<ReturnType<typeof getLatestValidDSU>>(
        fromLeft(ResponseErrorForbiddenNotAuthorized),
        eligibilityCheckToResponse
      )
  );

// CosmosDB conflict: primary key violation
const shouldRetryOn409 = (err: QueryError) => err.code === 409;

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
    .mapLeft(errorToQueryError)
    .foldTaskEither<QueryError | TransientError, RetrievedBonusActivation>(
      fromLeft,
      (bonusCode: BonusCode) =>
        fromQueryEither(() => {
          const bonusActivation = makeNewBonusActivation(
            fiscalCode,
            familyUID,
            dsu,
            bonusCode
          );
          return bonusActivationModel.create(
            bonusActivation,
            bonusActivation.id
          );
        }).mapLeft(err => (shouldRetryOn409(err) ? TransientError : err))

      // The following cast is due to the fact that
      // TaskEither<QueryError | TransientError, ...>
      // cannot be passed as parameter to withRetries<QueryError, ...>
      // since the union (QueryError) has different types (string vs number)
      // for the same field (code)
    ) as RetriableTask<QueryError, RetrievedBonusActivation>;

  return withRetryPolicy(
    retriableBonusActivationTask
  ).mapLeft(errorOrMaxRetry =>
    errorOrMaxRetry === MaxRetries || errorOrMaxRetry === RetryAborted
      ? ResponseErrorInternal(
          `Error creating BonusActivation: cannot create a db record after ${CREATION_MAX_RETRIES_ON_CONFLICT} attempts`
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
export const acquireLockForUserFamily = (
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
export const relaseLockForUserFamily = (
  bonusLeaseModel: BonusLeaseModel,
  familyUID: FamilyUID
): TaskEither<IResponseErrorInternal, FamilyUID> => {
  return fromQueryEither(() => bonusLeaseModel.deleteOneById(familyUID)).bimap(
    err => ResponseErrorInternal(`Error releasing lock: ${err.body}`),
    _ => familyUID
  );
};
