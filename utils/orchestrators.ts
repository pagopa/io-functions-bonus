import * as df from "durable-functions";
import { DurableOrchestrationClient } from "durable-functions/lib/src/durableorchestrationclient";

import { toError } from "fp-ts/lib/Either";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";

import { FiscalCode } from "italia-ts-commons/lib/strings";
import { PromiseType } from "italia-ts-commons/lib/types";

/**
 * The identifier for StartBonusActivationOrchestrator
 * @param fiscalCode the id of the requesting user
 */
export const makeStartBonusActivationOrchestratorId = (
  fiscalCode: FiscalCode
) => `${fiscalCode}-BV01ACTIVATION`;

/**
 * The identifier for StartEligibilityCheckOrchestrator
 * @param fiscalCode the id of the requesting user
 */
export const makeStartEligibilityCheckOrchestratorId = (
  fiscalCode: FiscalCode
) => `${fiscalCode}-BV01DSU`;

/**
 * Returns the status of the orchestrator augmented with an isRunning attribute
 */
export const isOrchestratorRunning = (
  client: DurableOrchestrationClient,
  orchestratorId: string
): TaskEither<
  Error,
  PromiseType<ReturnType<typeof client["getStatus"]>> & { isRunning: boolean }
> =>
  tryCatch(() => client.getStatus(orchestratorId), toError).map(status => ({
    ...status,
    isRunning: status.runtimeStatus === df.OrchestrationRuntimeStatus.Running
  }));
