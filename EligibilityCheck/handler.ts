import { Context } from "@azure/functions";
import * as df from "durable-functions";
import * as express from "express";
import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorConflict,
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorConflict,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { initTelemetryClient } from "../utils/appinsights";

type IEligibilityCheckHandler = (
  context: Context,
  fiscalCode: FiscalCode
) => Promise<
  | IResponseSuccessJson<FiscalCode>
  | IResponseErrorInternal
  | IResponseErrorConflict
>;

initTelemetryClient();

export function EligibilityCheckHandler(): IEligibilityCheckHandler {
  return async (context, fiscalCode) => {
    const client = df.getClient(context);
    const status = await client.getStatus(fiscalCode);
    if (status.runtimeStatus === df.OrchestrationRuntimeStatus.Running) {
      return ResponseErrorConflict("Orchestrator already running");
    }
    try {
      await client.startNew(
        "EligibilityCheckOrchestrator",
        fiscalCode,
        fiscalCode
      );
    } catch (err) {
      context.log.error(
        "EligibilityCheck|ERROR|Orchestrator cannot start (status=%s)",
        status
      );
      return ResponseErrorInternal(
        `Orchestrator error=${err} status=${status}`
      );
    }
    return ResponseSuccessJson(fiscalCode);
  };
}

export function EligibilityCheck(): express.RequestHandler {
  const handler = EligibilityCheckHandler();

  const middlewaresWrap = withRequestMiddlewares(
    // Extract Azure Functions bindings
    ContextMiddleware(),
    FiscalCodeMiddleware
  );

  return wrapRequestHandler(middlewaresWrap(handler));
}
