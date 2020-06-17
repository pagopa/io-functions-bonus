import { Context } from "@azure/functions";
import * as df from "durable-functions";
import * as express from "express";
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
  IResponseErrorGone,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseSuccessAccepted,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorGone,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseSuccessAccepted
} from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { BonusCode } from "../generated/definitions/BonusCode";
import { BonusActivationWithFamilyUID } from "../generated/models/BonusActivationWithFamilyUID";
import { BonusActivationModel } from "../models/bonus_activation";
import { runStartBonusActivationOrchestrator } from "../StartBonusActivation/handler";

type IContinueBonusActivationHandlerOutput =
  | IResponseSuccessAccepted
  | IResponseErrorNotFound
  | IResponseErrorGone
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
      err =>
        // Promise rejected or thrown
        ResponseErrorInternal(
          `Query error: [${err}]`
        ) as IContinueBonusActivationHandlerOutput
    )
      .chain(_ =>
        // CosmosDB query error
        fromEither(_).mapLeft(queryError =>
          ResponseErrorInternal(`Query Error code=${queryError.code}`)
        )
      )
      .chain<BonusActivationWithFamilyUID>(maybeBonusActivation =>
        maybeBonusActivation.fold(
          fromLeft(
            ResponseErrorNotFound("Not found", "Bonus activation not found")
          ),
          _ => taskEither.of(_.bonusActivation)
        )
      )
      .chain(
        fromPredicate(
          _ => _.status === "PROCESSING",
          _ => ResponseErrorGone("Bonus activation status is not PROCESSING")
        )
      )
      .chain(bonusActivation =>
        tryCatch(
          async () => {
            runStartBonusActivationOrchestrator(
              df.getClient(context),
              bonusActivation,
              fiscalCode
            );
            return bonusActivation;
          },
          err => ResponseErrorInternal(toString(err))
        )
      )
      .fold<IContinueBonusActivationHandlerOutput>(
        err => err,
        _ => ResponseSuccessAccepted()
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
