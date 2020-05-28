import { Context } from "@azure/functions";
import * as df from "durable-functions";
import * as express from "express";
import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import { readableReport } from "italia-ts-commons/lib/reporters";
import {
  IResponseErrorConflict,
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorConflict,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { ActivityResultSuccess } from "../EligibilityCheckActivity/handler";
import { ConsultazioneSogliaIndicatoreResponse } from "../generated/definitions/ConsultazioneSogliaIndicatoreResponse";
import { initTelemetryClient } from "../utils/appinsights";

type IGetEligibilityCheckHandler = (
  context: Context,
  fiscalCode: FiscalCode
) => Promise<
  | IResponseSuccessJson<ConsultazioneSogliaIndicatoreResponse>
  | IResponseErrorInternal
  | IResponseErrorConflict
>;

initTelemetryClient();

export function GetEligibilityCheckHandler(): IGetEligibilityCheckHandler {
  return async (context, fiscalCode) => {
    const client = df.getClient(context);
    const status = await client.getStatus(fiscalCode);
    if (status.runtimeStatus === df.OrchestrationRuntimeStatus.Running) {
      return ResponseErrorConflict("Orchestrator already running");
    }
    return ActivityResultSuccess.decode(status.customStatus).fold<
      | IResponseErrorInternal
      | IResponseSuccessJson<ConsultazioneSogliaIndicatoreResponse>
    >(
      _ => {
        context.log.error("GetEligibilityCheck|ERROR|%s", readableReport(_));
        return ResponseErrorInternal("Invalid check status response");
      },
      _ => ResponseSuccessJson(_.data)
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
