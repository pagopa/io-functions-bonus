import { Context } from "@azure/functions";
import * as df from "durable-functions";
import * as express from "express";
import { rights } from "fp-ts/lib/Array";
import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import { readableReport } from "italia-ts-commons/lib/reporters";
import {
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseSuccessAccepted,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessAccepted,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { eligibilityCheckOrchestratorSuffix } from "../EligibilityCheck/handler";
import { ActivityResultSuccess } from "../EligibilityCheckActivity/handler";
import { EsitoEnum } from "../generated/definitions/ConsultazioneSogliaIndicatoreResponse";
import { EligibilityCheck } from "../generated/definitions/EligibilityCheck";
import {
  EligibilityCheckFailure,
  ErrorEnum
} from "../generated/definitions/EligibilityCheckFailure";
import {
  EligibilityCheckSuccessEligible,
  StatusEnum as EligibleStatus
} from "../generated/definitions/EligibilityCheckSuccessEligible";
import {
  EligibilityCheckSuccessIneligible,
  StatusEnum as IneligibleStatus
} from "../generated/definitions/EligibilityCheckSuccessIneligible";
import { FamilyMember } from "../generated/definitions/FamilyMember";
import { FamilyMembers } from "../generated/definitions/FamilyMembers";
import { MaxBonusAmount } from "../generated/definitions/MaxBonusAmount";
import { MaxBonusTaxBenefit } from "../generated/definitions/MaxBonusTaxBenefit";
import { SiNoTypeEnum } from "../generated/definitions/SiNoType";
import { initTelemetryClient } from "../utils/appinsights";

type IGetEligibilityCheckHandler = (
  context: Context,
  fiscalCode: FiscalCode
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseSuccessAccepted
  | IResponseSuccessJson<EligibilityCheck>
  | IResponseErrorInternal
  | IResponseErrorNotFound
>;

initTelemetryClient();

function calculateMaxBonusAmount(
  numberOfFamilyMembers: number
): MaxBonusAmount {
  return (numberOfFamilyMembers > 2
    ? 50000
    : numberOfFamilyMembers === 2
    ? 25000
    : numberOfFamilyMembers === 1
    ? 15000
    : 0) as MaxBonusAmount;
}

function calculateMaxBonusTaxBenefit(
  maxBonusAmount: MaxBonusAmount
): MaxBonusTaxBenefit {
  return (maxBonusAmount / 5) as MaxBonusTaxBenefit;
}

// tslint:disable-next-line: cognitive-complexity
export function GetEligibilityCheckHandler(): IGetEligibilityCheckHandler {
  return async (context, fiscalCode) => {
    const client = df.getClient(context);
    const status = await client.getStatus(
      `${fiscalCode}${eligibilityCheckOrchestratorSuffix}`
    );
    if (status.customStatus === "RUNNING") {
      return ResponseSuccessAccepted("Orchestrator already running");
    }
    // TODO: Read DSU from cosmos
    return ActivityResultSuccess.decode(status.customStatus)
      .map(({ data, validBefore }) => {
        const bonusValue = calculateMaxBonusAmount(
          data.DatiIndicatore?.Componenti
            ? data.DatiIndicatore.Componenti.length
            : 0
        );

        const familyMembers: FamilyMembers = data.DatiIndicatore?.Componenti
          ? rights(
              data.DatiIndicatore.Componenti.map(c =>
                FamilyMember.decode({
                  fiscal_code: c.CodiceFiscale,
                  name: c.Nome,
                  surname: c.Cognome
                })
              )
            )
          : [];

        if (data.Esito !== EsitoEnum.OK) {
          return EligibilityCheckFailure.encode({
            error:
              data.Esito === EsitoEnum.DATI_NON_TROVATI
                ? ErrorEnum.DATA_NOT_FOUND
                : data.Esito === EsitoEnum.RICHIESTA_INVALIDA
                ? ErrorEnum.INVALID_REQUEST
                : ErrorEnum.INTERNAL_ERROR,
            error_description:
              data.DescrizioneErrore || "Esito value is not OK",
            id: (fiscalCode as unknown) as NonEmptyString
          });
        }

        if (data.DatiIndicatore?.SottoSoglia === SiNoTypeEnum.SI) {
          return EligibilityCheckSuccessEligible.encode({
            dsu_created_at: data.DatiIndicatore.DataPresentazioneDSU,
            dsu_protocol_id: (data.DatiIndicatore.ProtocolloDSU ||
              "") as NonEmptyString,
            family_members: familyMembers,
            has_discrepancies:
              data.DatiIndicatore.PresenzaDifformita === SiNoTypeEnum.SI,
            id: (fiscalCode as unknown) as NonEmptyString,
            isee_type: data.DatiIndicatore.TipoIndicatore,
            max_amount: bonusValue,
            max_tax_benefit: calculateMaxBonusTaxBenefit(bonusValue),
            request_id: data.IdRichiesta.toString() as NonEmptyString,
            status: EligibleStatus.ELIGIBLE,
            valid_before: validBefore
          });
        } else {
          return EligibilityCheckSuccessIneligible.encode({
            id: (fiscalCode as unknown) as NonEmptyString,
            status: IneligibleStatus.INELIGIBLE
          });
        }
      })
      .fold<
        Promise<
          | IResponseErrorInternal
          | IResponseSuccessAccepted
          | IResponseSuccessJson<EligibilityCheck>
        >
      >(
        async _ => {
          context.log.error("GetEligibilityCheck|ERROR|%s", readableReport(_));
          return ResponseErrorInternal("Invalid check status response");
        },
        async _ => {
          // Since we're sending the result to the frontend,
          // we stop the orchestrator here in order to avoid
          // sending a push notification with the same result
          await client.terminate(
            `${fiscalCode}${eligibilityCheckOrchestratorSuffix}`,
            "Success"
          );
          // TODO: Check casting below
          return ResponseSuccessJson(_ as EligibilityCheck);
        }
      );
  };
}

export function GetEligibilityCheck(): express.RequestHandler {
  const handler = GetEligibilityCheckHandler();

  const middlewaresWrap = withRequestMiddlewares(
    // Extract Azure Functions bindings
    ContextMiddleware(),
    FiscalCodeMiddleware
  );

  return wrapRequestHandler(middlewaresWrap(handler));
}
