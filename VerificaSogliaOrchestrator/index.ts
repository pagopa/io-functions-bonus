import {
  IOrchestrationFunctionContext,
  Task,
  TaskSet
} from "durable-functions/lib/src/classes";

import * as df from "durable-functions";
import * as moment from "moment";

const VerificaSogliaOrchestrator = df.orchestrator(function*(
  context: IOrchestrationFunctionContext
  // tslint:disable-next-line: no-any
): Generator<TaskSet | Task> {
  context.df.setCustomStatus({});
  const taskVerificaSoglia = yield context.df.callActivityWithRetry(
    "VerificaSogliaActivity",
    new df.RetryOptions(60000, 20),
    context.df.getInput()
  );
  context.df.setCustomStatus(taskVerificaSoglia);
  const deadline = moment.utc(context.df.currentUtcDateTime).add(10, "seconds");
  yield context.df.createTimer(deadline.toDate());

  yield context.df.callActivity("NotifyVerificaSogliaActivity");

  return taskVerificaSoglia;
});

export default VerificaSogliaOrchestrator;
