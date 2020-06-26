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
import {
  externalRetryOptions,
  internalRetryOptions
} from "../utils/retry_policies";

export const OrchestratorInput = t.interface({
  applicantFiscalCode: FiscalCode,
  bonusId: BonusCode,
  validBefore: Timestamp
});
export type OrchestratorInput = t.TypeOf<typeof OrchestratorInput>;

const getFatalErrorTracer = (
  ctx: IOrchestrationFunctionContext,
  prefix: string,
  bonusId: string
) => (msg: string) => {
  const errormsg = `${prefix}|FATAL|BONUS_ID=${bonusId}|${msg}`;
  ctx.log.error(errormsg);
  const error = new Error(errormsg);
  trackException({
    exception: error,
    properties: {
      fatal: "true",
      // tslint:disable-next-line: no-duplicate-string
      name: "bonus.activation.error"
    }
  });
  return error;
};

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
      const error = `Error decoding orchestrator input|ERROR=${readableReport(
        errorOrStartBonusActivationOrchestratorInput.value
      )}`;
      context.log.error(error);
      trackException({
        exception: new Error(error),
        properties: {
          fatal: "true",
          // tslint:disable-next-line: no-duplicate-string
          name: "bonus.activation.error"
        }
      });
      // We cannot relase any lock here since the decoding failed
      // so we don't throw but return
      return false;
    }

    const {
      applicantFiscalCode,
      bonusId,
      validBefore
    } = errorOrStartBonusActivationOrchestratorInput.value;

    const traceFatalError = getFatalErrorTracer(context, logPrefix, bonusId);

    try {
      // track bonusId
      try {
        context.df.setCustomStatus(bonusId);
      } catch (e) {
        // this is just for troubleshooting, we don't want
        // the whole orchestrator to fail here
        context.log.error(
          `${logPrefix}|ERROR=Cannot set customStatus: ${toString(e)}`
        );
      }

      // For application insights logging / tracking
      const operationId = toHash(bonusId);

      // Get the PROCESSING bonus activation relative to (bonusId, fiscalCode).
      // Must have status = PROCESSING since we're going to make it ACTIVE
      // tslint:disable-next-line: no-let
      let undecodedBonusActivation;
      try {
        undecodedBonusActivation = yield context.df.callActivityWithRetry(
          "GetBonusActivationActivity",
          internalRetryOptions,
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
      } catch (e) {
        // No bonus in status PROCESSING found for the provided bonusId
        // TODO: should we release the family lock here ?
        throw traceFatalError(
          `GetBonusActivationActivity failed|ERROR=${toString(e)}`
        );
      }

      // Try to decode the result of the activity that get the PROCESSING bonus
      const errorOrGetBonusActivationActivityOutput = GetBonusActivationActivityOutput.decode(
        undecodedBonusActivation
      );
      if (isLeft(errorOrGetBonusActivationActivityOutput)) {
        // TODO: should we release the family lock here ?
        throw traceFatalError(
          `Error decoding GetBonusActivationActivity output|ERROR=${readableReport(
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
        throw traceFatalError(
          `Error retrieving processing bonus activation|ERROR=${bonusActivationActivityOutput.reason}`
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
        throw traceFatalError(
          `Error decoding bonus activation request|ERROR=${readableReport(
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
          externalRetryOptions,
          SendBonusActivationInput.encode(bonusVacanzaBase)
        );
        trackEvent({
          name: "bonus.activation.ade.success",
          properties: {
            id: operationId
          }
        });
      } catch (e) {
        // All retries failed, we are going to release the family lock
        // (see the code below), so we avoid to throw here
        trackEvent({
          name: "bonus.activation.ade.failure",
          properties: {
            id: operationId
          }
        });
        trackException({
          exception: new Error(
            `${logPrefix}|Error sending bonus to ADE|ERROR=${toString(e)}`
          )
        });
      }

      // Call to ADE service succeeded?
      const isSendBonusActivationSuccess = SendBonusActivationSuccess.is(
        undecodedSendBonusActivation
      );

      if (isSendBonusActivationSuccess) {
        // Update the bonus status to ACTIVE.
        // Currently, if this operation fails after max retries
        // we don't release the lock: the bonus is already sent to ADE
        // and as user know its secret code, if we release the lock here,
        // he will be able to spend more than one bonus for the same familyUID.
        try {
          yield context.df.callActivityWithRetry(
            "SuccessBonusActivationActivity",
            internalRetryOptions,
            SuccessBonusActivationInput.encode({ bonusActivation })
          );
          trackEvent({
            name: "bonus.activation.success",
            properties: {
              id: operationId
            }
          });
        } catch (e) {
          throw traceFatalError(
            `ADE call succeeded but could not set the bonus to ACTIVE|ERROR=${toString}`
          );
        }
        // Notify all family members and applicant
        // (family members array includes applicant fiscal code)
        for (const familyMember of bonusActivation.dsuRequest.familyMembers) {
          yield context.df.callActivityWithRetry(
            "SendMessageActivity",
            internalRetryOptions,
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
        // (read: the call to ADE returned an error or failed after max retries)
        try {
          yield context.df.callActivityWithRetry(
            "ReleaseFamilyLockActivity",
            internalRetryOptions,
            ReleaseFamilyLockActivityInput.encode({
              familyUID: bonusActivation.familyUID
            })
          );
        } catch (e) {
          throw traceFatalError(
            `Could not realease the family lock: ${toString(e)}`
          );
        }

        // update bonus to FAILED
        yield context.df.callActivityWithRetry(
          "FailedBonusActivationActivity",
          internalRetryOptions,
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
          internalRetryOptions,
          SendMessageActivityInput.encode({
            checkProfile: false,
            content: MESSAGES.BonusActivationFailure(validBefore),
            fiscalCode: bonusActivation.applicantFiscalCode
          })
        );
      }
    } catch (e) {
      // We've reached this point in case
      // 1) some FATAL error has occurred
      // 2) some activity (ie. SendMessage) has failed with max retries
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
      // anything goes: release user's lock when the orchestrator ends
      try {
        yield context.df.callActivityWithRetry(
          "ReleaseUserLockActivity",
          internalRetryOptions,
          ReleaseUserLockActivityInput.encode({
            id: applicantFiscalCode
          })
        );
      } catch (e) {
        traceFatalError(`Could not realease the user lock: ${toString(e)}`);
      }
    }
    return true;
  };
