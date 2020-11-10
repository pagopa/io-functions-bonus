import { Context } from "@azure/functions";
import { fromEither } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { EligibilityCheck } from "../generated/models/EligibilityCheck";
import { EligibilityCheckModel } from "../models/eligibility_check";
import { cosmosErrorsToReadableMessage } from "../utils/errors";

export const UpsertEligibilityCheckActivityInput = EligibilityCheck;
export type UpsertEligibilityCheckActivityInput = t.TypeOf<
  typeof UpsertEligibilityCheckActivityInput
>;

export const ActivityResultSuccess = t.interface({
  kind: t.literal("SUCCESS")
});
export type ActivityResultSuccess = t.TypeOf<typeof ActivityResultSuccess>;

export const ActivityResultFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});
export type ActivityResultFailure = t.TypeOf<typeof ActivityResultFailure>;

const ActivityResult = t.taggedUnion("kind", [
  ActivityResultFailure,
  ActivityResultSuccess
]);
type ActivityResult = t.TypeOf<typeof ActivityResult>;

type ISaveEligibilityCheckHandler = (
  context: Context,
  input: unknown
) => Promise<ActivityResult>;

export function getUpsertEligibilityCheckActivityHandler(
  eligibilityCheckModel: EligibilityCheckModel
): ISaveEligibilityCheckHandler {
  return (context: Context, input: unknown) => {
    return fromEither(
      UpsertEligibilityCheckActivityInput.decode(input).mapLeft(
        _ => new Error(`Error decoding ActivityInput: [${readableReport(_)}]`)
      )
    )
      .chain(eligibilityCheck =>
        eligibilityCheckModel
          .upsert({
            ...eligibilityCheck,
            kind: "INewEligibilityCheck"
          })
          .mapLeft(
            err =>
              new Error(`Query Error: ${cosmosErrorsToReadableMessage(err)}`)
          )
      )
      .fold<ActivityResult>(
        err => {
          context.log.error(
            `UpsertEligibilityCheckActivity|ERROR|${err.message}`
          );
          return ActivityResultFailure.encode({
            kind: "FAILURE",
            reason: err.message
          });
        },
        _ => ActivityResultSuccess.encode({ kind: "SUCCESS" })
      )
      .run();
  };
}
