import { Context } from "@azure/functions";
import * as express from "express";
import { mapResultIterator } from "io-functions-commons/dist/src/utils/documentdb";
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
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { BonusActivationItem } from "../generated/definitions/BonusActivationItem";
import { UserBonusModel } from "../models/user_bonus";
import { toApiUserBonus } from "../utils/conversions";

type IGetAllBonusActivationsHandler = (
  context: Context,
  fiscalCode: FiscalCode
) => Promise<IResponseSuccessJsonIterator<BonusActivationItem>>;

export function GetAllBonusActivationsHandler(
  userBonusModel: UserBonusModel
): IGetAllBonusActivationsHandler {
  return async (_, fiscalCode) => {
    const userBonusActivationsIterator = userBonusModel.findBonusActivations(
      fiscalCode
    );
    const bonusActivations = mapResultIterator(
      userBonusActivationsIterator,
      toApiUserBonus
    );
    return ResponseJsonIterator(bonusActivations);
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
