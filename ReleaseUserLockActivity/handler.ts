import { toString } from "fp-ts/lib/function";
import { fromEither } from "fp-ts/lib/TaskEither";
import { CosmosErrors } from "io-functions-commons/dist/src/utils/cosmosdb_model";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { Context } from "vm";
import { BonusProcessingModel } from "../models/bonus_processing";
import { trackException } from "../utils/appinsights";
import {
  cosmosErrorsToReadableMessage,
  Failure,
  PermanentFailure,
  TransientFailure
} from "../utils/errors";

export const ReleaseUserLockActivitySuccess = t.type({
  id: FiscalCode,
  kind: t.literal("SUCCESS")
});
export type ReleaseUserLockActivitySuccess = t.TypeOf<
  typeof ReleaseUserLockActivitySuccess
>;

export const ReleaseUserLockActivityResult = t.taggedUnion("kind", [
  PermanentFailure,
  ReleaseUserLockActivitySuccess
]);
export type ReleaseUserLockActivityResult = t.TypeOf<
  typeof ReleaseUserLockActivityResult
>;

export const ReleaseUserLockActivityInput = t.type({
  // applicant fiscal code
  id: FiscalCode
});

type IReleaseUserLockActivityHandler = (
  context: Context,
  input: unknown
) => Promise<ReleaseUserLockActivityResult>;

const invalidInputFailure = (err: t.Errors) =>
  Failure.encode({
    kind: "PERMANENT",
    reason: `Invalid input: ${readableReport(err)}`
  });

const lockNotFoundFailure = Failure.encode({
  kind: "PERMANENT",
  reason: "Lock not found"
});

const queryErrorFailure = (err: CosmosErrors) =>
  Failure.encode({
    kind: "TRANSIENT",
    reason: `Query error: ${cosmosErrorsToReadableMessage(err)}`
  });

const releaseUserLockActivitySuccess = (
  id: ReleaseUserLockActivitySuccess["id"]
) =>
  ReleaseUserLockActivitySuccess.encode({
    id,
    kind: "SUCCESS"
  });

export function getReleaseUserLockActivityHandler(
  bonusProcessingModel: BonusProcessingModel,
  logPrefix = `ReleaseUserLockActivity`
): IReleaseUserLockActivityHandler {
  return async (
    _: Context,
    input: unknown
  ): Promise<ReleaseUserLockActivityResult> => {
    return fromEither(ReleaseUserLockActivityInput.decode(input))
      .mapLeft<Failure>(invalidInputFailure)
      .chain(({ id }) =>
        bonusProcessingModel
          .deleteOneById(id)
          .map(__ => id)
          .mapLeft<Failure>(err =>
            err.kind === "COSMOS_ERROR_RESPONSE" && err.error.code === 404
              ? lockNotFoundFailure
              : queryErrorFailure(err)
          )
      )
      .fold<ReleaseUserLockActivityResult>(err => {
        if (TransientFailure.is(err)) {
          const ex = new Error(`${logPrefix}|${toString(err)}`);
          trackException({
            exception: ex,
            properties: {
              name: "bonus.activation.failure.unlock"
            }
          });
          // trigger a retry in case of failures
          throw ex;
        }
        // permanent failures are tracked into the orchestrator
        return err;
      }, releaseUserLockActivitySuccess)
      .run();
  };
}
