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
import { SendBonusActivationSuccess } from "../SendBonusActivationActivity/handler";
import { SendBonusActivationInput } from "../SendBonusActivationActivity/handler";
import { ActivityInput as SendMessageActivityInput } from "../SendMessageActivity/handler";
import { SuccessBonusActivationInput } from "../SuccessBonusActivationActivity/handler";
import { trackEvent, trackException } from "../utils/appinsights";
import { toApiBonusVacanzaBase } from "../utils/conversions";
import { toHash } from "../utils/hash";
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
    const errorOrStartBonusActivationOrchestratorInput = OrchestratorInput.decode(
      context.df.getInput()
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
    const startBonusActivationOrchestratorInput =
      errorOrStartBonusActivationOrchestratorInput.value;

    // Needed to return 202 with bonus ID
    context.df.setCustomStatus(
      startBonusActivationOrchestratorInput.bonusActivation.id
    );

    const errorOrBonusVacanzaBase = toApiBonusVacanzaBase(
      hmacSecret,
      startBonusActivationOrchestratorInput.bonusActivation
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
          SuccessBonusActivationInput.encode(
            startBonusActivationOrchestratorInput
          )
        );
        trackEvent({
          name: "bonus.activation.success",
          properties: {
            id: operationId
          }
        });
        // Family members includes applicant fiscal code
        for (const familyMember of startBonusActivationOrchestratorInput
          .bonusActivation.dsuRequest.familyMembers) {
          yield context.df.callActivityWithRetry(
            "SendMessageActivity",
            retryOptions,
            SendMessageActivityInput.encode({
              checkProfile:
                startBonusActivationOrchestratorInput.bonusActivation
                  .applicantFiscalCode !== familyMember.fiscalCode,
              content: MESSAGES.BonusActivationSuccess(),
              fiscalCode: familyMember.fiscalCode
            })
          );
        }
      } else {
        yield context.df.callActivityWithRetry(
          "FailedBonusActivationActivity",
          retryOptions,
          FailedBonusActivationInput.encode(
            startBonusActivationOrchestratorInput
          )
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
            fiscalCode:
              startBonusActivationOrchestratorInput.bonusActivation
                .applicantFiscalCode
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
