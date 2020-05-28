import { format } from "date-fns";
import { fromNullable } from "fp-ts/lib/Either";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import fetch from "node-fetch";
import { DOMParser } from "xmldom";
import { ConsultazioneSogliaIndicatoreInput } from "../generated/definitions/ConsultazioneSogliaIndicatoreInput";
import { ConsultazioneSogliaIndicatoreResponse } from "../generated/definitions/ConsultazioneSogliaIndicatoreResponse";

const SOAP_REQUEST_TEMPLATE = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:con="http://inps.it/ConsultazioneISEE">
<soapenv:Header/>
<soapenv:Body>
  <con:ConsultazioneSogliaIndicatoreRequest>
    <con:Richiesta DataValidita="{dataValidita}" CodiceFiscale="{fiscalCode}" FornituraNucleo="{fornituraNucleo}" CodiceSoglia="{codiceSoglia}"/>
  </con:ConsultazioneSogliaIndicatoreRequest>
</soapenv:Body>
</soapenv:Envelope>`;

const INPS_NAMESPACE = "http://inps.it/ConsultazioneISEE";

export interface ISoapClientAsync {
  ConsultazioneSogliaIndicatore: (
    params: ConsultazioneSogliaIndicatoreInput
  ) => TaskEither<Error, ConsultazioneSogliaIndicatoreResponse>;
}

export function createClient(
  INPS_SERVICE_HOST: NonEmptyString,
  endpoint: NonEmptyString
): ISoapClientAsync {
  return {
    ConsultazioneSogliaIndicatore: (
      params: ConsultazioneSogliaIndicatoreInput
    ) => {
      return tryCatch(
        async () => {
          const requestPayload = SOAP_REQUEST_TEMPLATE.replace(
            "{fiscalCode}",
            params.CodiceFiscale
          )
            .replace("{fornituraNucleo}", params.FornituraNucleo)
            .replace("{codiceSoglia}", params.CodiceSoglia)
            .replace(
              "{dataValidita}",
              params.DataValidita || format(new Date(), "yyyy-MM-dd")
            );
          const response = await fetch(`${INPS_SERVICE_HOST}${endpoint}`, {
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
                  Componente: Array.from(
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
        },
        err => err as Error
      );
    }
  };
}
