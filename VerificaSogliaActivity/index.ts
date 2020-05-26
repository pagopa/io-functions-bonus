import { AzureFunction, Context } from "@azure/functions";

import { fromEither, tryCatch } from "fp-ts/lib/TaskEither";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import * as path from "path";
import * as soap from "soap";
import { ConsultazioneSogliaIndicatore } from "../generated/SvcConsultazione/ConsultazioneSogliaIndicatore";
import { ConsultazioneSogliaIndicatoreResponse_element_tns } from "../generated/SvcConsultazione/ConsultazioneSogliaIndicatoreResponse_element_tns";
import { createClient, promisifySoapMethod, SoapMethodCB } from "../utils/soap";

const INPS_SERVICE_HOST = getRequiredStringEnv("INPS_SERVICE_HOST");

export interface ISvcConsultazione {
  readonly ConsultazioneSogliaIndicatore: SoapMethodCB<
    ConsultazioneSogliaIndicatore,
    ConsultazioneSogliaIndicatoreResponse_element_tns
  >;
}

const SVC_CONSULTAZIONE_WSDL_PATH = path.join(
  __dirname,
  "./../../wsdl/ConsultazioneISEE.wsdl"
) as NonEmptyString;

export function createSvcConsultazioneClient(
  options: soap.IOptions,
  cert?: string,
  key?: string,
  hostHeader?: string
): Promise<soap.Client & ISvcConsultazione> {
  return createClient<ISvcConsultazione>(
    SVC_CONSULTAZIONE_WSDL_PATH,
    options,
    cert,
    key,
    hostHeader
  );
}

/**
 * Converts the callback based methods of a FespCd client to
 * promise based methods.
 */
export class SvcConsultazioneClientAsync {
  public readonly ConsultazioneSogliaIndicatore = promisifySoapMethod(
    this.client.ConsultazioneSogliaIndicatore
  );
  constructor(private readonly client: ISvcConsultazione) {}
}

// Activity result
const ActivityResultSuccess = t.interface({
  kind: t.literal("SUCCESS")
});

type ActivityResultSuccess = t.TypeOf<typeof ActivityResultSuccess>;

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

const verificaSogliaActivity: AzureFunction = async (
  context: Context,
  input: unknown
): Promise<ActivityResult> => {
  return (
    fromEither(
      FiscalCode.decode(input).mapLeft(
        err => new Error(`Error: [${readableReport(err)}]`)
      )
    )
      .chain(fiscalCode => {
        return tryCatch(
          async () => {
            const inpsSvcConsultazioneClient = new SvcConsultazioneClientAsync(
              await createSvcConsultazioneClient({
                endpoint: `${INPS_SERVICE_HOST}/ConsultazioneSogliaIndicatore`,
                wsdl_options: {
                  timeout: 1000
                }
              })
            );
            return await inpsSvcConsultazioneClient.ConsultazioneSogliaIndicatore(
              fiscalCode
            );
          },
          _ => new Error("Error calling ConsultazioneSogliaIndicatore service")
        );
      })
      // TODO: Save the success response data
      .mapLeft(err => {
        const errorMessage = `VerificaSogliaActivity|ERROR|${err}`;
        context.log.error(errorMessage);
        return errorMessage;
      })
      .fold<ActivityResult>(
        errorMessage =>
          ActivityResultFailure.encode({
            kind: "FAILURE",
            reason: errorMessage
          }),
        _ =>
          ActivityResultSuccess.encode({
            kind: "SUCCESS"
          })
      )
      .run()
  );
};

export default verificaSogliaActivity;
