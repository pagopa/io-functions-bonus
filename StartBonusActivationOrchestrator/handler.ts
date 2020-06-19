import { defaultClient } from "applicationinsights";
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
import { SendMessageActivityInput } from "../SendMessageActivity/handler";
import { SuccessBonusActivationInput } from "../SuccessBonusActivationActivity/handler";
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
    defaultClient.trackEvent({
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
      defaultClient.trackEvent({
        name: "bonus.activation.success"
      });
    } else {
      // TODO: is FailedBonusActivationActivity idempotent?
      yield context.df.callActivityWithRetry(
        "FailedBonusActivationActivity",
        retryOptions,
        FailedBonusActivationInput.encode(startBonusActivationOrchestratorInput)
      );
      defaultClient.trackEvent({
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
