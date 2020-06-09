import { Context } from "@azure/functions";
import { left, right } from "fp-ts/lib/Either";
import { fromEither, tryCatch } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { EligibilityCheckModel } from "../models/eligibility_check";

// Activity result
export const ActivityResultSuccess = t.interface({
  kind: t.literal("SUCCESS")
});

export type ActivityResultSuccess = t.TypeOf<typeof ActivityResultSuccess>;

const ActivityResultFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});

type ActivityResultFailure = t.TypeOf<typeof ActivityResultFailure>;

export const ActivityResult = t.taggedUnion("kind", [
  ActivityResultSuccess,
  ActivityResultFailure
]);
export type ActivityResult = t.TypeOf<typeof ActivityResult>;

/**
 * Delete Eligibility Check from cosmos
 */
export const getDeleteEligibilityCheckActivityHandler = (
  eligibilityCheckModel: EligibilityCheckModel
) => {
  return async (context: Context, input: unknown): Promise<ActivityResult> => {
    return fromEither(
      NonEmptyString.decode(input).mapLeft(
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
              return fromEither(left(new Error(`QueryError: [${err}]`)));
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
