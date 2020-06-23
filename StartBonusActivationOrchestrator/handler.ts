import {
  IOrchestrationFunctionContext,
  Task,
  TaskSet
} from "durable-functions/lib/src/classes";
import { isLeft } from "fp-ts/lib/Either";
import { toString } from "fp-ts/lib/function";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { FailedBonusActivationInput } from "../FailedBonusActivationActivity/handler";
import { BonusCode } from "../generated/models/BonusCode";
import { Timestamp } from "../generated/models/Timestamp";
import {
  GetBonusActivationActivityInput,
  GetBonusActivationActivityOutput
} from "../GetBonusActivationActivity/handler";
import { ReleaseFamilyLockActivityInput } from "../ReleaseFamilyLockActivity/handler";
import { ReleaseUserLockActivityInput } from "../ReleaseUserLockActivity/handler";
import { SendBonusActivationSuccess } from "../SendBonusActivationActivity/handler";
import { SendBonusActivationInput } from "../SendBonusActivationActivity/handler";
import { ActivityInput as SendMessageActivityInput } from "../SendMessageActivity/handler";
import { SuccessBonusActivationInput } from "../SuccessBonusActivationActivity/handler";
import { trackEvent, trackException } from "../utils/appinsights";
import { toApiBonusVacanzaBase } from "../utils/conversions";
import { Failure } from "../utils/errors";
import { toHash } from "../utils/hash";
import { MESSAGES } from "../utils/messages";
import { retryOptions } from "../utils/retryPolicy";

export const OrchestratorInput = t.interface({
  applicantFiscalCode: FiscalCode,
  bonusId: BonusCode,
  validBefore: Timestamp
});
export type OrchestratorInput = t.TypeOf<typeof OrchestratorInput>;

export const getStartBonusActivationOrchestratorHandler = (
  hmacSecret: NonEmptyString | Buffer
  // tslint:disable-next-line: no-big-function
) =>
  // tslint:disable-next-line: no-big-function
  function*(context: IOrchestrationFunctionContext): Generator<TaskSet | Task> {
    const logPrefix = `StartBonusActivationOrchestrator`;

    // Try to decode input from ContinueBonusActivation
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
      // We cannot relase any lock here since the decoding failed
      return false;
    }

    const {
      applicantFiscalCode,
      bonusId,
      validBefore
    } = errorOrStartBonusActivationOrchestratorInput.value;

    try {
      // track bonusId
      context.df.setCustomStatus(bonusId);

      // For application insights logging / tracking
      const operationId = toHash(bonusId);

      // Get the bonus activation relative to the input (bonusId, applicantFiscalCode)
      // Must have status = PROCESSING since we're going to make it ACTIVE
      const undecodedBonusActivation = yield context.df.callActivityWithRetry(
        "GetBonusActivationActivity",
        retryOptions,
        GetBonusActivationActivityInput.encode({
          applicantFiscalCode,
          bonusId
        })
      );
      trackEvent({
        name: "bonus.activation.get",
        properties: {
          id: operationId
        }
      });

      // Try to decode the result of the activity that get the processing bonus
      const errorOrGetBonusActivationActivityOutput = GetBonusActivationActivityOutput.decode(
        undecodedBonusActivation
      );
      if (isLeft(errorOrGetBonusActivationActivityOutput)) {
        // TODO: should we release the family lock here ?
        throw new Error(
          `${logPrefix}|Error decoding bonus activation activity output|ERROR=${readableReport(
            errorOrGetBonusActivationActivityOutput.value
          )}`
        );
      }
      const bonusActivationActivityOutput =
        errorOrGetBonusActivationActivityOutput.value;

      // Is it possible that no PROCESSING bonus activation is found
      // so we cannot go on and make it ACTIVE
      if (Failure.is(bonusActivationActivityOutput)) {
        // TODO: should we relase the family lock here ?
        throw new Error(
          `${logPrefix}|Error retrieving processing bonus activation|ERROR=${bonusActivationActivityOutput.reason}`
        );
      }
      const bonusActivation = bonusActivationActivityOutput.bonusActivation;

      // Try to convert the internal representation of a bonus activation
      // in the format needed by the ADE APIs
      const errorOrBonusVacanzaBase = toApiBonusVacanzaBase(
        hmacSecret,
        bonusActivation
      );
      if (isLeft(errorOrBonusVacanzaBase)) {
        // TODO: should we relase the lock here ?
        throw new Error(
          `${logPrefix}|Error decoding bonus activation request|ERROR=${readableReport(
            errorOrBonusVacanzaBase.value
          )}`
        );
      }
      const bonusVacanzaBase = errorOrBonusVacanzaBase.value;

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
            familyUID: bonusActivation.familyUID
          })
        );
        throw new Error(
          `${logPrefix}|Error sending bonus to ADE|ERROR=${toString(e)}`
        );
      }

      // Call to ADE service succeeded?
      const isSendBonusActivationSuccess = SendBonusActivationSuccess.is(
        undecodedSendBonusActivation
      );

      if (isSendBonusActivationSuccess) {
        // Update bonus to ACTIVE
        // TODO: If this operation fails after max retries
        // we don't release the lock as the bous is already sent to ADE.
        // We should retry the whole orchestrator (using a sub-orchestrator)
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
        // Notify all family members and applicant
        // (family members array includes applicant fiscal code)
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
        // release family lock in case the bonus activation fails
        yield context.df.callActivityWithRetry(
          "ReleaseFamilyLockActivity",
          retryOptions,
          ReleaseFamilyLockActivityInput.encode({
            familyUID: bonusActivation.familyUID
          })
        );

        // update bonus to FAILED
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
            content: MESSAGES.BonusActivationFailure(validBefore),
            fiscalCode: bonusActivation.applicantFiscalCode
          })
        );
      }
    } catch (e) {
      context.log.error(
        `${logPrefix}|ID=${toHash(bonusId)}|ERROR=${toString(e)}`
      );
      trackException({
        exception: e,
        properties: {
          name: "bonus.activation.error"
        }
      });
    } finally {
      // release user's lock when the orchestrator ends
      yield context.df.callActivityWithRetry(
        "ReleaseUserLockActivity",
        retryOptions,
        ReleaseUserLockActivityInput.encode({
          id: applicantFiscalCode
        })
      );
    }

    return true;
  };
