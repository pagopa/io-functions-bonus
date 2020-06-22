import { format } from "date-fns";
import {
  Either,
  fromNullable as fromNullableEither,
  fromPredicate,
  left,
  toError
} from "fp-ts/lib/Either";
import { fromNullable as fromNullableOption } from "fp-ts/lib/Option";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import { agent } from "italia-ts-commons";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { DOMParser } from "xmldom";
import { ConsultazioneSogliaIndicatoreInput } from "../generated/definitions/ConsultazioneSogliaIndicatoreInput";
import {
  ConsultazioneSogliaIndicatoreResponse,
  EsitoEnum
} from "../generated/definitions/ConsultazioneSogliaIndicatoreResponse";
import { SiNoTypeEnum } from "../generated/definitions/SiNoType";

import { toString } from "fp-ts/lib/function";
import {
  AbortableFetch,
  setFetchTimeout,
  toFetch
} from "italia-ts-commons/lib/fetch";
import { IntegerFromString } from "italia-ts-commons/lib/numbers";
import { Millisecond } from "italia-ts-commons/lib/units";
import { UrlFromString } from "italia-ts-commons/lib/url";
import { withInpsTracer } from "../services/loggers";

// TODO: Handle the inps:Identity element content
const getSOAPRequest = (
  dataValidita: string,
  fiscalCode: string,
  fornituraNucleo: SiNoTypeEnum,
  codiceSoglia: string
) => `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:con="http://inps.it/ConsultazioneISEE">
<soapenv:Header>
  <wsa:MessageID xmlns:wsa="http://www.w3.org/2005/08/addressing">7e6416bf-f86b-495b-8f89-2d8e208aaf4c</wsa:MessageID>
  <wsa:To xmlns:wsa="http://www.w3.org/2005/08/addressing">http://msws2.svil.inps:80/WSServiziISEE/SvcConsultazione.svc</wsa:To>
  <wsa:Action xmlns:wsa="http://www.w3.org/2005/08/addressing">http://inps.it/ConsultazioneISEE/ISvcConsultazione/ConsultazioneSogliaIndicatore</wsa:Action>
  <inps:Identity xmlns:inps="http://inps.it/">
    <UserId>PAGOPA</UserId>
    <CodiceUfficio>0001</CodiceUfficio>
    <CodiceEnte>SPSPAGOPA</CodiceEnte>
  </inps:Identity>
</soapenv:Header>
<soapenv:Body>
  <con:ConsultazioneSogliaIndicatore>
    <con:request CodiceFiscale="${fiscalCode}" CodiceSoglia="${codiceSoglia}" FornituraNucleo="${fornituraNucleo}" DataValidita="${dataValidita}"/>
  </con:ConsultazioneSogliaIndicatore>
</soapenv:Body>
</soapenv:Envelope>`;

const INPS_NAMESPACE = "http://inps.it/ConsultazioneISEE";

const INPS_SOAP_ACTION =
  "http://inps.it/ConsultazioneISEE/ISvcConsultazione/ConsultazioneSogliaIndicatore";

// 10 seconds timeout by default
const INPS_REQUEST_TIMEOUT_MS = IntegerFromString.decode(
  process.env.INPS_REQUEST_TIMEOUT_MS
).getOrElse(10000);

// http when developing locally
const INPS_SERVICE_PROTOCOL = UrlFromString.decode(
  process.env.INPS_SERVICE_ENDPOINT
)
  .map(url => url.protocol?.slice(0, -1))
  .getOrElse("https");

const fetchAgent =
  INPS_SERVICE_PROTOCOL === "http"
    ? agent.getHttpFetch(process.env)
    : agent.getHttpsFetch(process.env, {
        cert: process.env.INPS_SERVICE_CERT,
        key: process.env.INPS_SERVICE_KEY
      });

const fetchWithTimeout = setFetchTimeout(
  INPS_REQUEST_TIMEOUT_MS as Millisecond,
  AbortableFetch(fetchAgent)
);

const httpFetch = withInpsTracer(toFetch(fetchWithTimeout));

export interface ISoapClientAsync {
  ConsultazioneSogliaIndicatore: (
    params: ConsultazioneSogliaIndicatoreInput
  ) => TaskEither<Error, ConsultazioneSogliaIndicatoreResponse>;
}

