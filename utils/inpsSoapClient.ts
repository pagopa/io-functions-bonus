import { format } from "date-fns";
import { fromNullable, toError } from "fp-ts/lib/Either";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import { agent } from "italia-ts-commons";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { DOMParser } from "xmldom";
import {
  ConsultazioneSogliaIndicatoreInput,
  FornituraNucleoEnum
} from "../generated/definitions/ConsultazioneSogliaIndicatoreInput";
import { ConsultazioneSogliaIndicatoreResponse } from "../generated/definitions/ConsultazioneSogliaIndicatoreResponse";

import {
  AbortableFetch,
  setFetchTimeout,
  toFetch
} from "italia-ts-commons/lib/fetch";
import { Millisecond } from "italia-ts-commons/lib/units";
import { UrlFromString } from "italia-ts-commons/lib/url";

const getSOAPRequest = (
  dataValidita: string,
  fiscalCode: string,
  fornituraNucleo: FornituraNucleoEnum,
  codiceSoglia: string
) => `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:con="http://inps.it/ConsultazioneISEE">
<soapenv:Header/>
<soapenv:Body>
  <con:ConsultazioneSogliaIndicatoreRequest>
    <con:Richiesta DataValidita="${dataValidita}" CodiceFiscale="${fiscalCode}" FornituraNucleo="${fornituraNucleo}" CodiceSoglia="${codiceSoglia}"/>
  </con:ConsultazioneSogliaIndicatoreRequest>
</soapenv:Body>
</soapenv:Envelope>`;

const INPS_NAMESPACE = "http://inps.it/ConsultazioneISEE";

// 5 seconds timeout by default
const DEFAULT_REQUEST_TIMEOUT_MS = 5000;

// http when developing locally
const INPS_SERVICE_PROTOCOL = UrlFromString.decode(
  process.env.INPS_SERVICE_ENDPOINT
)
  .map(url => url.protocol)
  .getOrElse("https");

const fetchWithTimeout = setFetchTimeout(
  DEFAULT_REQUEST_TIMEOUT_MS as Millisecond,
  AbortableFetch(
    INPS_SERVICE_PROTOCOL === "http"
      ? agent.getHttpFetch(process.env)
      : agent.getHttpsFetch(process.env)
  )
);
const httpFetch = toFetch(fetchWithTimeout);

export interface ISoapClientAsync {
  ConsultazioneSogliaIndicatore: (
    params: ConsultazioneSogliaIndicatoreInput
  ) => TaskEither<Error, ConsultazioneSogliaIndicatoreResponse>;
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
          method: "POST"
        });
        if (response.status === 200) {
          const responseBody = await response.text();
          const xmlDocument = new DOMParser().parseFromString(
            responseBody,
            "text/xml"
          );
          return fromNullable(
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
              DataPresentazioneDSU: _.getAttribute("DataPresentazioneDSU"),

              ProtocolloDSU: _.getAttribute("ProtocolloDSU"),

              SottoSoglia: _.getAttribute("SottoSoglia"),

              TipoIndicatore: _.getAttribute("TipoIndicatore")
            }))
            .chain(_ => {
              return ConsultazioneSogliaIndicatoreResponse.decode({
                ..._,
                Componenti: Array.from(
                  xmlDocument.getElementsByTagNameNS(
                    INPS_NAMESPACE,
                    "Componente"
                  )
                ).map(familyMemberElement => ({
                  CodiceFiscale: familyMemberElement.getAttribute(
                    "CodiceFiscale"
                  ),
                  Cognome: familyMemberElement.getAttribute("Cognome"),
                  Nome: familyMemberElement.getAttribute("Nome")
                }))
              }).mapLeft(error => {
                return new Error(
                  `Unexpected response: [Error: ${readableReport(error)}]`
                );
              });
            })
            .fold(
              _ => Promise.reject(_),
              _ => Promise.resolve(_)
            );
        }
        return Promise.reject(new Error("Unexpected statusCode response"));
      }, toError);
    }
  };
}
