import { Context } from "@azure/functions";
import { addHours } from "date-fns";
import { fromEither } from "fp-ts/lib/TaskEither";
import { FiscalCode } from "io-functions-commons/dist/generated/definitions/FiscalCode";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { ConsultazioneSogliaIndicatoreResponse } from "../generated/definitions/ConsultazioneSogliaIndicatoreResponse";
import { SiNoTypeEnum } from "../generated/definitions/SiNoType";
import { Timestamp } from "../generated/definitions/Timestamp";
import { ISoapClientAsync } from "../utils/inpsSoapClient";

// Activity result
export const ActivityResultSuccess = t.interface({
  data: ConsultazioneSogliaIndicatoreResponse,
  fiscalCode: NonEmptyString,
  kind: t.literal("SUCCESS"),
  validBefore: Timestamp
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
export const getEligibilityCheckActivityHandler = (
  soapClientAsync: ISoapClientAsync
) => {
  return async (context: Context, input: unknown): Promise<ActivityResult> => {
    return await fromEither(
      FiscalCode.decode(input).mapLeft(
        err => new Error(`Error: [${readableReport(err)}]`)
      )
    )
      .chain(fiscalCode => {
        return soapClientAsync
          .ConsultazioneSogliaIndicatore({
            CodiceFiscale: fiscalCode,
            CodiceSoglia: "BVAC01", // Value for `Bonus Vacanze 2020` @see https://docs.google.com/document/d/1k-oWVK7Qs-c42b5HW4ild6rzpbQFDJ-f
            FornituraNucleo: SiNoTypeEnum.SI
          })
          .map(_ => ({ dsu: _, fiscalCode }));
      })
      .mapLeft(err => {
        context.log.error(`EligibilityCheckActivity|ERROR|${err}`);
        return err;
      })
      .fold(
        err =>
          // Reject fail the Activity execution
          // If called with `callActivityWithRetry` the execution will be restarted
          Promise.reject(
            ActivityResultFailure.encode({
              kind: "FAILURE",
              reason: err.message
            })
          ),
        _ =>
          Promise.resolve({
            data: _.dsu,
            fiscalCode: (_.fiscalCode as unknown) as NonEmptyString,
            kind: "SUCCESS" as "SUCCESS",
            validBefore: addHours(new Date(), 24)
          })
      )
      .run();
  };
};
