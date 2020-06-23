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
import { Timestamp } from "../generated/models/Timestamp";
import { ReleaseFamilyLockActivityInput } from "../ReleaseFamilyLockActivity/handler";
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
  bonusActivation: BonusActivationWithFamilyUID,
  validBefore: Timestamp
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
      // TODO: should we relase the lock here ?
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
      // TODO: should we relase the lock here ?
      return false;
    }
    const bonusVacanzaBase = errorOrBonusVacanzaBase.value;
    const operationId = toHash(bonusVacanzaBase.codiceFiscaleDichiarante);

    try {
      // Send bonus details to ADE rest service
      // tslint:disable-next-line: no-let
      let undecodedSendBonusActivation;
      try {
        undecodedSendBonusActivation = yield context.df.callActivityWithRetry(
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
      } catch (e) {
        // release family lock in case SendBonusActivationActivity fails
        yield context.df.callActivityWithRetry(
          "ReleaseFamilyLockActivity",
          retryOptions,
          ReleaseFamilyLockActivityInput.encode({
            familyUID:
              startBonusActivationOrchestratorInput.bonusActivation.familyUID
          })
        );
        throw e;
      }

      const isSendBonusActivationSuccess = SendBonusActivationSuccess.is(
        undecodedSendBonusActivation
      );

      if (isSendBonusActivationSuccess) {
        // update bonus to ACTIVE
        // TODO: If this operation fails after max retries
        // we don't release the lock as the bous is already sent to ADE.
        // We should retry the whole orchestrator (using a sub-orchestrator)
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
        // release lock in case the bonus activation fails
        yield context.df.callActivityWithRetry(
          "ReleaseFamilyLockActivity",
          retryOptions,
          ReleaseFamilyLockActivityInput.encode({
            familyUID:
              startBonusActivationOrchestratorInput.bonusActivation.familyUID
          })
        );

        // update bonus to FAILED
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
            content: MESSAGES.BonusActivationFailure(
              startBonusActivationOrchestratorInput.validBefore
            ),
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
