import { Context } from "@azure/functions";
import * as express from "express";
import { identity } from "fp-ts/lib/function";
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
  ResponseSuccessAccepted,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { BonusActivation } from "../generated/definitions/BonusActivation";
import { BonusActivationStatusEnum } from "../generated/definitions/BonusActivationStatus";
import { BonusCode } from "../generated/definitions/BonusCode";
import { InstanceId } from "../generated/definitions/InstanceId";
import { BonusActivationModel } from "../models/bonus_activation";
import { toApiBonusActivation } from "../utils/conversions";
import { cosmosErrorsToReadableMessage } from "../utils/errors";

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
    // search a bonus activation for (fiscalCode, bonusId)
    return bonusActivationModel
      .findBonusActivationForUser(bonusId, fiscalCode)
      .mapLeft<IGetBonusActivationHandlerOutput>(err => {
        const error = `GetBonusActivation|ERROR|Error: [${cosmosErrorsToReadableMessage(
          err
        )}]`;
        context.log.error(error);
        return ResponseErrorInternal(error);
      })
      .fold<IGetBonusActivationHandlerOutput>(identity, maybeBonusActivation =>
        maybeBonusActivation.map(toApiBonusActivation).fold(
          // no bonus activation is found
          ResponseErrorNotFound("Not Found", "Bonus activation not found"),
          // a bonus activation is found
          errorOrBonusActivation =>
            errorOrBonusActivation
              .map<IGetBonusActivationHandlerOutput>(bonusActivation =>
                bonusActivation.status === BonusActivationStatusEnum.PROCESSING
                  ? // if there's a bonus processing, we return the identity of the process
                    ResponseSuccessAccepted(
                      "Still running",
                      InstanceId.encode({
                        id: (bonusActivation.id as unknown) as NonEmptyString
                      })
                    )
                  : // otherwise we return the bonus activation payload
                    ResponseSuccessJson(bonusActivation)
              )
              // in case the conversion to ApiBonusActivation is failed
              .getOrElseL(err => {
                const error = `GetBonusActivation|ERROR|Conversion Error: [${readableReport(
                  err
                )}]`;
                context.log.error(error);
                return ResponseErrorInternal(error);
              })
        )
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
