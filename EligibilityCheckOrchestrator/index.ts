import { IOrchestrationFunctionContext } from "durable-functions/lib/src/classes";

import { addSeconds } from "date-fns";
import * as df from "durable-functions";
import { isSome, none, Option, some } from "fp-ts/lib/Option";
import { MessageContent } from "io-functions-commons/dist/generated/definitions/MessageContent";
import { ActivityResult as DeleteEligibilityCheckActivityResult } from "../DeleteEligibilityCheckActivity/handler";
import { ActivityResult } from "../EligibilityCheckActivity/handler";
import { EligibilityCheck as ApiEligibilityCheck } from "../generated/definitions/EligibilityCheck";
import { EligibilityCheck } from "../generated/definitions/EligibilityCheck";
import { EligibilityCheckFailure } from "../generated/definitions/EligibilityCheckFailure";
import { EligibilityCheckSuccessConflict } from "../generated/definitions/EligibilityCheckSuccessConflict";
import { EligibilityCheckSuccessEligible } from "../generated/definitions/EligibilityCheckSuccessEligible";
import { EligibilityCheckSuccessIneligible } from "../generated/definitions/EligibilityCheckSuccessIneligible";
import { toApiEligibilityCheckFromDSU } from "../utils/conversions";
import { MESSAGES } from "../utils/messages";
import { retryOptions } from "../utils/retryPolicy";

import { readableReport } from "italia-ts-commons/lib/reporters";
import { ActivityInput as SendMessageActivityInput } from "../SendMessageActivity/handler";

const NOTIFICATION_DELAY_SECONDS = 10;

export const getMessage = (_: ApiEligibilityCheck): Option<MessageContent> => {
  return EligibilityCheckFailure.is(_)
    ? some(MESSAGES.EligibilityCheckFailure())
    : EligibilityCheckSuccessEligible.is(_) && _.dsu_request.has_discrepancies
    ? some(MESSAGES.EligibilityCheckSuccessEligibleWithDiscrepancies())
    : EligibilityCheckSuccessEligible.is(_)
    ? some(MESSAGES.EligibilityCheckSuccessEligible())
    : EligibilityCheckSuccessIneligible.is(_)
    ? some(MESSAGES.EligibilityCheckSuccessIneligible())
    : EligibilityCheckSuccessConflict.is(_)
    ? some(MESSAGES.EligibilityCheckConflict())
    : none;
};

export const handler = function*(
  context: IOrchestrationFunctionContext
): Generator {
  context.df.setCustomStatus("RUNNING");
  const orchestratorInput = context.df.getInput();
  // tslint:disable-next-line: no-let
  let validatedEligibilityCheck: EligibilityCheck;
  // tslint:disable-next-line: no-let
  let eligibilityCheckResponse: ActivityResult;
  try {
    const deleteEligibilityCheckResponse = yield context.df.callActivity(
      "DeleteEligibilityCheckActivity",
      orchestratorInput
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
      orchestratorInput
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
    const undecodedValidatedEligibilityCheck = yield context.df.callActivity(
      "ValidateEligibilityCheckActivity",
      eligibilityCheck
    );
    validatedEligibilityCheck = EligibilityCheck.decode(
      undecodedValidatedEligibilityCheck
    ).getOrElseL(error => {
      throw new Error(`Decoding Error: [${readableReport(error)}]`);
    });

    yield context.df.callActivityWithRetry(
      "UpsertEligibilityCheckActivity",
      retryOptions,
      validatedEligibilityCheck
    );
  } catch (err) {
    context.log.error("EligibilityCheckOrchestrator|ERROR|%s", err);
    return err;
  } finally {
    context.df.setCustomStatus("COMPLETED");
  }

  // sleep before sending push notification
  // so we can let the get operation stop the flow here
  yield context.df.createTimer(
    addSeconds(context.df.currentUtcDateTime, NOTIFICATION_DELAY_SECONDS)
  );

  // send push notification with eligibility details
  const maybeMessage = getMessage(validatedEligibilityCheck);

  if (isSome(maybeMessage)) {
    yield context.df.callActivityWithRetry(
      "SendMessageActivity",
      retryOptions,
      {
        content: maybeMessage.value,
        fiscalCode: eligibilityCheckResponse.fiscalCode
        // Cast needed to add type checking
      } as SendMessageActivityInput
    );
  } else {
    context.log.error(
      `EligibilityCheckOrchestrator|ERROR|Cannot decode eligibility check`
    );
    context.log.verbose(
      `EligibilityCheckOrchestrator|ERROR|Cannot decode eligibility check|CF=${eligibilityCheckResponse.fiscalCode}`
    );
  }

  return validatedEligibilityCheck;
};

export const index = df.orchestrator(handler);
