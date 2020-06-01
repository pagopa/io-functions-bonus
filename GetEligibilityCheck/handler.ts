import { Context } from "@azure/functions";
import * as df from "durable-functions";
import * as express from "express";
import { rights } from "fp-ts/lib/Array";
import { fromNullable } from "fp-ts/lib/Option";
import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import { readableReport } from "italia-ts-commons/lib/reporters";
import {
  IResponseErrorInternal,
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
import { EligibilityCheckStatusEnum } from "../generated/definitions/EligibilityCheckStatus";
import { FamilyMember } from "../generated/definitions/FamilyMember";
import { FamilyMembers } from "../generated/definitions/FamilyMembers";
import { MaxBonusAmount } from "../generated/definitions/MaxBonusAmount";
import { MaxBonusTaxBenefit } from "../generated/definitions/MaxBonusTaxBenefit";
import { NucleoType } from "../generated/definitions/NucleoType";
import { initTelemetryClient } from "../utils/appinsights";

type IGetEligibilityCheckHandler = (
  context: Context,
  fiscalCode: FiscalCode
) => Promise<
  | IResponseSuccessJson<EligibilityCheck>
  | IResponseErrorInternal
  | IResponseSuccessAccepted
>;

initTelemetryClient();

function calculateBonusMaxAmount(
  familyMembers: ReadonlyArray<NucleoType>
): MaxBonusAmount {
  return (familyMembers.length > 2
    ? 50000
    : familyMembers.length === 2
    ? 25000
    : familyMembers.length === 1
    ? 15000
    : 0) as MaxBonusAmount;
}

function calculateBonuxMaxTaxBenefit(
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
      .map(_ => {
        const bonusValue = fromNullable(_.data.Componenti)
          .map(calculateBonusMaxAmount)
          .getOrElse(0 as MaxBonusAmount);

        const familyMembers: FamilyMembers = _.data.Componenti
          ? rights(
              _.data.Componenti.map(c =>
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

        if (_.data.SottoSoglia === SottoSogliaEnum.SI) {
          return EligibilityCheck.encode({
            family_members: familyMembers,
            id: (fiscalCode as unknown) as NonEmptyString,
            max_amount: bonusValue,
            max_tax_benefit: calculateBonuxMaxTaxBenefit(bonusValue),
            status: EligibilityCheckStatusEnum.ELIGIBLE
          });
        } else {
          return EligibilityCheck.encode({
            family_members: familyMembers,
            id: (fiscalCode as unknown) as NonEmptyString,
            status: EligibilityCheckStatusEnum.INELIGIBLE
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
