import { Context } from "@azure/functions";
import * as df from "durable-functions";
import * as express from "express";
import { fromEither, fromLeft, taskEither } from "fp-ts/lib/TaskEither";
import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorConflict,
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorGone,
  IResponseErrorInternal,
  IResponseSuccessAccepted,
  IResponseSuccessRedirectToResource,
  ResponseErrorInternal,
  ResponseSuccessRedirectToResource
} from "italia-ts-commons/lib/responses";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { BonusActivationModel } from "../models/bonus_activation";
import { EligibilityCheckModel } from "../models/eligibility_check";

import { identity } from "fp-ts/lib/function";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { ContinueBonusActivationInput } from "../ContinueBonusActivation";
import { BonusActivation as ApiBonusActivation } from "../generated/definitions/BonusActivation";
import { InstanceId } from "../generated/definitions/InstanceId";
import { BonusLeaseModel } from "../models/bonus_lease";
import { BonusProcessing } from "../models/bonus_processing";
import { trackException } from "../utils/appinsights";
import { toApiBonusActivation } from "../utils/conversions";
import { generateFamilyUID } from "../utils/hash";
import { checkBonusActivationIsRunning } from "./locks";
import {
  acquireLockForUserFamily,
  createBonusActivation,
  getLatestValidDSU,
  IApiBonusActivationWithValidBefore,
  relaseLockForUserFamily
} from "./models";
import { checkEligibilityCheckIsRunning } from "./orchestrators";
import { makeBonusActivationResourceUri } from "./utils";

// when creating the document on cosmos, the logic will retry in case of a
// (very unlikely) conflict with an existing bonus with the same BonusID

type StartBonusActivationResponse =
  | IResponseErrorInternal
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorGone
  | IResponseErrorConflict
  | IResponseSuccessAccepted<InstanceId>
  | IResponseSuccessRedirectToResource<ApiBonusActivation, InstanceId>;

type IStartBonusActivationHandler = (
  context: Context,
  fiscalCode: FiscalCode
) => Promise<StartBonusActivationResponse>;

export function StartBonusActivationHandler(
  bonusActivationModel: BonusActivationModel,
  bonusLeaseModel: BonusLeaseModel,
  eligibilityCheckModel: EligibilityCheckModel
): IStartBonusActivationHandler {
  return async (context, fiscalCode) => {
    const dfClient = df.getClient(context);

    return taskEither
      .of<StartBonusActivationResponse, void>(void 0)
      .chainSecond(checkEligibilityCheckIsRunning(dfClient, fiscalCode))
      .chainSecond(
        checkBonusActivationIsRunning(context.bindings.processingBonusIdIn)
      )
      .chainSecond(getLatestValidDSU(eligibilityCheckModel, fiscalCode))
      .map(eligibilityCheck => ({
        eligibilityCheck,
        familyUID: generateFamilyUID(eligibilityCheck.dsuRequest.familyMembers)
      }))
      .chain(({ eligibilityCheck, familyUID }) =>
        acquireLockForUserFamily(bonusLeaseModel, familyUID).map(_ => ({
          eligibilityCheck,
          familyUID
        }))
      )
      .chain<IApiBonusActivationWithValidBefore>(
        ({ eligibilityCheck, familyUID }) =>
          createBonusActivation(
            bonusActivationModel,
            fiscalCode,
            familyUID,
            eligibilityCheck.dsuRequest
          )
            .chain(bonusActivation =>
              fromEither(toApiBonusActivation(bonusActivation))
                .mapLeft(err =>
                  ResponseErrorInternal(
                    `Error converting BonusActivation to ApiBonusActivation: ${readableReport(
                      err
                    )}`
                  )
                )
                .map(apiBonusActivation => ({
                  apiBonusActivation,
                  validBefore: eligibilityCheck.validBefore
                }))
            )
            .foldTaskEither(
              // bonus creation failed
              response => {
                trackException({
                  exception: new Error(response.detail),
                  properties: {
                    name: "bonus.activation.start"
                  }
                });
                return relaseLockForUserFamily(
                  bonusLeaseModel,
                  familyUID
                ).foldTaskEither(
                  _ => fromLeft(response),
                  _ => fromLeft(response)
                );
              },
              // bonus creation succeeded
              bonusActivationWithValidBefore =>
                taskEither.of(bonusActivationWithValidBefore)
            )
      )
      .fold(identity, ({ apiBonusActivation, validBefore }) => {
        // Add the tuple (fiscalCode, bonusId) to the processing bonus collection
        // this is used a s lock to avoid having more than one bonus in processing status
        // The lock is removed when the orchestrator terminate
        // tslint:disable-next-line: no-object-mutation
        context.bindings.processingBonusIdOut = BonusProcessing.encode({
          bonusId: apiBonusActivation.id,
          id: apiBonusActivation.applicant_fiscal_code
        });
        // Send the (bonusId, applicantFiscalCode) to the bonus activations queue
        // in order to be processed later (asynchronously)
        // tslint:disable-next-line: no-object-mutation
        context.bindings.bonusActivation = ContinueBonusActivationInput.encode({
          applicantFiscalCode: apiBonusActivation.applicant_fiscal_code,
          bonusId: apiBonusActivation.id,
          validBefore
        });
        return ResponseSuccessRedirectToResource(
          apiBonusActivation,
          makeBonusActivationResourceUri(fiscalCode, apiBonusActivation.id),
          InstanceId.encode({
            id: (apiBonusActivation.id as unknown) as NonEmptyString
          })
        );
      })
      .run();
  };
}

export function StartBonusActivation(
  bonusActivationModel: BonusActivationModel,
  bonusLeaseModel: BonusLeaseModel,
  eligibilityCheckModel: EligibilityCheckModel
): express.RequestHandler {
  const handler = StartBonusActivationHandler(
    bonusActivationModel,
    bonusLeaseModel,
    eligibilityCheckModel
  );
  const middlewaresWrap = withRequestMiddlewares(
    // Extract Azure Functions bindings
    ContextMiddleware(),
    FiscalCodeMiddleware
  );

  return wrapRequestHandler(middlewaresWrap(handler));
}
