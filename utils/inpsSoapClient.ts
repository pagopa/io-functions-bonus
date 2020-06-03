import { format } from "date-fns";
import {
  fromNullable as fromNullableEither,
  fromPredicate,
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

import {
  AbortableFetch,
  setFetchTimeout,
  toFetch
} from "italia-ts-commons/lib/fetch";
import { Millisecond } from "italia-ts-commons/lib/units";
import { UrlFromString } from "italia-ts-commons/lib/url";

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
    <UserId>CiccioGraziani</UserId>
    <AppName>DPDMZ</AppName>
    <AppKey>**********</AppKey>
    <IdentityProvider>EXT</IdentityProvider>
    <SessionId>129777ed-54b4-404b-9bb2-ff1055345db5</SessionId>
    <SequenceId>1</SequenceId>
    <OperationContextId>000000000000</OperationContextId>
    <PeerHost>172.16.15.40</PeerHost>
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
              IdRichiesta: _.getElementsByTagNameNS(
                INPS_NAMESPACE,
                "IdRichiesta"
              )
                .item(0)
                ?.textContent?.trim(),

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
                _.getElementsByTagNameNS(INPS_NAMESPACE, "DatiIndicatore").item(
                  0
                )
              )
                .map(DatiIndicatore => ({
                  DataPresentazioneDSU: DatiIndicatore.getAttribute(
                    "DataPresentazioneDSU"
                  ),

                  ProtocolloDSU: DatiIndicatore.getAttribute("ProtocolloDSU"),

                  SottoSoglia: DatiIndicatore.getAttribute("SottoSoglia"),

                  TipoIndicatore: DatiIndicatore.getAttribute("TipoIndicatore")
                }))
                .toUndefined()
            }))
            .chain(_ => {
              return ConsultazioneSogliaIndicatoreResponse.decode({
                ..._,
                DatiIndicatore: {
                  ..._.DatiIndicatore,
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
                }
              }).mapLeft(error => {
                return new Error(
                  `Unexpected response: [Error: ${readableReport(error)}]`
                );
              });
            })
            .chain(
              fromPredicate(
                _ =>
                  _.Esito === EsitoEnum.OK ||
                  _.Esito === EsitoEnum.DATI_NON_TROVATI ||
                  _.Esito === EsitoEnum.RICHIESTA_INVALIDA,
                err =>
                  new Error(
                    `INPS SOAP Error: [Esito:${err.Esito}|Message:${err.DescrizioneErrore}]`
                  )
              )
            )
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
