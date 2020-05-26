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
import { InstanceId } from "../generated/definitions/InstanceId";

type IVerificaSogliaHandler = (
  context: Context,
  registerPaymentNotify: FiscalCode
) => Promise<
  | IResponseSuccessJson<InstanceId>
  | IResponseErrorInternal
  | IResponseErrorConflict
>;

export function VerificaSogliaHandler(): IVerificaSogliaHandler {
  return async (context, fiscalCode) => {
    const client = df.getClient(context);
    const response = client.createCheckStatusResponse(
      context.bindingData.req,
      fiscalCode
    );
    try {
      await client.startNew(
        "VerificaSogliaOrchestrator",
        fiscalCode,
        fiscalCode
      );
    } catch (err) {
      context.log.error("VerificaSoglia|ERROR|Orchestrator already running");
      return ResponseErrorConflict("Orchestrator already running");
    }
    return InstanceId.decode(response.body).fold<
      IResponseErrorInternal | IResponseSuccessJson<InstanceId>
    >(
      _ => ResponseErrorInternal("Invalid check status response"),
      _ => ResponseSuccessJson(_)
    );
  };
}

export function VerificaSoglia(): express.RequestHandler {
  const handler = VerificaSogliaHandler();

  const middlewaresWrap = withRequestMiddlewares(
    // Extract Azure Functions bindings
    ContextMiddleware(),
    FiscalCodeMiddleware
  );

  return wrapRequestHandler(middlewaresWrap(handler));
}
