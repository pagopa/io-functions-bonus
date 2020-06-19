import { Context } from "@azure/functions";
import { right } from "fp-ts/lib/Either";
import { fromEither, tryCatch } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { EligibilityCheckModel } from "../models/eligibility_check";

export const DeleteEligibilityCheckActivityInput = FiscalCode;
export type DeleteEligibilityCheckActivityInput = t.TypeOf<
  typeof DeleteEligibilityCheckActivityInput
>;

// Activity result
export const ActivityResultSuccess = t.interface({
  kind: t.literal("SUCCESS")
});

export type ActivityResultSuccess = t.TypeOf<typeof ActivityResultSuccess>;

export const ActivityResultFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});

export type ActivityResultFailure = t.TypeOf<typeof ActivityResultFailure>;

export const ActivityResult = t.taggedUnion("kind", [
  ActivityResultSuccess,
  ActivityResultFailure
]);
export type ActivityResult = t.TypeOf<typeof ActivityResult>;

/**
 * Delete Eligibility Check from database
 */
export const getDeleteEligibilityCheckActivityHandler = (
  eligibilityCheckModel: EligibilityCheckModel
) => {
  return async (context: Context, input: unknown): Promise<ActivityResult> => {
    return fromEither(
      DeleteEligibilityCheckActivityInput.decode(input)
        .chain(fiscalCode =>
          // we need to cast as NonEmptyString because patternstring aren't empty by design
          NonEmptyString.decode(fiscalCode)
        )
        .mapLeft(
          err => new Error(`Invalid Activity input: [${readableReport(err)}]`)
        )
    )
      .chain(fiscalCode =>
        tryCatch(
          () => eligibilityCheckModel.deleteOneById(fiscalCode),
          err => new Error(`Error deleting EligibilityCheck: [${err}]`)
        ).chain(_ =>
          fromEither(_).foldTaskEither(
            err => {
              if (err.code === 404) {
                return fromEither(right("NOT FOUND"));
              }
              // this condition address the case we want the activity to throw, so the orchestrator can retry
              const queryError = new Error(
                `Query Error: code=${err.code} body=${err.body}`
              );
              context.log.error(
                `DeleteEligibilityCheckActivity|ERROR|%s`,
                queryError.message
              );
              throw queryError;
            },
            id => fromEither(right(id))
          )
        )
      )
      .fold<ActivityResult>(
        error => {
          context.log.error(
            "DeleteEligibilityCheckActivity|ERROR|%s",
            error.message
          );
          return ActivityResultFailure.encode({
            kind: "FAILURE",
            reason: error.message
          });
        },
        _ =>
          ActivityResultSuccess.encode({
            kind: "SUCCESS"
          })
      )
      .run();
  };
};
