import { Context } from "@azure/functions";
import { fromEither, tryCatch } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
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
 * Call INPS webservice to read the ISEE information
 */
export const getDeleteEligibilityCheckActivityHandler = (
  eligibilityCheckModel: EligibilityCheckModel
) => {
  return async (context: Context, input: unknown): Promise<ActivityResult> => {
    const fiscalCode = NonEmptyString.decode(input).fold(
      e => {
        throw e;
      },
      _ => _
    );
    // TODO: Read first delete is required?
    return tryCatch(
      () => eligibilityCheckModel.deleteOneById(fiscalCode),
      err => new Error(`Error deleting EligibilityCheck: [${err}]`)
    )
      .chain(_ =>
        fromEither(_).mapLeft(err => new Error(`QueryError: [${err}]`))
      )
      .fold<Promise<ActivityResult>>(
        errorMessage =>
          // Reject fail the Activity execution
          // If called with `callActivityWithRetry` the execution will be restarted
          Promise.resolve(
            ActivityResultFailure.encode({
              kind: "FAILURE",
              reason: errorMessage.message
            })
          ),
        _ =>
          // TODO: Check casting below
          Promise.resolve(
            ActivityResultSuccess.encode({
              kind: "SUCCESS"
            })
          )
      )
      .run();
  };
};
