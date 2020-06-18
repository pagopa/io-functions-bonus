import { Context } from "@azure/functions";
import { defaultClient } from "applicationinsights";
import { addMilliseconds } from "date-fns";
import { fromEither } from "fp-ts/lib/TaskEither";
import { FiscalCode } from "io-functions-commons/dist/generated/definitions/FiscalCode";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { Hour, Millisecond } from "italia-ts-commons/lib/units";
import { ConsultazioneSogliaIndicatoreResponse } from "../generated/definitions/ConsultazioneSogliaIndicatoreResponse";
import { SiNoTypeEnum } from "../generated/definitions/SiNoType";
import { Timestamp } from "../generated/definitions/Timestamp";
import { ISoapClientAsync } from "../utils/inpsSoapClient";

export const EligibilityCheckActivityInput = FiscalCode;
export type EligibilityCheckActivityInput = t.TypeOf<
  typeof EligibilityCheckActivityInput
>;

// Activity result
export const ActivityResultSuccess = t.interface({
  data: ConsultazioneSogliaIndicatoreResponse,
  fiscalCode: FiscalCode,
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

const toMillisecond = (h: Hour): Millisecond =>
  (h * 60 * 60 * 1000) as Millisecond;

/**
 * Call INPS webservice to read the ISEE information
 * and parses returned XML
 *
 * @param soapClientAsync an instance of the INPS client
 * @param dsuDuration time the received DSU is considered valid in our system, in hours
 * @param thresholdCode (optional) the code used by INPS as a treshold to validate ISEE regading `Bonus Vacanze 2020`. @see https://docs.google.com/document/d/1k-oWVK7Qs-c42b5HW4ild6rzpbQFDJ-f
 *
 * @returns a success object with the received data
 * @throws for any failure to allow retry
 */
export const getEligibilityCheckActivityHandler = (
  soapClientAsync: ISoapClientAsync,
  dsuDuration: Hour,
  thresholdCode = "BVAC01"
) => {
  return async (context: Context, input: unknown): Promise<ActivityResult> => {
    return await fromEither(
      EligibilityCheckActivityInput.decode(input).mapLeft(
        err => new Error(`Error: [${readableReport(err)}]`)
      )
    )
      .chain(fiscalCode => {
        return soapClientAsync
          .ConsultazioneSogliaIndicatore({
            CodiceFiscale: fiscalCode,
            CodiceSoglia: thresholdCode,
            FornituraNucleo: SiNoTypeEnum.SI
          })
          .map(_ => ({ dsu: _, fiscalCode }));
      })
      .fold(
        err => {
          context.log.error(`EligibilityCheckActivity|ERROR|${err.message}`);
          defaultClient.trackException({
            exception: err,
            properties: {
              name: "bonus.eligibilitycheck.inps"
            }
          });
          // Trigger a retry: every left result
          // is mapped to any transient error that may occur
          // during the call to the INPS service
          throw err;
        },
        async _ => ({
          data: _.dsu,
          fiscalCode: _.fiscalCode,
          kind: "SUCCESS" as "SUCCESS",
          // using milliseconds allow for fractions of hours to be considered. Useful for testing
          validBefore: addMilliseconds(new Date(), toMillisecond(dsuDuration))
        })
      )
      .run();
  };
};
