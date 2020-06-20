import {
  IOrchestrationFunctionContext,
  Task,
  TaskSet
} from "durable-functions/lib/src/classes";
import { isLeft } from "fp-ts/lib/Either";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { FailedBonusActivationInput } from "../FailedBonusActivationActivity/handler";
import { BonusActivationWithFamilyUID } from "../generated/models/BonusActivationWithFamilyUID";
import { SendBonusActivationSuccess } from "../SendBonusActivationActivity/handler";
import { SendBonusActivationInput } from "../SendBonusActivationActivity/handler";
import { ActivityInput as SendMessageActivityInput } from "../SendMessageActivity/handler";
import { SuccessBonusActivationInput } from "../SuccessBonusActivationActivity/handler";
import { trackEvent } from "../utils/appinsights";
import { toApiBonusVacanzaBase } from "../utils/conversions";
import { MESSAGES } from "../utils/messages";
import { retryOptions } from "../utils/retryPolicy";

export const OrchestratorInput = t.interface({
  bonusActivation: BonusActivationWithFamilyUID
});
export type OrchestratorInput = t.TypeOf<typeof OrchestratorInput>;

export const getStartBonusActivationOrchestratorHandler = (
  hmacSecret: NonEmptyString | Buffer
) =>
  function*(context: IOrchestrationFunctionContext): Generator<TaskSet | Task> {
    const logPrefix = `StartBonusActivationOrchestrator`;
    // Get and decode orchestrator input
    const input = context.df.getInput();
    const errorOrStartBonusActivationOrchestratorInput = OrchestratorInput.decode(
      input
    );
    if (isLeft(errorOrStartBonusActivationOrchestratorInput)) {
      context.log.error(`${logPrefix}|Error decoding input`);
      context.log.verbose(
        `${logPrefix}|Error decoding input|ERROR=${readableReport(
          errorOrStartBonusActivationOrchestratorInput.value
        )}`
      );
      return false;
    }

    // Needed to return 202 with bonus ID
    context.df.setCustomStatus(
      errorOrStartBonusActivationOrchestratorInput.value.bonusActivation.id
    );

    const errorOrBonusVacanzaBase = toApiBonusVacanzaBase(
      hmacSecret,
      errorOrStartBonusActivationOrchestratorInput.value.bonusActivation
    );
    if (isLeft(errorOrBonusVacanzaBase)) {
      context.log.error(`${logPrefix}|Error decoding bonus activation request`);
      context.log.verbose(
        `${logPrefix}|Error decoding bonus activation request|ERROR=${readableReport(
          errorOrBonusVacanzaBase.value
        )}`
      );
      return false;
    }

    // Send bonus details to ADE rest service
    const undecodedSendBonusActivation = yield context.df.callActivityWithRetry(
      "SendBonusActivationActivity",
      retryOptions,
      SendBonusActivationInput.encode(errorOrBonusVacanzaBase.value)
    );
    trackEvent({
      name: "bonus.activation.sent"
    });

    const startBonusActivationOrchestratorInput =
      errorOrStartBonusActivationOrchestratorInput.value;
    const isSendBonusActivationSuccess = SendBonusActivationSuccess.is(
      undecodedSendBonusActivation
    );
    if (isSendBonusActivationSuccess) {
      yield context.df.callActivityWithRetry(
        "SuccessBonusActivationActivity",
        retryOptions,
        SuccessBonusActivationInput.encode(
          startBonusActivationOrchestratorInput
        )
      );
      yield context.df.callActivityWithRetry(
        "SendMessageActivity",
        retryOptions,
        SendMessageActivityInput.encode({
          checkProfile: false,
          content: MESSAGES.BonusActivationSuccess(),
          fiscalCode:
            startBonusActivationOrchestratorInput.bonusActivation
              .applicantFiscalCode
        })
      );
      trackEvent({
        name: "bonus.activation.success"
      });
    } else {
      yield context.df.callActivityWithRetry(
        "FailedBonusActivationActivity",
        retryOptions,
        FailedBonusActivationInput.encode(startBonusActivationOrchestratorInput)
      );
      yield context.df.callActivityWithRetry(
        "SendMessageActivity",
        retryOptions,
        SendMessageActivityInput.encode({
          checkProfile: false,
          content: MESSAGES.BonusActivationFailure(),
          fiscalCode:
            startBonusActivationOrchestratorInput.bonusActivation
              .applicantFiscalCode
        })
      );
      trackEvent({
        name: "bonus.activation.failure"
      });
    }

    // Send notifications for all family members with bonus activation detail
    for (const familyMember of startBonusActivationOrchestratorInput
      .bonusActivation.dsuRequest.familyMembers) {
      yield context.df.callActivityWithRetry(
        "SendMessageActivity",
        retryOptions,
        SendMessageActivityInput.encode({
          checkProfile: true,
          content: MESSAGES[
            isSendBonusActivationSuccess
              ? "BonusActivationSuccess"
              : "BonusActivationFailure"
          ](),
          fiscalCode: familyMember.fiscalCode
        })
      );
    }
    return true;
  };
