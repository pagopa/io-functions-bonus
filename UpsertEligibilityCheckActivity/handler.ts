import { Context } from "@azure/functions";
import { isLeft } from "fp-ts/lib/Either";
import { fromEither, tryCatch } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { EligibilityCheck } from "../generated/models/EligibilityCheck";
import {
  ELIGIBILITY_CHECK_MODEL_PK_FIELD,
  EligibilityCheckModel
} from "../models/eligibility_check";

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
        tryCatch(
          () => {
            return eligibilityCheckModel.createOrUpdate(
              { ...eligibilityCheck, kind: "INewEligibilityCheck" },
              eligibilityCheck[ELIGIBILITY_CHECK_MODEL_PK_FIELD]
            );
          },
          err => new Error(`Error upserting EligibilityCheck [${err}]`)
        )
      )
      .chain(_ =>
        fromEither(_).mapLeft(err => new Error(`Query Error: ${err.body}`))
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
