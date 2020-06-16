import { Context } from "@azure/functions";
import * as df from "durable-functions";
import * as express from "express";
import { toError } from "fp-ts/lib/Either";
import { tryCatch } from "fp-ts/lib/TaskEither";
import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { makeStartBonusActivationOrchestratorId } from "../utils/orchestrators";

type IContinueBonusActivationHandlerOutput =
  | IResponseSuccessJson<{ message: "ok" }>
  | IResponseErrorInternal;

type IContinueBonusActivationHandler = (
  context: Context,
  fiscalCode: FiscalCode
) => Promise<IContinueBonusActivationHandlerOutput>;

export function ContinueBonusActivationHandler(): IContinueBonusActivationHandler {
  return async (context, fiscalCode) => {
    const client = df.getClient(context);
    return tryCatch(
      () =>
        client.raiseEvent(
          makeStartBonusActivationOrchestratorId(fiscalCode),
          "ContinueBonusActivation",
          true
        ),
      toError
    )
      .fold<IContinueBonusActivationHandlerOutput>(
        err => ResponseErrorInternal(JSON.stringify(err)),
        _ => ResponseSuccessJson({ message: "ok" })
      )
      .run();
  };
}

export function ContinueBonusActivation(): express.RequestHandler {
  const handler = ContinueBonusActivationHandler();
  const middlewaresWrap = withRequestMiddlewares(
    // Extract Azure Functions bindings
    ContextMiddleware(),
    FiscalCodeMiddleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
