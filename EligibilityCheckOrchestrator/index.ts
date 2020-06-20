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
import { EligibilityCheck } from "../generated/definitions/EligibilityCheck";
import { EligibilityCheckFailure } from "../generated/definitions/EligibilityCheckFailure";
import { EligibilityCheckSuccessConflict } from "../generated/definitions/EligibilityCheckSuccessConflict";
import { EligibilityCheckSuccessEligible } from "../generated/definitions/EligibilityCheckSuccessEligible";
import { EligibilityCheckSuccessIneligible } from "../generated/definitions/EligibilityCheckSuccessIneligible";
import { UpsertEligibilityCheckActivityInput } from "../UpsertEligibilityCheckActivity/handler";
import { toApiEligibilityCheckFromDSU } from "../utils/conversions";
import { MESSAGES } from "../utils/messages";
import { retryOptions } from "../utils/retryPolicy";
import { ValidateEligibilityCheckActivityInput } from "../ValidateEligibilityCheckActivity/handler";

import { isLeft } from "fp-ts/lib/Either";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { ActivityInput as SendMessageActivityInput } from "../SendMessageActivity/handler";
import { trackEvent, trackException } from "../utils/appinsights";

export const OrchestratorInput = FiscalCode;
export type OrchestratorInput = t.TypeOf<typeof OrchestratorInput>;

const NOTIFICATION_DELAY_SECONDS = 10;
const logPrefix = "EligibilityCheckOrchestrator";

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

export const handler = function*(
  context: IOrchestrationFunctionContext
): Generator {
  context.df.setCustomStatus("RUNNING");
  const input = context.df.getInput();
  // tslint:disable-next-line: no-let
  let validatedEligibilityCheck: EligibilityCheck;
  // tslint:disable-next-line: no-let
  let eligibilityCheckResponse: ActivityResult;
  try {
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

    const orchestratorInput =
      errorOrStartBonusActivationOrchestratorInput.value;

    const deleteEligibilityCheckResponse = yield context.df.callActivityWithRetry(
      "DeleteEligibilityCheckActivity",
      retryOptions,
      DeleteEligibilityCheckActivityInput.encode(orchestratorInput)
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
      retryOptions,
      EligibilityCheckActivityInput.encode(orchestratorInput)
    );
    eligibilityCheckResponse = ActivityResult.decode(
      undecodedEligibilityCheckResponse
    ).getOrElse({
      kind: "FAILURE",
      reason: "ActivityResult decoding error"
    });

    if (eligibilityCheckResponse.kind !== "SUCCESS") {
      throw new Error(
        `Unexpected response from EligibilityCheckActivity: [${eligibilityCheckResponse.reason}]`
      );
    }
    const eligibilityCheck = toApiEligibilityCheckFromDSU(
      eligibilityCheckResponse.data,
      eligibilityCheckResponse.fiscalCode,
      eligibilityCheckResponse.validBefore
    ).getOrElseL(error => {
      throw new Error(
        `Unexpected response from toApiEligibilityCheckFromDSU: [${readableReport(
          error
        )}]`
      );
    });
    const undecodedValidatedEligibilityCheck = yield context.df.callActivityWithRetry(
      "ValidateEligibilityCheckActivity",
      retryOptions,
      ValidateEligibilityCheckActivityInput.encode(eligibilityCheck)
    );
    validatedEligibilityCheck = EligibilityCheck.decode(
      undecodedValidatedEligibilityCheck
    ).getOrElseL(error => {
      throw new Error(`Decoding Error: [${readableReport(error)}]`);
    });

    yield context.df.callActivityWithRetry(
      "UpsertEligibilityCheckActivity",
      retryOptions,
      UpsertEligibilityCheckActivityInput.encode(validatedEligibilityCheck)
    );
  } catch (err) {
    context.log.error("EligibilityCheckOrchestrator|ERROR|%s", err);
    trackException({
      exception: err,
      properties: {
        name: "bonus.eligibilitycheck.error"
      }
    });
    return err;
  } finally {
    context.df.setCustomStatus("COMPLETED");
  }

  trackEvent({
    name: "bonus.eligibilitycheck.success",
    properties: {
      status: `${validatedEligibilityCheck.status}`
    }
  });

  // sleep before sending push notification
  // so we can let the get operation stop the flow here
  yield context.df.createTimer(
    addSeconds(context.df.currentUtcDateTime, NOTIFICATION_DELAY_SECONDS)
  );

  // send push notification with eligibility details
  const maybeMessageType = getMessageType(validatedEligibilityCheck);

  if (isSome(maybeMessageType)) {
    yield context.df.callActivityWithRetry(
      "SendMessageActivity",
      retryOptions,
      SendMessageActivityInput.encode({
        checkProfile: false,
        content: MESSAGES[maybeMessageType.value](),
        fiscalCode: eligibilityCheckResponse.fiscalCode
      })
    );
    trackEvent({
      name: "bonus.eligibilitycheck.message",
      properties: {
        type: maybeMessageType.value
      }
    });
  } else {
    trackException({
      exception: new Error(
        `Cannot get message type for eligibility check: ${eligibilityCheckResponse.fiscalCode}`
      )
    });
  }

  return validatedEligibilityCheck;
};

export const index = df.orchestrator(handler);
