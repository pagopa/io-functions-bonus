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
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseSuccessAccepted,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseSuccessAccepted,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { EligibilityCheck } from "../generated/definitions/EligibilityCheck";
import { EligibilityCheckSuccessEligible } from "../generated/definitions/EligibilityCheckSuccessEligible";
import { EligibilityCheckModel } from "../models/eligibility_check";
import { initTelemetryClient } from "../utils/appinsights";
import { toApiEligibilityCheck } from "../utils/conversions";
import { makeStartEligibilityCheckOrchestratorId } from "../utils/orchestrators";
import { IResponseErrorGone, ResponseErrorGone } from "../utils/responses";

type IGetEligibilityCheckHandler = (
  context: Context,
  fiscalCode: FiscalCode
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseSuccessAccepted
  | IResponseSuccessJson<EligibilityCheck>
  | IResponseErrorInternal
  | IResponseErrorNotFound
  | IResponseErrorGone
>;

initTelemetryClient();

export function GetEligibilityCheckHandler(
  eligibilityCheckModel: EligibilityCheckModel
): IGetEligibilityCheckHandler {
  return async (context, fiscalCode) => {
    const client = df.getClient(context);
    const status = await client.getStatus(
      makeStartEligibilityCheckOrchestratorId(fiscalCode)
    );
    if (status.customStatus === "RUNNING") {
      return ResponseSuccessAccepted("Still running");
    }
    const eligibilityCheckDocument = await eligibilityCheckModel.find(
      fiscalCode,
      fiscalCode
    );
    return eligibilityCheckDocument.fold<
      Promise<
        // tslint:disable-next-line: max-union-size
        | IResponseErrorInternal
        | IResponseSuccessAccepted
        | IResponseSuccessJson<EligibilityCheck>
        | IResponseErrorNotFound
        | IResponseErrorGone
      >
    >(
      async queryError => {
        context.log.error("GetEligibilityCheck|ERROR|%s", queryError);
        return ResponseErrorInternal("Query error retrieving DSU");
      },
      async maybeModelEligibilityCheck => {
        if (maybeModelEligibilityCheck.isNone()) {
          return ResponseErrorNotFound("Not Found", "DSU not found");
        }

        // Since we're sending the result to the frontend,
        // we stop the orchestrator here in order to avoid
        // sending a push notification with the same result
        if (status.runtimeStatus === df.OrchestrationRuntimeStatus.Running) {
          await client.terminate(
            makeStartEligibilityCheckOrchestratorId(fiscalCode),
            "Success"
          );
        }

        return toApiEligibilityCheck(maybeModelEligibilityCheck.value).fold<
          | IResponseErrorInternal
          | IResponseSuccessJson<EligibilityCheck>
          | IResponseErrorGone
        >(
          err => {
            return ResponseErrorInternal(
              `Conversion error: [${readableReport(err)}]`
            );
          },
          response => {
            if (
              EligibilityCheckSuccessEligible.is(response) &&
              response.valid_before < new Date()
            ) {
              return ResponseErrorGone("Eligibility check expired");
            }
            return ResponseSuccessJson(response);
          }
        );
      }
    );
  };
}

export function GetEligibilityCheck(
  eligibilityCheckModel: EligibilityCheckModel
): express.RequestHandler {
  const handler = GetEligibilityCheckHandler(eligibilityCheckModel);

  const middlewaresWrap = withRequestMiddlewares(
    // Extract Azure Functions bindings
    ContextMiddleware(),
    FiscalCodeMiddleware
  );

  return wrapRequestHandler(middlewaresWrap(handler));
}
