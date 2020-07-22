import { IOrchestrationFunctionContext } from "durable-functions/lib/src/classes";

import { addSeconds } from "date-fns";
import * as df from "durable-functions";
import { isSome, none, Option, some } from "fp-ts/lib/Option";
import * as t from "io-ts";
import {
  ActivityResult as DeleteEligibilityCheckActivityResult,
  DeleteEligibilityCheckActivityInput
} from "../DeleteEligibilityCheckActivity/handler";
import {
  ActivityResult,
  EligibilityCheckActivityInput
} from "../EligibilityCheckActivity/handler";
import { EligibilityCheck as ApiEligibilityCheck } from "../generated/definitions/EligibilityCheck";
import { EligibilityCheckFailure } from "../generated/definitions/EligibilityCheckFailure";
import { EligibilityCheckSuccessConflict } from "../generated/definitions/EligibilityCheckSuccessConflict";
import { EligibilityCheckSuccessEligible } from "../generated/definitions/EligibilityCheckSuccessEligible";
import { EligibilityCheckSuccessIneligible } from "../generated/definitions/EligibilityCheckSuccessIneligible";
import { UpsertEligibilityCheckActivityInput } from "../UpsertEligibilityCheckActivity/handler";
import {
  toApiEligibilityCheckFromDSU,
  toModelEligibilityCheck
} from "../utils/conversions";
import { getMessage, MESSAGES } from "../utils/messages";
import {
  externalRetryOptions,
  internalRetryOptions
} from "../utils/retry_policies";
import {
  ValidateEligibilityCheckActivityInput,
  ValidateEligibilityCheckActivityOutput
} from "../ValidateEligibilityCheckActivity/handler";

import {
  EventTelemetry,
  ExceptionTelemetry
} from "applicationinsights/out/Declarations/Contracts";
import { isLeft } from "fp-ts/lib/Either";
import { constVoid, toString } from "fp-ts/lib/function";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import {
  ActivityResult as CheckBonusActiveActivityResult,
  CheckBonusActiveActivityInput
} from "../CheckBonusActiveActivity/handler";
import { EligibilityCheck } from "../generated/models/EligibilityCheck";
import { ActivityInput as SendMessageActivityInput } from "../SendMessageActivity/handler";
import { trackEvent, trackException } from "../utils/appinsights";
import { generateFamilyUID } from "../utils/hash";

export const OrchestratorInput = FiscalCode;
export type OrchestratorInput = t.TypeOf<typeof OrchestratorInput>;

const NOTIFICATION_DELAY_SECONDS = 10;

export const getMessageType = (
  _: ApiEligibilityCheck
): Option<keyof typeof MESSAGES> => {
  return EligibilityCheckFailure.is(_)
    ? some("EligibilityCheckFailure")
    : EligibilityCheckSuccessEligible.is(_) && _.dsu_request.has_discrepancies
    ? some("EligibilityCheckSuccessEligibleWithDiscrepancies")
    : EligibilityCheckSuccessEligible.is(_)
    ? some("EligibilityCheckSuccessEligible")
    : EligibilityCheckSuccessIneligible.is(_)
    ? some("EligibilityCheckSuccessIneligible")
    : EligibilityCheckSuccessConflict.is(_)
    ? some("EligibilityCheckConflict")
    : none;
};

