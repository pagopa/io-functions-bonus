/*
 * This function is not intended to be invoked directly. Instead it will be
 * triggered by an HTTP starter function.
 *
 * Before running this sample, please:
 * - create a Durable activity function (default name is "Hello")
 * - create a Durable HTTP starter function
 * - run 'npm install durable-functions' from the wwwroot folder of your
 *    function app in Kudu
 */

import {
  IOrchestrationFunctionContext,
  Task
} from "durable-functions/lib/src/classes";

import * as df from "durable-functions";

const orchestrator = df.orchestrator(function*(
  context: IOrchestrationFunctionContext
): Generator<Task> {
  context.log.info("IS replaying %s", context.df.isReplaying);
  return yield context.df.callActivityWithRetry(
    "ActivityFunction",
    {
      backoffCoefficient: 1,
      firstRetryIntervalInMilliseconds: 1000,
      maxNumberOfAttempts: 100,
      maxRetryIntervalInMilliseconds: 1000000,
      retryTimeoutInMilliseconds: 10000
    },
    JSON.stringify(context.bindingData)
  );
});

export default orchestrator;
