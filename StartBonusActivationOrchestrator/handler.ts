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
  prefix: string,
  tagOverrides: Record<string, string>
) => (msg: string) => {
  const id = tagOverrides["ai.operation.id"];
  const errormsg = `${prefix}|FATAL|BONUS_ID=${id}|${msg}`;
  const error = new Error(errormsg);
  trackException({
    exception: error,
    properties: {
      fatal: "true",
      id,
      // tslint:disable-next-line: no-duplicate-string
      name: "bonus.activation.error"
    },
    tagOverrides
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

    const tagOverrides = {
      "ai.operation.id": bonusId,
      "ai.operation.parentId": bonusId
    };

    const traceFatalError = getFatalErrorTracer(logPrefix, tagOverrides);

    try {
      // Track bonusId
      try {
        context.df.setCustomStatus(bonusId);
      } catch (e) {
        // This is just for troubleshooting, we don't want
        // the whole orchestrator to fail here
        context.log.error(
          `${logPrefix}|ERROR=Cannot set customStatus: ${toString(e)}`
        );
      }

      // For application insights logging / tracking
      const operationId = bonusId;

      // Try to get the bonus activation relative to (bonusId, fiscalCode)
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
          },
          tagOverrides
        });
      } catch (e) {
        // We could not retrieve a bonus for the provided bonusId.
        // We cannot release the family lock here since
        // we haven't retrieved the familyUID.
        throw traceFatalError(
          `GetBonusActivationActivity failed|ERROR=${toString(e)}`
        );
      }

      // Try to decode the result of the activity that get the bonus activation
      const errorOrGetBonusActivationActivityOutput = GetBonusActivationActivityOutput.decode(
        undecodedBonusActivation
      );
      if (isLeft(errorOrGetBonusActivationActivityOutput)) {
        // We cannot release the family lock here since
        // we cannot decode the bonus payload to get the familyUID
        throw traceFatalError(
          `Error decoding GetBonusActivationActivity output|ERROR=${readableReport(
            errorOrGetBonusActivationActivityOutput.value
          )}`
        );
      }
      const bonusActivationActivityOutput =
        errorOrGetBonusActivationActivityOutput.value;

      if (Failure.is(bonusActivationActivityOutput)) {
        // In case we could not retrieve a bonus activation
        // we cannot go on and make it ACTIVE.
        // We cannot release the family lock here since
        // we cannot extract the familyUID from the retrieved bonus.
        throw traceFatalError(
          `Error retrieving processing bonus activation|ERROR=${bonusActivationActivityOutput.reason}`
        );
      }
      const bonusActivation = bonusActivationActivityOutput.bonusActivation;

      // Here we have successfullly retrieved a bonus activation.
      // In case the status is not PROCESSING we cannot go on and make it ACTIVE.
      if (bonusActivation.status !== "PROCESSING") {
        // TODO: should we release the family lock here ?
        throw traceFatalError(
          `Bonus activation status is not PROCESSING|STATUS=${bonusActivation.status}`
        );
      }

      // Try to convert the internal representation of a bonus activation
      // in the format needed by the ADE APIs
      const errorOrBonusVacanzaBase = toApiBonusVacanzaBase(
        hmacSecret,
        bonusActivation
      );
      if (isLeft(errorOrBonusVacanzaBase)) {
        // TODO: should we relase the family lock here ?
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
          },
          tagOverrides
        });
      } catch (e) {
        // All retries failed, we are going to release the family lock
        // (see the code below), so we avoid to throw here
        trackEvent({
          name: "bonus.activation.ade.failure",
          properties: {
            id: operationId
          },
          tagOverrides
        });
        trackException({
          exception: new Error(
            `${logPrefix}|Error sending bonus to ADE|ERROR=${toString(e)}`
          ),
          tagOverrides
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
        // and as the user knows its secret code, if we release the lock here,
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
            },
            tagOverrides
          });
        } catch (e) {
          throw traceFatalError(
            `ADE call succeeded but could not set the bonus to ACTIVE|ERROR=${toString(
              e
            )}`
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
        // Release the family lock in case the bonus activation fails
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
          // TODO: if we could not release the family lock here,
          // the bonus status will stuck into PROCESSING state
          // is this what we expect?
          throw traceFatalError(
            `Bonus activation failed but could not release the family lock: ${toString(
              e
            )}`
          );
        }

        // Update bonus status to FAILED
        try {
          yield context.df.callActivityWithRetry(
            "FailedBonusActivationActivity",
            internalRetryOptions,
            FailedBonusActivationInput.encode({ bonusActivation })
          );
          trackEvent({
            name: "bonus.activation.failure",
            properties: {
              id: operationId
            },
            tagOverrides
          });
        } catch (e) {
          throw traceFatalError(
            `ADE call failed but could not set the bonus to FAILED|ERROR=${toString(
              e
            )}`
          );
        }

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
      context.log.error(`${logPrefix}|ID=${bonusId}|ERROR=${toString(e)}`);
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
        traceFatalError(`Could not release the user lock: ${toString(e)}`);
      }
    }
    return true;
  };
