import { Context } from "@azure/functions";
import * as express from "express";
import { isRight } from "fp-ts/lib/Either";
import {
  filterAsyncIterator,
  flattenAsyncIterator,
  mapAsyncIterator
} from "io-functions-commons/dist/src/utils/async";
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
import { isDefined } from "io-functions-commons/dist/src/utils/types";
import {
  IResponseErrorInternal,
  ResponseErrorInternal
} from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { BonusActivationItem } from "../generated/definitions/BonusActivationItem";
import { UserBonusModel } from "../models/user_bonus";
import { toApiUserBonus } from "../utils/conversions";
import { cosmosErrorsToReadableMessage } from "../utils/errors";

type IGetAllBonusActivationsHandler = (
  context: Context,
  fiscalCode: FiscalCode
) => Promise<
  IResponseSuccessJsonIterator<BonusActivationItem> | IResponseErrorInternal
>;

export function GetAllBonusActivationsHandler(
  userBonusModel: UserBonusModel
): IGetAllBonusActivationsHandler {
  return (context, fiscalCode) => {
    return userBonusModel
      .findBonusActivations(fiscalCode)
      .map(flattenAsyncIterator)
      .fold<
        | IResponseSuccessJsonIterator<BonusActivationItem>
        | IResponseErrorInternal
      >(
        err => {
          context.log.error(
            `GetAllBonusActivations|ERROR|Query Error: [${cosmosErrorsToReadableMessage(
              err
            )}]`
          );
          return ResponseErrorInternal(
            "Internal Server Error on findBonusActivations"
          );
        },
        userBonusActivationsIterator => {
          const bonusActivations = filterAsyncIterator(
            mapAsyncIterator(userBonusActivationsIterator, val =>
              isRight(val) ? toApiUserBonus(val.value) : undefined
            ),
            (val): val is BonusActivationItem => isDefined(val)
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
