import { Context } from "@azure/functions";
import { isLeft } from "fp-ts/lib/Either";
import { fromEither, tryCatch } from "fp-ts/lib/TaskEither";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { ActivityResultSuccess } from "../EligibilityCheckActivity/handler";
import { EligibilityCheck } from "../generated/definitions/EligibilityCheck";
import {
  ELIGIBILITY_CHECK_MODEL_PK_FIELD,
  EligibilityCheckModel
} from "../models/eligibility_check";
import {
  toEligibilityCheckFromDSU,
  toModelEligibilityCheck
} from "../utils/conversions";

type ISaveEligibilityCheckHandler = (
  context: Context,
  input: unknown
) => Promise<unknown>;

// tslint:disable-next-line: cognitive-complexity
export function getUpsertEligibilityCheckActivityHandler(
  eligibilityCheckModel: EligibilityCheckModel
): ISaveEligibilityCheckHandler {
  return (context: Context, input: unknown) => {
    return fromEither(
      ActivityResultSuccess.decode(input).mapLeft(
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
      .mapLeft(_ => {
        context.log.error(`UpsertEligibilityCheckActivity|ERROR|${_.message}`);
      })
      .run();
  };
}