// tslint:disable-next-line: no-big-function
export const handler = function*(
  context: IOrchestrationFunctionContext,
  logPrefix: string = "EligibilityCheckOrchestrator"
): Generator {
  context.df.setCustomStatus("RUNNING");
  const input = context.df.getInput();
  const errorOrEligibilityCheckOrchestratorInput = OrchestratorInput.decode(
    input
  );
  if (isLeft(errorOrEligibilityCheckOrchestratorInput)) {
    context.log.verbose(
      `${logPrefix}|Error decoding input|ERROR=${readableReport(
        errorOrEligibilityCheckOrchestratorInput.value
      )}`
    );
    trackException({
      exception: new Error(`${logPrefix}|Cannot decode input`),
      properties: {
        // tslint:disable-next-line: no-duplicate-string
        name: "bonus.eligibilitycheck.error"
      }
    });
    return false;
  }

  const fiscalCode = errorOrEligibilityCheckOrchestratorInput.value;

  const tagOverrides = {
    "ai.operation.id": fiscalCode,
    "ai.operation.parentId": fiscalCode
  };

  const trackEventIfNotReplaying = (evt: EventTelemetry) =>
    context.df.isReplaying ? constVoid : trackEvent(evt);

  const trackExceptionIfNotReplaying = (evt: ExceptionTelemetry) =>
    context.df.isReplaying ? constVoid : trackException(evt);

  // tslint:disable-next-line: no-let
  let validatedEligibilityCheck: ApiEligibilityCheck;
  // tslint:disable-next-line: no-let
  let eligibilityCheckResponse: ActivityResult;
  // tslint:disable-next-line: no-let
  let modelEligibilityCheck: EligibilityCheck;

  try {
    const deleteEligibilityCheckResponse = yield context.df.callActivityWithRetry(
      "DeleteEligibilityCheckActivity",
      internalRetryOptions,
      DeleteEligibilityCheckActivityInput.encode(fiscalCode)
    );

    DeleteEligibilityCheckActivityResult.decode(
      deleteEligibilityCheckResponse
    ).map(_ => {
      if (_.kind === "FAILURE") {
        throw new Error(_.reason);
      }
    });

    const undecodedEligibilityCheckResponse = yield context.df.callActivityWithRetry(
      "EligibilityCheckActivity",
      externalRetryOptions,
      EligibilityCheckActivityInput.encode(fiscalCode)
    );
    eligibilityCheckResponse = ActivityResult.decode(
      undecodedEligibilityCheckResponse
    ).getOrElseL(error => {
      throw new Error(
        `Cannot decode response from INPS: [${readableReport(error)}]`
      );
    });

    if (eligibilityCheckResponse.kind !== "SUCCESS") {
      throw new Error(
        `Unexpected response from EligibilityCheckActivity: [${eligibilityCheckResponse.reason}]`
      );
    }

    const apiEligibilityCheck = toApiEligibilityCheckFromDSU(
      eligibilityCheckResponse.data,
      eligibilityCheckResponse.fiscalCode,
      eligibilityCheckResponse.validBefore
    ).getOrElseL(error => {
      throw new Error(
        `Cannot decode ApiEligibilityCheckFromDSU: [${readableReport(error)}]`
      );
    });

    // Compute familyUID from the EligibilityCheck (status = ELIGIBLE)
    // and check there's no other bonus with the same familyUID.
    // If a bonus with the same famiyUID already exists
    // the status of EligibilityCheck is updated from ELIGIBLE to CONFLICT.
    const undecodedValidatedEligibilityCheck = yield context.df.callActivityWithRetry(
      "ValidateEligibilityCheckActivity",
      internalRetryOptions,
      ValidateEligibilityCheckActivityInput.encode(apiEligibilityCheck)
    );
    validatedEligibilityCheck = ValidateEligibilityCheckActivityOutput.decode(
      undecodedValidatedEligibilityCheck
    ).getOrElseL(error => {
      throw new Error(
        `Cannot decode validated EligibilityCheck: [${readableReport(error)}]`
      );
    });

    // Convert from API EligibilityCheck to Model EligibilityCheck
    modelEligibilityCheck = toModelEligibilityCheck(
      validatedEligibilityCheck
    ).getOrElseL(error => {
      throw new Error(
        `Eligibility check Conversion error: [${readableReport(error)}]`
      );
    });
    yield context.df.callActivityWithRetry(
      "UpsertEligibilityCheckActivity",
      internalRetryOptions,
      UpsertEligibilityCheckActivityInput.encode(modelEligibilityCheck)
    );
  } catch (err) {
    context.log.error(`${logPrefix}|ERROR|${toString(err)}`);
    trackExceptionIfNotReplaying({
      exception: err,
      properties: {
        id: fiscalCode,
        name: "bonus.eligibilitycheck.error"
      },
      tagOverrides
    });
    yield context.df.callActivityWithRetry(
      "SendMessageActivity",
      internalRetryOptions,
      SendMessageActivityInput.encode({
        checkProfile: false,
        content: MESSAGES.EligibilityCheckFailureINPSUnavailable(),
        fiscalCode
      })
    );
    return false;
  } finally {
    context.df.setCustomStatus("COMPLETED");
  }

  trackEventIfNotReplaying({
    name: "bonus.eligibilitycheck.success",
    properties: {
      id: fiscalCode,
      status: `${validatedEligibilityCheck.status}`
    },
    tagOverrides
  });

  // sleep before sending push notification
  // so we can let the get operation stop the flow here
  yield context.df.createTimer(
    addSeconds(context.df.currentUtcDateTime, NOTIFICATION_DELAY_SECONDS)
  );

  trackEventIfNotReplaying({
    name: "bonus.eligibilitycheck.timer",
    properties: {
      id: fiscalCode,
      status: `${validatedEligibilityCheck.status}`
    },
    tagOverrides
  });

  // Timer triggered, we now try to send the right message
  // to the applicant containing the eligibility check details.
  try {
    const maybeMessageType = getMessageType(validatedEligibilityCheck);

    if (isSome(maybeMessageType)) {
      if (
        modelEligibilityCheck.status === "CONFLICT" &&
        maybeMessageType.value === "EligibilityCheckConflict"
      ) {
        const familyUID = generateFamilyUID(
          modelEligibilityCheck.dsuRequest.familyMembers
        );

        // Check if there's another bonus activation running for this family
        const undecodedIsBonusActive = yield context.df.callActivityWithRetry(
          "CheckBonusActiveActivity",
          internalRetryOptions,
          CheckBonusActiveActivityInput.encode({
            familyUID
          })
        );
        const isBonusActive = CheckBonusActiveActivityResult.decode(
          undecodedIsBonusActive
        ).getOrElse(false);

        // Send the right message
        // (bonus activated or processing)
        const content = getMessage(
          isBonusActive
            ? "EligibilityCheckConflictWithBonusActivated"
            : maybeMessageType.value,
          eligibilityCheckResponse.validBefore
        );

        yield context.df.callActivityWithRetry(
          "SendMessageActivity",
          internalRetryOptions,
          SendMessageActivityInput.encode({
            checkProfile: false,
            content,
            fiscalCode: eligibilityCheckResponse.fiscalCode
          })
        );
      } else {
        // Send the right message
        // (no conflict found)
        yield context.df.callActivityWithRetry(
          "SendMessageActivity",
          internalRetryOptions,
          SendMessageActivityInput.encode({
            checkProfile: false,
            content: getMessage(
              maybeMessageType.value,
              eligibilityCheckResponse.validBefore
            ),
            fiscalCode: eligibilityCheckResponse.fiscalCode
          })
        );
      }
      trackEventIfNotReplaying({
        name: "bonus.eligibilitycheck.message",
        properties: {
          id: fiscalCode,
          type: maybeMessageType.value
        },
        tagOverrides
      });
    } else {
      trackExceptionIfNotReplaying({
        exception: new Error(
          `Cannot get message type for eligibility check: ${eligibilityCheckResponse.fiscalCode}`
        ),
        properties: {
          id: fiscalCode,
          name: "bonus.eligibilitycheck.error"
        },
        tagOverrides
      });
      return false;
    }
  } catch (e) {
    // Cannot send message
    trackExceptionIfNotReplaying({
      exception: new Error(
        `Error sending message for eligibility check: ${eligibilityCheckResponse.fiscalCode}`
      ),
      properties: {
        id: fiscalCode,
        name: "bonus.eligibilitycheck.error"
      },
      tagOverrides
    });
    return false;
  }
  return validatedEligibilityCheck;
};

export const index = df.orchestrator(handler);
