import { Context } from "@azure/functions";
import { format } from "date-fns";
import { fromEither } from "fp-ts/lib/TaskEither";
import { FiscalCode } from "io-functions-commons/dist/generated/definitions/FiscalCode";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FornituraNucleoEnum } from "../generated/definitions/ConsultazioneSogliaIndicatoreInput";
import {
  ConsultazioneSogliaIndicatoreResponse,
  SottoSogliaEnum,
  TipoIndicatoreEnum
} from "../generated/definitions/ConsultazioneSogliaIndicatoreResponse";
import { ISoapClientAsync } from "../utils/inpsSoapClient";

// Activity result
export const ActivityResultSuccess = t.interface({
  data: ConsultazioneSogliaIndicatoreResponse,
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
        return soapClientAsync.ConsultazioneSogliaIndicatore({
          CodiceFiscale: fiscalCode,
          CodiceSoglia: "BVAC01",
          FornituraNucleo: FornituraNucleoEnum.SI
        });
      })
      .mapLeft(err => {
        const errorMessage = `EligibilityCheckActivity|ERROR|${err}`;
        context.log.error(errorMessage);
        return errorMessage;
      })
      .fold(
        errorMessage =>
          Promise.reject(
            ActivityResultFailure.encode({
              kind: "FAILURE",
              reason: errorMessage
            })
          ),
        _ =>
          Promise.resolve(
            ActivityResultSuccess.encode({
              data: _,
              kind: "SUCCESS"
            })
          )
      )
      .run()
      // TODO: Remove this test code
      .catch(e => {
        context.log.error(`Error calling SOAP service: ${JSON.stringify(e)}`);
        return ActivityResultSuccess.encode({
          data: {
            TipoIndicatore: TipoIndicatoreEnum["ISEE Standard"],

            DataPresentazioneDSU: format(new Date(), "yyyy-MM-dd"),
            ProtocolloDSU: "INPS-ISEE-1234-12345678A-12",
            SottoSoglia: SottoSogliaEnum.SI,

            Componente: [
              {
                CodiceFiscale: "AAABBB01C02D123Z",
                Cognome: "Rossi",
                Nome: "Mario"
              }
            ]
          },
          kind: "SUCCESS"
        });
      });
  };
};
