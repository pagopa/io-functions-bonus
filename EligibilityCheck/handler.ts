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
  IResponseErrorForbiddenNotAuthorizedForRecipient,
  IResponseErrorInternal,
  IResponseSuccessAccepted,
  IResponseSuccessRedirectToResource,
  ResponseErrorForbiddenNotAuthorizedForRecipient,
  ResponseErrorInternal,
  ResponseSuccessAccepted,
  ResponseSuccessRedirectToResource
} from "italia-ts-commons/lib/responses";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { InstanceId } from "../generated/definitions/InstanceId";
import { activationOrchestratorSuffix } from "../StartBonusActivation/handler";
import { initTelemetryClient } from "../utils/appinsights";

export const eligibilityCheckOrchestratorSuffix = "-BV01DSU";

type IEligibilityCheckHandler = (
  context: Context,
  fiscalCode: FiscalCode
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseSuccessRedirectToResource<InstanceId, InstanceId>
  | IResponseSuccessAccepted
  | IResponseErrorInternal
  | IResponseErrorForbiddenNotAuthorizedForRecipient
>;

initTelemetryClient();

export function EligibilityCheckHandler(): IEligibilityCheckHandler {
  return async (context, fiscalCode) => {
    const client = df.getClient(context);

    // If a bonus activation for that user in in progress
    // returns 403 status response
    const activationStatus = await client.getStatus(
      `${fiscalCode}${activationOrchestratorSuffix}`
    );
    if (
      activationStatus.runtimeStatus === df.OrchestrationRuntimeStatus.Running
    ) {
      return ResponseErrorForbiddenNotAuthorizedForRecipient;
    }

    // If another ElegibilityCheck operation is in progress for that user
    // returns 202 status response
    const status = await client.getStatus(
      `${fiscalCode}${eligibilityCheckOrchestratorSuffix}`
    );
    if (status.customStatus === "RUNNING") {
      return ResponseSuccessAccepted("Orchestrator already running");
    }
    try {
      await client.startNew(
        "EligibilityCheckOrchestrator",
        `${fiscalCode}${eligibilityCheckOrchestratorSuffix}`,
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
