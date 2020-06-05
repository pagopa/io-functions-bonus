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
  IResponseErrorInternal,
  IResponseSuccessAccepted,
  IResponseSuccessRedirectToResource,
  ResponseErrorInternal,
  ResponseSuccessAccepted,
  ResponseSuccessRedirectToResource
} from "italia-ts-commons/lib/responses";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { InstanceId } from "../generated/definitions/InstanceId";
import { initTelemetryClient } from "../utils/appinsights";

type IEligibilityCheckHandler = (
  context: Context,
  fiscalCode: FiscalCode
) => Promise<
  | IResponseSuccessRedirectToResource<InstanceId, InstanceId>
  | IResponseSuccessAccepted
  | IResponseErrorInternal
>;

initTelemetryClient();

export function EligibilityCheckHandler(): IEligibilityCheckHandler {
  return async (context, fiscalCode) => {
    const client = df.getClient(context);
    const status = await client.getStatus(`${fiscalCode}-BV01DSU`);
    // TODO: If a bonus request is running return status 403
    if (status.customStatus === "RUNNING") {
      return ResponseSuccessAccepted("Orchestrator already running");
    }
    try {
      await client.startNew(
        "EligibilityCheckOrchestrator",
        `${fiscalCode}-BV01DSU`,
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
    const instanceId: InstanceId = {
      id: (fiscalCode as unknown) as NonEmptyString
    };

    return ResponseSuccessRedirectToResource(
      instanceId,
      `/api/v1/bonus/vacanze/eligibility/${fiscalCode}`,
      instanceId
    );
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
