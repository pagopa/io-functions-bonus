import { Context } from "@azure/functions";
import * as express from "express";
import { mapAsyncIterator } from "io-functions-commons/dist/src/utils/async";
import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseSuccessJsonIterator,
  ResponseJsonIterator
} from "io-functions-commons/dist/src/utils/response";
import {
  IResponseErrorInternal,
  ResponseErrorInternal
} from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { BonusActivationItem } from "../generated/definitions/BonusActivationItem";
import { UserBonusModel } from "../models/user_bonus";
import { toApiUserBonus } from "../utils/conversions";

type IGetAllBonusActivationsHandler = (
  context: Context,
  fiscalCode: FiscalCode
) => Promise<
  IResponseSuccessJsonIterator<BonusActivationItem> | IResponseErrorInternal
>;

export function GetAllBonusActivationsHandler(
  userBonusModel: UserBonusModel
): IGetAllBonusActivationsHandler {
  return (_, fiscalCode) => {
    return userBonusModel
      .findBonusActivations(fiscalCode)
      .fold<
        | IResponseSuccessJsonIterator<BonusActivationItem>
        | IResponseErrorInternal
      >(
        err => {
          return ResponseErrorInternal(err.kind); // TODO: Fix title response
        },
        userBonusActivationsIterator => {
          const bonusActivations = mapAsyncIterator(
            userBonusActivationsIterator, // TODO: Build error type mismatch
            toApiUserBonus
          );
          return ResponseJsonIterator(bonusActivations);
        }
      )
      .run();
  };
}

export function GetAllBonusActivations(
  userBonusModel: UserBonusModel
): express.RequestHandler {
  const handler = GetAllBonusActivationsHandler(userBonusModel);

  const middlewaresWrap = withRequestMiddlewares(
    // Extract Azure Functions bindings
    ContextMiddleware(),
    FiscalCodeMiddleware
  );

  return wrapRequestHandler(middlewaresWrap(handler));
}