export function parseSoapResponse(
  responseBody: string
): Either<Error, ConsultazioneSogliaIndicatoreResponse> {
  const xmlDocument = new DOMParser().parseFromString(responseBody, "text/xml");

  if (undefined === xmlDocument) {
    return left(new Error("Cannot parse INPS XML (DOM)"));
  }

  return fromNullableEither(
    new Error("Missing ConsultazioneSogliaIndicatoreResult")
  )(
    xmlDocument
      .getElementsByTagNameNS(
        INPS_NAMESPACE,
        "ConsultazioneSogliaIndicatoreResult"
      )
      .item(0)
  )
    .map(_ => ({
      IdRichiesta: fromNullableOption(
        _.getElementsByTagNameNS(INPS_NAMESPACE, "IdRichiesta").item(0)
      )
        .mapNullable(id => id.textContent?.trim())
        .map<number | string>(id => parseInt(id, 10))
        .toUndefined(),

      Esito: _.getElementsByTagNameNS(INPS_NAMESPACE, "Esito")
        .item(0)
        ?.textContent?.trim(),

      DescrizioneErrore: _.getElementsByTagNameNS(
        INPS_NAMESPACE,
        "DescrizioneErrore"
      )
        .item(0)
        ?.textContent?.trim(),

      DatiIndicatore: fromNullableOption(
        _.getElementsByTagNameNS(INPS_NAMESPACE, "DatiIndicatore").item(0)
      )
        .map(DatiIndicatore => ({
          DataPresentazioneDSU: DatiIndicatore.getAttribute(
            "DataPresentazioneDSU"
          ),

          ProtocolloDSU: DatiIndicatore.getAttribute("ProtocolloDSU"),

          SottoSoglia: DatiIndicatore.getAttribute("SottoSoglia"),

          TipoIndicatore: DatiIndicatore.getAttribute("TipoIndicatore"),

          PresenzaDifformita: DatiIndicatore.getAttribute("PresenzaDifformita")
        }))
        .toUndefined()
    }))
    .chain(_ => {
      return ConsultazioneSogliaIndicatoreResponse.decode({
        ..._,
        DatiIndicatore: _.DatiIndicatore
          ? {
              ..._.DatiIndicatore,
              Componenti: Array.from(
                xmlDocument.getElementsByTagNameNS(INPS_NAMESPACE, "Componente")
              ).map(familyMemberElement => ({
                CodiceFiscale: familyMemberElement.getAttribute(
                  "CodiceFiscale"
                ),
                Cognome: familyMemberElement.getAttribute("Cognome"),
                Nome: familyMemberElement.getAttribute("Nome")
              }))
            }
          : undefined
      }).mapLeft(error => {
        return new Error(
          `Unexpected response: [Error: ${readableReport(error)}]`
        );
      });
    })
    .chain(
      fromPredicate(
        _ =>
          // Final states
          _.Esito === EsitoEnum.OK ||
          _.Esito === EsitoEnum.DATI_NON_TROVATI ||
          _.Esito === EsitoEnum.RICHIESTA_INVALIDA,
        // Retry for DATABASE_OFFLINE, ERRORE_INTERNO
        err =>
          new Error(
            `INPS SOAP Error: [Esito:${err.Esito}|Message:${err.DescrizioneErrore}]`
          )
      )
    );
}

export function createClient(endpoint: NonEmptyString): ISoapClientAsync {
  return {
    ConsultazioneSogliaIndicatore: (
      params: ConsultazioneSogliaIndicatoreInput
    ) => {
      return tryCatch(async () => {
        const requestPayload = getSOAPRequest(
          params.DataValidita || format(new Date(), "yyyy-MM-dd"),
          params.CodiceFiscale,
          params.FornituraNucleo,
          params.CodiceSoglia
        );

        const response = await httpFetch(`${endpoint}`, {
          body: requestPayload,
          headers: {
            SOAPAction: INPS_SOAP_ACTION
          },
          method: "POST"
        });

        const responseBody = await response.text();

        if (response.status !== 200) {
          throw new Error(
            `Unexpected response from INPS|RESPONSE=${
              response.status
            }:${toString(responseBody)}`
          );
        }

        return parseSoapResponse(responseBody).fold(
          err => {
            throw new Error(
              `Cannot parse response from INPS|ERROR=${toString(err)}`
            );
          },
          async parsedDsu => parsedDsu
        );
      }, toError);
    }
  };
}
