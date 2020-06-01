import {
  IOrchestrationFunctionContext,
  Task,
  TaskSet
} from "durable-functions/lib/src/classes";

import { addSeconds } from "date-fns";
import * as df from "durable-functions";

const NOTIFICATION_DELAY_SECONDS = 10;

const EligibilityCheckOrchestrator = df.orchestrator(function*(
  context: IOrchestrationFunctionContext
  // tslint:disable-next-line: no-any
): Generator<TaskSet | Task> {
  context.df.setCustomStatus({});
  const eligibilityCheckResponse = yield context.df.callActivityWithRetry(
    "EligibilityCheckActivity",
    {
      backoffCoefficient: 1.5,
      firstRetryIntervalInMilliseconds: 1000,
      maxNumberOfAttempts: 10,
      maxRetryIntervalInMilliseconds: 3600 * 100,
      retryTimeoutInMilliseconds: 3600 * 1000
    },
    context.df.getInput()
  );
  // TODO: Decode EligibilityCheckActivity response
  context.df.setCustomStatus(eligibilityCheckResponse);

  // sleep before sending push notification
  // so we can let the client stop the flow here
  yield context.df.createTimer(
    addSeconds(context.df.currentUtcDateTime, NOTIFICATION_DELAY_SECONDS)
  );

  // send push notification with eligibility details
  yield context.df.callActivity(
    "NotifyEligibilityCheck",
    eligibilityCheckResponse
  );

  return eligibilityCheckResponse;
});

export default EligibilityCheckOrchestrator;
