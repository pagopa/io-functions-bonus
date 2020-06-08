import {
  IOrchestrationFunctionContext,
  Task,
  TaskSet
} from "durable-functions/lib/src/classes";

import { addSeconds } from "date-fns";
import * as df from "durable-functions";
import { ActivityResult as DeleteEligibilityCheckActivityResult } from "../DeleteEligibilityCheckActivity/handler";
import { ActivityResult } from "../EligibilityCheckActivity/handler";

const NOTIFICATION_DELAY_SECONDS = 10;

const EligibilityCheckOrchestrator = df.orchestrator(function*(
  context: IOrchestrationFunctionContext
): Generator<TaskSet | Task> {
  const retryOptions = {
    backoffCoefficient: 1.5,
    firstRetryIntervalInMilliseconds: 1000,
    maxNumberOfAttempts: 10,
    maxRetryIntervalInMilliseconds: 3600 * 100,
    retryTimeoutInMilliseconds: 3600 * 1000
  };
  context.df.setCustomStatus("RUNNING");
  const deleteEligibilityCheckResponse = yield context.df.callActivity(
    "DeleteEligibilityCheckActivity",
    context.df.getInput()
  );

  DeleteEligibilityCheckActivityResult.decode(
    deleteEligibilityCheckResponse
  ).map(_ => {
    if (_.kind === "FAILURE") {
      context.log.error(`EligibilityCheckOrchestrator|ERROR|${_.reason}`);
    }
  });

  const undecodedEligibilityCheckResponse = yield context.df.callActivityWithRetry(
    "EligibilityCheckActivity",
    retryOptions,
    context.df.getInput()
  );
  const eligibilityCheckResponse = ActivityResult.decode(
    undecodedEligibilityCheckResponse
  ).getOrElse({
    kind: "FAILURE",
    reason: "ActivityResult decoding error"
  });
  yield context.df.callActivityWithRetry(
    "SaveEligibilityCheckActivity",
    retryOptions,
    eligibilityCheckResponse
  );
  context.df.setCustomStatus("COMPLETED");

  // sleep before sending push notification
  // so we can let the get operation stop the flow here
  yield context.df.createTimer(
    addSeconds(context.df.currentUtcDateTime, NOTIFICATION_DELAY_SECONDS)
  );

  // send push notification with eligibility details
  yield context.df.callActivity(
    "NotifyEligibilityCheckActivity",
    eligibilityCheckResponse
  );

  return eligibilityCheckResponse;
});

export default EligibilityCheckOrchestrator;
