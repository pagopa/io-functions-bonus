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
import {
  SottoSogliaEnum,
  TipoIndicatoreEnum
} from "../generated/SvcConsultazione/ConsultazioneSogliaIndicatoreResponseType_type_tns";
import { createClient, promisifySoapMethod, SoapMethodCB } from "../utils/soap";

const INPS_SERVICE_HOST = getRequiredStringEnv("INPS_SERVICE_HOST");

interface ISvcConsultazione {
  readonly ConsultazioneSogliaIndicatore: SoapMethodCB<
    ConsultazioneSogliaIndicatore,
    ConsultazioneSogliaIndicatoreResponse_element_tns
  >;
}

const SVC_CONSULTAZIONE_WSDL_PATH = path.join(
  __dirname,
  "./../../wsdl/ConsultazioneISEE.wsdl"
) as NonEmptyString;

function createSvcConsultazioneClient(
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
class SvcConsultazioneClientAsync {
  public readonly ConsultazioneSogliaIndicatore = promisifySoapMethod(
    this.client.ConsultazioneSogliaIndicatore
  );
  constructor(private readonly client: ISvcConsultazione) {}
}

// Activity result
const ActivityResultSuccess = t.interface({
  data: ConsultazioneSogliaIndicatoreResponse_element_tns,
  kind: t.literal("SUCCESS")
});

type ActivityResultSuccess = t.TypeOf<typeof ActivityResultSuccess>;

const ActivityResultFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});

type ActivityResultFailure = t.TypeOf<typeof ActivityResultFailure>;

const ActivityResult = t.taggedUnion("kind", [
  ActivityResultSuccess,
  ActivityResultFailure
]);
type ActivityResult = t.TypeOf<typeof ActivityResult>;

function soapClientBuilder(): () => Promise<SvcConsultazioneClientAsync> {
  // tslint:disable-next-line: no-let
  let client: SvcConsultazioneClientAsync | undefined;
  return async () => {
    return client
      ? client
      : (client = new SvcConsultazioneClientAsync(
          await createSvcConsultazioneClient({
            endpoint: `${INPS_SERVICE_HOST}/webservices/inps/SvcConsultazione`,
            wsdl_options: {
              timeout: 1000
            }
          })
        ));
  };
}
const soapClientAsync = soapClientBuilder();

const VerificaSogliaActivity: AzureFunction = async (
  context: Context,
  input: unknown
): Promise<ActivityResult> => {
  return await fromEither(
    FiscalCode.decode(input).mapLeft(
      err => new Error(`Error: [${readableReport(err)}]`)
    )
  )
    .chain(fiscalCode => {
      return tryCatch(
        async () => {
          const client = await soapClientAsync();
          return await client.ConsultazioneSogliaIndicatore(fiscalCode);
        },
        err =>
          new Error(
            `Error calling ConsultazioneSogliaIndicatore service: ${err}`
          )
      );
    })
    .mapLeft(err => {
      const errorMessage = `VerificaSogliaActivity|ERROR|${err}`;
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
          ConsultazioneSogliaIndicatoreResult: {
            TipoIndicatore: TipoIndicatoreEnum["ISEE Standard"],

            DataPresentazioneDSU: new Date().toISOString(),
            ProtocolloDSU: "123",
            SottoSoglia: SottoSogliaEnum.SI,

            Componente: [
              {
                CodiceFiscale: "AAABBB01C02D123Z",
                Cognome: "Rossi",
                Nome: "Mario"
              }
            ]
          }
        },
        kind: "SUCCESS"
      });
    });
};

export default VerificaSogliaActivity;
