import {
  IOrchestrationFunctionContext,
  Task,
  TaskSet
} from "durable-functions/lib/src/classes";

import add from "date-fns/add";
import * as df from "durable-functions";

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
  yield context.df.createTimer(
    add(context.df.currentUtcDateTime, { seconds: 10 })
  );

  yield context.df.callActivity("NotifyVerificaSogliaActivity");

  return taskVerificaSoglia;
});

export default VerificaSogliaOrchestrator;
