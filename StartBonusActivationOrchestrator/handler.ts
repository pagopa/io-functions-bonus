import {
  IOrchestrationFunctionContext,
  Task,
  TaskSet
} from "durable-functions/lib/src/classes";
import { isLeft } from "fp-ts/lib/Either";
import { toString } from "fp-ts/lib/function";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { FailedBonusActivationInput } from "../FailedBonusActivationActivity/handler";
import { BonusActivationWithFamilyUID } from "../generated/models/BonusActivationWithFamilyUID";
import { BonusCode } from "../generated/models/BonusCode";
import { SendBonusActivationSuccess } from "../SendBonusActivationActivity/handler";
import { SendBonusActivationInput } from "../SendBonusActivationActivity/handler";
import { ActivityInput as SendMessageActivityInput } from "../SendMessageActivity/handler";
import { SuccessBonusActivationInput } from "../SuccessBonusActivationActivity/handler";
import { trackEvent, trackException } from "../utils/appinsights";
import { toApiBonusVacanzaBase } from "../utils/conversions";
import { toHash } from "../utils/hash";
import { MESSAGES } from "../utils/messages";
import { retryOptions } from "../utils/retryPolicy";

export const CONTINUE_BONUS_ACTIVATION_EVENT_NAME = "ContinueBonusActivation";

export const OrchestratorInput = t.interface({
  bonusId: BonusCode
});
export type OrchestratorInput = t.TypeOf<typeof OrchestratorInput>;

export const ContinueEventInput = t.type({
  bonusActivation: BonusActivationWithFamilyUID
});
export type ContinueEventInput = t.TypeOf<typeof ContinueEventInput>;

export const getStartBonusActivationOrchestratorHandler = (
  hmacSecret: NonEmptyString | Buffer
) =>
  function*(context: IOrchestrationFunctionContext): Generator<TaskSet | Task> {
    const logPrefix = `StartBonusActivationOrchestrator`;

    // Get bonus id from orchestrator input
    const errorOrStartBonusActivationOrchestratorInput = OrchestratorInput.decode(
      context.df.getInput()
    );
    if (isLeft(errorOrStartBonusActivationOrchestratorInput)) {
      context.log.verbose(
        `${logPrefix}|Error decoding input|ERROR=${readableReport(
          errorOrStartBonusActivationOrchestratorInput.value
        )}`
      );
      trackException({
        exception: new Error(`${logPrefix}|Cannot decode input`),
        properties: {
          // tslint:disable-next-line: no-duplicate-string
          name: "bonus.activation.error"
        }
      });
      return false;
    }
    const startBonusActivationOrchestratorInput =
      errorOrStartBonusActivationOrchestratorInput.value;

    // Needed to return 202 with bonus ID
    context.df.setCustomStatus(startBonusActivationOrchestratorInput.bonusId);

    // Get bonus activation model object from event input
    const undecodedBonusActivation = yield context.df.waitForExternalEvent(
      CONTINUE_BONUS_ACTIVATION_EVENT_NAME
    );
    const errorOrContinueEventInput = ContinueEventInput.decode(
      undecodedBonusActivation
    );
    if (isLeft(errorOrContinueEventInput)) {
      context.log.verbose(
        `${logPrefix}|Error decoding bonus activation request|ERROR=${readableReport(
          errorOrContinueEventInput.value
        )}`
      );
      trackException({
        exception: new Error(
          `${logPrefix}|Error decoding bonus activation from event`
        ),
        properties: {
          name: "bonus.activation.error"
        }
      });
      return false;
    }
    const bonusActivation = errorOrContinueEventInput.value.bonusActivation;

    const errorOrBonusVacanzaBase = toApiBonusVacanzaBase(
      hmacSecret,
      bonusActivation
    );
    if (isLeft(errorOrBonusVacanzaBase)) {
      context.log.verbose(
        `${logPrefix}|Error decoding bonus activation request|ERROR=${readableReport(
          errorOrBonusVacanzaBase.value
        )}`
      );
      trackException({
        exception: new Error(
          `${logPrefix}|Error decoding bonus activation request`
        ),
        properties: {
          name: "bonus.activation.error"
        }
      });
      return false;
    }
    const bonusVacanzaBase = errorOrBonusVacanzaBase.value;
    const operationId = toHash(bonusVacanzaBase.codiceFiscaleDichiarante);

    try {
      // Send bonus details to ADE rest service
      const undecodedSendBonusActivation = yield context.df.callActivityWithRetry(
        "SendBonusActivationActivity",
        retryOptions,
        SendBonusActivationInput.encode(bonusVacanzaBase)
      );
      trackEvent({
        name: "bonus.activation.sent",
        properties: {
          id: operationId
        }
      });
      const isSendBonusActivationSuccess = SendBonusActivationSuccess.is(
        undecodedSendBonusActivation
      );
      if (isSendBonusActivationSuccess) {
        yield context.df.callActivityWithRetry(
          "SuccessBonusActivationActivity",
          retryOptions,
          SuccessBonusActivationInput.encode({ bonusActivation })
        );
        trackEvent({
          name: "bonus.activation.success",
          properties: {
            id: operationId
          }
        });
        // Family members includes applicant fiscal code
        for (const familyMember of bonusActivation.dsuRequest.familyMembers) {
          yield context.df.callActivityWithRetry(
            "SendMessageActivity",
            retryOptions,
            SendMessageActivityInput.encode({
              checkProfile:
                bonusActivation.applicantFiscalCode !== familyMember.fiscalCode,
              content: MESSAGES.BonusActivationSuccess(),
              fiscalCode: familyMember.fiscalCode
            })
          );
        }
      } else {
        yield context.df.callActivityWithRetry(
          "FailedBonusActivationActivity",
          retryOptions,
          FailedBonusActivationInput.encode({ bonusActivation })
        );
        trackEvent({
          name: "bonus.activation.failure",
          properties: {
            id: operationId
          }
        });
        // In case of failures send the notification only to the applicant
        yield context.df.callActivityWithRetry(
          "SendMessageActivity",
          retryOptions,
          SendMessageActivityInput.encode({
            checkProfile: false,
            content: MESSAGES.BonusActivationFailure(),
            fiscalCode: bonusActivation.applicantFiscalCode
          })
        );
      }
    } catch (e) {
      context.log.error(`${logPrefix}|ID=${operationId}|ERROR=${toString(e)}`);
      trackException({
        exception: e,
        properties: {
          id: operationId,
          name: "bonus.activation.error"
        }
      });
      return false;
    }

    return true;
  };
