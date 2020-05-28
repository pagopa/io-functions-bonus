import { Context } from "@azure/functions";
import * as df from "durable-functions";
import * as express from "express";
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
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { ActivityResultSuccess } from "../EligibilityCheckActivity/handler";
import { SottoSogliaEnum } from "../generated/definitions/ConsultazioneSogliaIndicatoreResponse";
import { EligibilityCheck } from "../generated/definitions/EligibilityCheck";
import { EligibilityCheckStatusEnum } from "../generated/definitions/EligibilityCheckStatus";
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

function calculateBonus(familyMembers?: ReadonlyArray<NucleoType>): number {
  return fromNullable(familyMembers)
    .map(_1 =>
      _1.length > 2
        ? 50000
        : _1.length === 2
        ? 25000
        : _1.length === 1
        ? 15000
        : 0
    )
    .getOrElse(0);
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
        const bonusValue = calculateBonus(_.data.Componente);
        return EligibilityCheck.encode({
          family_members: _.data.Componente || [],
          max_amount: bonusValue,
          max_tax_benefit: bonusValue, // TODO: Valorize properly this value
          status:
            _.data.SottoSoglia === SottoSogliaEnum.SI
              ? EligibilityCheckStatusEnum.ELIGIBILE
              : EligibilityCheckStatusEnum.INELIGIBLE
        });
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
