import { Context } from "@azure/functions";
import { isAfter } from "date-fns";
import * as df from "durable-functions";
import * as express from "express";
import { isLeft, isRight } from "fp-ts/lib/Either";
import { toString } from "fp-ts/lib/function";
import { isSome } from "fp-ts/lib/Option";
import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseSuccessAccepted,
  IResponseSuccessRedirectToResource,
  ResponseErrorInternal,
  ResponseSuccessRedirectToResource
} from "italia-ts-commons/lib/responses";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { InstanceId } from "../generated/definitions/InstanceId";
import { EligibilityCheckSuccessEligible } from "../generated/models/EligibilityCheckSuccessEligible";
import { initTelemetryClient, trackException } from "../utils/appinsights";
import { makeStartEligibilityCheckOrchestratorId } from "../utils/orchestrators";
import { checkBonusActivationIsRunning } from "./locks";
import { checkEligibilityCheckIsRunning } from "./orchestrators";

type IEligibilityCheckHandler = (
  context: Context,
  fiscalCode: FiscalCode
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseSuccessRedirectToResource<InstanceId, InstanceId>
  | IResponseSuccessAccepted
  | IResponseErrorInternal
  | IResponseErrorForbiddenNotAuthorized
>;

initTelemetryClient();

/**
 * API controller: start eligibility check
 * trying to get data from INPS webservice.
 */
export function EligibilityCheckHandler(
  now: () => Date = () => new Date()
): IEligibilityCheckHandler {
  return async (context, fiscalCode) => {
    const client = df.getClient(context);

    // If a bonus activation for that user is in progress
    // returns 403 status response
    const maybeBonusActivationResponse = checkBonusActivationIsRunning(
      context.bindings.processingBonusIdIn
    );
    if (isSome(maybeBonusActivationResponse)) {
      return maybeBonusActivationResponse.value;
    }

    const instanceId: InstanceId = {
      id: (fiscalCode as unknown) as NonEmptyString
    };

    // If we already have a valid dsu for this user do not start the orchestrator
    if (context.bindings.eligibilityCheck) {
      const errorOrEligibilityCheck = EligibilityCheckSuccessEligible.decode(
        context.bindings.eligibilityCheck
      );
      if (isRight(errorOrEligibilityCheck)) {
        const eligibilityCheck = errorOrEligibilityCheck.value;
        if (isAfter(eligibilityCheck.validBefore, now())) {
          return ResponseSuccessRedirectToResource(
            instanceId,
            `/api/v1/bonus/vacanze/eligibility/${fiscalCode}`,
            instanceId
          );
        }
      }
    }

    // If another ElegibilityCheck operation is in progress for that user
    // returns 202 status response
    const maybeEligibilityCheckResponse = await checkEligibilityCheckIsRunning(
      client,
      fiscalCode
    ).run();
    if (isLeft(maybeEligibilityCheckResponse)) {
      return maybeEligibilityCheckResponse.value;
    }

    try {
      await client.startNew(
        "EligibilityCheckOrchestrator",
        makeStartEligibilityCheckOrchestratorId(fiscalCode),
        fiscalCode
      );
    } catch (err) {
      context.log.error("EligibilityCheck|ERROR|Orchestrator cannot start");

      trackException({
        exception: err,
        properties: {
          name: "bonus.eligibilitycheck.orchestrator"
        }
      });

      return ResponseErrorInternal(`Orchestrator error=${toString(err)}`);
    }

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
