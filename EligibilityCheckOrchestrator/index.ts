import {
  IOrchestrationFunctionContext,
  Task,
  TaskSet
} from "durable-functions/lib/src/classes";

import { addSeconds } from "date-fns";
import * as df from "durable-functions";
import { ActivityResult as DeleteEligibilityCheckActivityResult } from "../DeleteEligibilityCheckActivity/handler";
import { ActivityResult } from "../EligibilityCheckActivity/handler";
import { EligibilityCheckFailure } from "../generated/models/EligibilityCheckFailure";
import { EligibilityCheckSuccessEligible } from "../generated/models/EligibilityCheckSuccessEligible";
import { EligibilityCheckSuccessIneligible } from "../generated/models/EligibilityCheckSuccessIneligible";
import { toEligibilityCheckFromDSU } from "../utils/conversions";
import { MESSAGES } from "../utils/messages";
import { retryOptions } from "../utils/retryPolicy";

const NOTIFICATION_DELAY_SECONDS = 10;

const EligibilityCheckOrchestrator = df.orchestrator(function*(
  context: IOrchestrationFunctionContext
): Generator<TaskSet | Task> {
  context.df.setCustomStatus("RUNNING");
  const orchestratorInput = context.df.getInput();
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
    yield context.df.callActivityWithRetry(
      "UpsertEligibilityCheckActivity",
      retryOptions,
      eligibilityCheckResponse
    );
  } catch (err) {
    context.log.error("EligibilityCheckOrchestrator|ERROR|%s", err);
    context.df.setCustomStatus("COMPLETED");
    return err;
  }
  context.df.setCustomStatus("COMPLETED");

  // sleep before sending push notification
  // so we can let the get operation stop the flow here
  yield context.df.createTimer(
    addSeconds(context.df.currentUtcDateTime, NOTIFICATION_DELAY_SECONDS)
  );

  const eligibilityCheck = toEligibilityCheckFromDSU(
    eligibilityCheckResponse.data,
    eligibilityCheckResponse.fiscalCode,
    eligibilityCheckResponse.validBefore
  );

  // send push notification with eligibility details
  yield context.df.callActivity(
    "SendMessageActivity",
    EligibilityCheckFailure.is(eligibilityCheck)
      ? MESSAGES.EligibilityCheckFailure()
      : EligibilityCheckSuccessEligible.is(eligibilityCheck)
      ? MESSAGES.EligibilityCheckSuccessEligible()
      : EligibilityCheckSuccessIneligible.is(eligibilityCheck)
      ? MESSAGES.EligibilityCheckSuccessIneligible()
      : {}
  );

  return eligibilityCheckResponse;
});

export default EligibilityCheckOrchestrator;
