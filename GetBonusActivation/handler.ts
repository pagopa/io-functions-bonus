import { Context } from "@azure/functions";
import * as df from "durable-functions";
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
  ResponseSuccessAccepted,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { BonusActivation } from "../generated/definitions/BonusActivation";
import { BonusCode } from "../generated/definitions/BonusCode";
import { BonusActivationModel } from "../models/bonus_activation";
import { toApiBonusActivation } from "../utils/conversions";
import { makeStartBonusActivationOrchestratorId } from "../utils/orchestrators";

type IGetBonusActivationHandler = (
  context: Context,
  fiscalCode: FiscalCode,
  bonusId: BonusCode
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseSuccessJson<BonusActivation>
  | IResponseErrorInternal
  | IResponseErrorNotFound
  | IResponseSuccessAccepted
>;

export function GetBonusActivationHandler(
  bonusActivationModel: BonusActivationModel
): IGetBonusActivationHandler {
  return async (context, fiscalCode, bonusId) => {
    const client = df.getClient(context);
    const status = await client.getStatus(
      makeStartBonusActivationOrchestratorId(fiscalCode)
    );
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
      .fold<
        // tslint:disable-next-line: max-union-size
        | IResponseSuccessJson<BonusActivation>
        | IResponseErrorInternal
        | IResponseErrorNotFound
        | IResponseSuccessAccepted
      >(
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
          // When the bonus is not found into the database and a new bonus activation
          // is in progress for the user, an Accepted response with status 202 will be returned.
          // Otherwise a NonFound response with status 404.
          if (status.runtimeStatus === df.OrchestrationRuntimeStatus.Running) {
            return ResponseSuccessAccepted("Still running");
          }
          return ResponseErrorNotFound(
            "Not Found",
            "Bonus activation not found"
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
