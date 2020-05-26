import {
  IOrchestrationFunctionContext,
  Task,
  TaskSet
} from "durable-functions/lib/src/classes";

import add from "date-fns/add";
import * as df from "durable-functions";

const NOTIFICATION_DELAY_SECONDS = 10;

const VerificaSogliaOrchestrator = df.orchestrator(function*(
  context: IOrchestrationFunctionContext
  // tslint:disable-next-line: no-any
): Generator<TaskSet | Task> {
  context.df.setCustomStatus({});
  const taskVerificaSoglia = yield context.df.callActivityWithRetry(
    "VerificaSogliaActivity",
    {
      backoffCoefficient: 1.5,
      firstRetryIntervalInMilliseconds: 1000,
      maxNumberOfAttempts: 10,
      maxRetryIntervalInMilliseconds: 3600 * 100,
      retryTimeoutInMilliseconds: 3600 * 1000
    },
    context.df.getInput()
  );
  context.df.setCustomStatus(taskVerificaSoglia);

  // sleep before sending push notification
  // so we can let the client stop the flow here
  yield context.df.createTimer(
    add(context.df.currentUtcDateTime, {
      seconds: NOTIFICATION_DELAY_SECONDS
    })
  );

  // send push notification with eligibility details
  yield context.df.callActivity("NotifyVerificaSogliaActivity");

  return taskVerificaSoglia;
});

export default VerificaSogliaOrchestrator;
