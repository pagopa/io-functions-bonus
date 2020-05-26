import {
  IOrchestrationFunctionContext,
  Task
} from "durable-functions/lib/src/classes";

import * as df from "durable-functions";
import * as t from "io-ts";

const orchestrator = df.orchestrator(function*(
  context: IOrchestrationFunctionContext
  // tslint:disable-next-line: no-any
): Generator<Task> {
  return yield context.df.callActivityWithRetry(
    "VerificaSogliaActivity",
    new df.RetryOptions(60000, 20),
    context.df.getInput()
  );
});

export default orchestrator;
