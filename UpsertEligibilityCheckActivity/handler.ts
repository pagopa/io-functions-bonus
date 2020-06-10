import { Context } from "@azure/functions";
import { isLeft } from "fp-ts/lib/Either";
import { fromEither, tryCatch } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { ActivityResultSuccess as ActivityInput } from "../EligibilityCheckActivity/handler";
import { EligibilityCheck } from "../generated/definitions/EligibilityCheck";
import {
  ELIGIBILITY_CHECK_MODEL_PK_FIELD,
  EligibilityCheckModel
} from "../models/eligibility_check";
import {
  toEligibilityCheckFromDSU,
  toModelEligibilityCheck
} from "../utils/conversions";

export const ActivityResultSuccess = t.interface({
  kind: t.literal("SUCCESS")
});
export type ActivityResultSuccess = t.TypeOf<typeof ActivityResultSuccess>;

const ActivityResultFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});
type ActivityResultFailure = t.TypeOf<typeof ActivityResultFailure>;

const ActivityResult = t.taggedUnion("kind", [
  ActivityResultFailure,
  ActivityResultSuccess
]);
type ActivityResult = t.TypeOf<typeof ActivityResult>;

type ISaveEligibilityCheckHandler = (
  context: Context,
  input: unknown
) => Promise<ActivityResult>;

// tslint:disable-next-line: cognitive-complexity
export function getUpsertEligibilityCheckActivityHandler(
  eligibilityCheckModel: EligibilityCheckModel
): ISaveEligibilityCheckHandler {
  return (context: Context, input: unknown) => {
    return fromEither(
      ActivityInput.decode(input).mapLeft(
        _ => new Error(`Error decoding ActivityInput: [${readableReport(_)}]`)
      )
    )
      .map<EligibilityCheck>(({ data, fiscalCode, validBefore }) => {
        return toEligibilityCheckFromDSU(data, fiscalCode, validBefore);
      })
      .chain(eligibilityCheck =>
        tryCatch(
          () => {
            const errorOrModelEligibilityCheck = toModelEligibilityCheck(
              eligibilityCheck
            );
            if (isLeft(errorOrModelEligibilityCheck)) {
              throw new Error(
                `Eligibility check Conversion error: [${readableReport(
                  errorOrModelEligibilityCheck.value
                )}]`
              );
            }
            const modelEligibilityCheck = errorOrModelEligibilityCheck.value;

            // TODO: check if a bonus for the family members is already
            // active and convert EligibilityCheckSuccessEligibile into
            // an EligibilityCheckConflict object before saving

            return eligibilityCheckModel.createOrUpdate(
              { ...modelEligibilityCheck, kind: "INewEligibilityCheck" },
              modelEligibilityCheck[ELIGIBILITY_CHECK_MODEL_PK_FIELD]
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
