import { Context } from "@azure/functions";
import * as df from "durable-functions";
import * as express from "express";
import { Option } from "fp-ts/lib/Option";
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
import { BonusActivation as ApiBonusActivation } from "../generated/definitions/BonusActivation";
import { InstanceId } from "../generated/definitions/InstanceId";
import { BonusLeaseModel } from "../models/bonus_lease";
import {
  BonusProcessing,
  BonusProcessingModel
} from "../models/bonus_processing";
import { trackException } from "../utils/appinsights";
import { toApiBonusActivation } from "../utils/conversions";
import { generateFamilyUID } from "../utils/hash";
import { checkBonusActivationIsRunning } from "./locks";
import {
  acquireLockForUserFamily,
  createBonusActivation,
  EnqueueBonusActivationT,
  getBonusProcessing,
  getLatestValidDSU,
  IApiBonusActivationWithValidBefore,
  relaseLockForUserFamily,
  saveBonusProcessing
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
  bonusProcessingModel: BonusProcessingModel,
  eligibilityCheckModel: EligibilityCheckModel,
  enqueueBonusActivation: EnqueueBonusActivationT
): IStartBonusActivationHandler {
  return async (context, fiscalCode) => {
    const dfClient = df.getClient(context);

    return taskEither
      .of<StartBonusActivationResponse, void>(void 0)
      .chainSecond(checkEligibilityCheckIsRunning(dfClient, fiscalCode))
      .chainSecond(
        getBonusProcessing(bonusProcessingModel, fiscalCode)
          .foldTaskEither<
            IResponseErrorInternal | IResponseSuccessAccepted<InstanceId>,
            Option<BonusProcessing>
          >(
            err => {
              context.log.warn(
                `StartBonusActivationHandler|WARN|Failed reading BonusProcessing|ERR=${JSON.stringify(
                  err
                )}`
              );
              return fromLeft(
                ResponseErrorInternal("Failed reading BonusProcessing")
              );
            },
            _ => taskEither.of(_)
          )
          .chain(maybeBonusProcessing =>
            checkBonusActivationIsRunning(maybeBonusProcessing)
          )
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
            // Send the (bonusId, applicantFiscalCode) to the bonus activations queue
            // in order to be processed later (asynchronously)
            .chain(({ apiBonusActivation, validBefore }) =>
              enqueueBonusActivation({
                applicantFiscalCode: apiBonusActivation.applicant_fiscal_code,
                bonusId: apiBonusActivation.id,
                validBefore
              }).map(_ => ({ apiBonusActivation, validBefore }))
            )
            .foldTaskEither(
              // bonus creation failed
              // or enqueue failed
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
      .chain(({ apiBonusActivation }) => {
        // Add the tuple (fiscalCode, bonusId) to the processing bonus collection
        // this is used a s lock to avoid having more than one bonus in processing status
        // The lock is removed when the orchestrator terminate
        return (
          saveBonusProcessing(
            bonusProcessingModel,
            BonusProcessing.encode({
              bonusId: apiBonusActivation.id,
              id: apiBonusActivation.applicant_fiscal_code
            })
          )
            // Either case, we ignore eventual error on bonus processing
            // and pass the activation object forward
            .foldTaskEither(
              err => {
                context.log.warn(
                  `StartBonusActivationHandler|WARN|Failed saving BonusProcessing for fiscalCode: ${fiscalCode}. Reason: ${JSON.stringify(
                    err
                  )}`
                );
                return taskEither.of(apiBonusActivation);
              },
              _ => taskEither.of(apiBonusActivation)
            )
        );
      })
      .fold(identity, apiBonusActivation =>
        ResponseSuccessRedirectToResource(
          apiBonusActivation,
          makeBonusActivationResourceUri(fiscalCode, apiBonusActivation.id),
          InstanceId.encode({
            id: (apiBonusActivation.id as unknown) as NonEmptyString
          })
        )
      )
      .run();
  };
}

export function StartBonusActivation(
  bonusActivationModel: BonusActivationModel,
  bonusLeaseModel: BonusLeaseModel,
  bonusProcessingModel: BonusProcessingModel,
  eligibilityCheckModel: EligibilityCheckModel,
  enqueueBonusActivation: EnqueueBonusActivationT
): express.RequestHandler {
  const handler = StartBonusActivationHandler(
    bonusActivationModel,
    bonusLeaseModel,
    bonusProcessingModel,
    eligibilityCheckModel,
    enqueueBonusActivation
  );
  const middlewaresWrap = withRequestMiddlewares(
    // Extract Azure Functions bindings
    ContextMiddleware(),
    FiscalCodeMiddleware
  );

  return wrapRequestHandler(middlewaresWrap(handler));
}
