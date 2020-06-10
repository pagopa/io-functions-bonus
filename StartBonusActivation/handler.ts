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
  IResponseSuccessAccepted,
  IResponseSuccessRedirectToResource,
  ResponseErrorConflict,
  ResponseSuccessAccepted
} from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { makeStartBonusActivationOrchestratorId } from "../utils/orchestrators";

type IStartBonusActivationHandler = (
  context: Context,
  fiscalCode: FiscalCode
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseSuccessAccepted
  // TODO: Add types
  | IResponseSuccessRedirectToResource<unknown, unknown>
  | IResponseErrorInternal
  | IResponseErrorConflict
>;

export function StartBonusActivationHandler(): IStartBonusActivationHandler {
  return async (context, fiscalCode) => {
    // TODO: Add implementation
    const client = df.getClient(context);
    const status = await client.getStatus(
      makeStartBonusActivationOrchestratorId(fiscalCode)
    );
    if (status.runtimeStatus === df.OrchestrationRuntimeStatus.Running) {
      return ResponseSuccessAccepted();
    }
    return ResponseErrorConflict("Implementation missing");
  };
}

export function StartBonusActivation(): express.RequestHandler {
  const handler = StartBonusActivationHandler();

  const middlewaresWrap = withRequestMiddlewares(
    // Extract Azure Functions bindings
    ContextMiddleware(),
    FiscalCodeMiddleware
  );

  return wrapRequestHandler(middlewaresWrap(handler));
}
