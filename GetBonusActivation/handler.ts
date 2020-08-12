import { Context } from "@azure/functions";
import * as express from "express";
import { isSome } from "fp-ts/lib/Option";
import { fromEither, tryCatch } from "fp-ts/lib/TaskEither";
import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import { RequiredParamMiddleware } from "io-functions-commons/dist/src/utils/middlewares/required_param";
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
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { BonusActivation } from "../generated/definitions/BonusActivation";
import { BonusCode } from "../generated/definitions/BonusCode";
import { InstanceId } from "../generated/definitions/InstanceId";
import { BonusActivationModel } from "../models/bonus_activation";
import { toApiBonusActivation } from "../utils/conversions";
import { checkBonusActivationIsRunning } from "./locks";

type IGetBonusActivationHandlerOutput =
  | IResponseSuccessJson<BonusActivation>
  | IResponseErrorInternal
  | IResponseErrorNotFound
  | IResponseSuccessAccepted<InstanceId>;

type IGetBonusActivationHandler = (
  context: Context,
  fiscalCode: FiscalCode,
  bonusId: BonusCode
) => Promise<IGetBonusActivationHandlerOutput>;

export function GetBonusActivationHandler(
  bonusActivationModel: BonusActivationModel
): IGetBonusActivationHandler {
  return async (context, fiscalCode, bonusId) => {
    return await tryCatch(
      () =>
        bonusActivationModel.findBonusActivationForUser(bonusId, fiscalCode),
      err => new Error(`Query error: [${err}]`)
    )
      .chain(_ =>
        fromEither(_).mapLeft(
          queryError =>
            new Error(`Query Error code=${queryError.code}|${queryError.body}`)
        )
      )
      .fold<IGetBonusActivationHandlerOutput>(
        err => {
          const error = `GetBonusActivation|ERROR|Error: [${err.message}]`;
          context.log.error(error);
          return ResponseErrorInternal(error);
        },
        maybeBonusActivation => {
          if (isSome(maybeBonusActivation)) {
            return toApiBonusActivation(maybeBonusActivation.value).fold<
              IResponseSuccessJson<BonusActivation> | IResponseErrorInternal
            >(
              err => {
                const error = `GetBonusActivation|ERROR|Conversion Error: [${readableReport(
                  err
                )}]`;
                context.log.error(error);
                return ResponseErrorInternal(error);
              },
              bonusActivation => ResponseSuccessJson(bonusActivation)
            );
          }
          return checkBonusActivationIsRunning(null).fold<
            IGetBonusActivationHandlerOutput
          >(
            // Return  not found in case no running bonus activation is found
            ResponseErrorNotFound("Not Found", "Bonus activation not found"),
            // When the bonus is not found into the database but a bonus activation
            // is still in progress for the user, we return 202 Accepted with the bonus id
            response => response
          );
        }
      )
      .run();
  };
}

export function GetBonusActivation(
  bonusActivationModel: BonusActivationModel
): express.RequestHandler {
  const handler = GetBonusActivationHandler(bonusActivationModel);

  const middlewaresWrap = withRequestMiddlewares(
    // Extract Azure Functions bindings
    ContextMiddleware(),
    FiscalCodeMiddleware,
    RequiredParamMiddleware("bonus_id", BonusCode)
  );

  return wrapRequestHandler(middlewaresWrap(handler));
}
