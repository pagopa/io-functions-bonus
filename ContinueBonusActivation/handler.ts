import { Context } from "@azure/functions";
import * as df from "durable-functions";
import * as express from "express";
import { toError } from "fp-ts/lib/Either";
import { toString } from "fp-ts/lib/function";
import {
  fromEither,
  fromLeft,
  fromPredicate,
  taskEither,
  tryCatch
} from "fp-ts/lib/TaskEither";
import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import { RequiredParamMiddleware } from "io-functions-commons/dist/src/utils/middlewares/required_param";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { BonusCode } from "../generated/definitions/BonusCode";
import { BonusActivationWithFamilyUID } from "../generated/models/BonusActivationWithFamilyUID";
import { BonusActivationModel } from "../models/bonus_activation";
import { runStartBonusActivationOrchestrator } from "../StartBonusActivation/handler";

type IContinueBonusActivationHandlerOutput =
  | IResponseSuccessJson<{ id: BonusCode }>
  | IResponseErrorNotFound
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorInternal;

type IContinueBonusActivationHandler = (
  context: Context,
  fiscalCode: FiscalCode,
  bonusId: BonusCode
) => Promise<IContinueBonusActivationHandlerOutput>;

/**
 * Start the orchestrator for a pending (processing)
 * bonus activation identified by its id (code)
 * and the applicant fiscal code.
 */
export function ContinueBonusActivationHandler(
  bonusActivationModel: BonusActivationModel,
  isBonusActivationEnabled: boolean
): IContinueBonusActivationHandler {
  return async (context, fiscalCode, bonusId) => {
    if (!isBonusActivationEnabled) {
      return ResponseErrorForbiddenNotAuthorized;
    }
    return tryCatch(
      () =>
        bonusActivationModel.findBonusActivationForUser(bonusId, fiscalCode),
      err => new Error(`Query error: [${err}]`)
    )
      .chain(_ =>
        fromEither(_).mapLeft(
          queryError => new Error(`Query Error code=${queryError.code}`)
        )
      )
      .chain<BonusActivationWithFamilyUID>(maybeBonusActivation =>
        maybeBonusActivation.fold(
          fromLeft(new Error("Bonus activation not found")),
          _ => taskEither.of(_.bonusActivation)
        )
      )
      .chain(
        fromPredicate(
          _ => _.status === "PROCESSING",
          _ => new Error("Bonus activation status is not PROCESSING")
        )
      )
      .chain(bonusActivation =>
        tryCatch(async () => {
          runStartBonusActivationOrchestrator(
            df.getClient(context),
            bonusActivation,
            fiscalCode
          );
          return bonusActivation;
        }, toError)
      )
      .fold<IContinueBonusActivationHandlerOutput>(
        err => ResponseErrorInternal(toString(err)),
        _ => ResponseSuccessJson({ id: _.id })
      )
      .run();
  };
}

export function ContinueBonusActivation(
  bonusActivationModel: BonusActivationModel,
  isBonusActivationEnabled: boolean
): express.RequestHandler {
  const handler = ContinueBonusActivationHandler(
    bonusActivationModel,
    isBonusActivationEnabled
  );
  const middlewaresWrap = withRequestMiddlewares(
    // Extract Azure Functions bindings
    ContextMiddleware(),
    FiscalCodeMiddleware,
    RequiredParamMiddleware("bonus_id", BonusCode)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
