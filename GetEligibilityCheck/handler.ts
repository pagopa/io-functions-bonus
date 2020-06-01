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
import { ActivityResultSuccess } from "../EligibilityCheckActivity/handler";
import { SottoSogliaEnum } from "../generated/definitions/ConsultazioneSogliaIndicatoreResponse";
import { EligibilityCheck } from "../generated/definitions/EligibilityCheck";
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
    const status = await client.getStatus(fiscalCode);
    if (status.runtimeStatus === df.OrchestrationRuntimeStatus.Running) {
      return ResponseSuccessAccepted("Orchestrator already running");
    }
    return ActivityResultSuccess.decode(status.customStatus)
      .map(({ data }) => {
        const bonusValue = calculateMaxBonusAmount(
          data.Componenti ? data.Componenti.length : 0
        );

        const familyMembers: FamilyMembers = data.Componenti
          ? rights(
              data.Componenti.map(c =>
                FamilyMember.decode({
                  fiscal_code: c.CodiceFiscale,
                  name: c.Nome,
                  surname: c.Cognome
                })
              )
            )
          : [];

        // TODO: return EligibilityCheckFailure in case the INPS / ISEE
        // request has returned an error, see https://www.pivotaltracker.com/story/show/173106258

        if (data.SottoSoglia === SottoSogliaEnum.SI) {
          return EligibilityCheckSuccessEligible.encode({
            family_members: familyMembers,
            id: (fiscalCode as unknown) as NonEmptyString,
            max_amount: bonusValue,
            max_tax_benefit: calculateMaxBonusTaxBenefit(bonusValue),
            status: EligibleStatus.ELIGIBLE
          });
        } else {
          return EligibilityCheckSuccessIneligible.encode({
            id: (fiscalCode as unknown) as NonEmptyString,
            status: IneligibleStatus.INELIGIBLE
          });
        }
      })
      .fold<
        | IResponseErrorInternal
        | IResponseSuccessAccepted
        | IResponseSuccessJson<EligibilityCheck>
      >(
        _ => {
          context.log.error("GetEligibilityCheck|ERROR|%s", readableReport(_));
          return ResponseErrorInternal("Invalid check status response");
        },
        _ => ResponseSuccessJson(_)
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
