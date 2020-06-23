import { DurableOrchestrationClient } from "durable-functions/lib/src/durableorchestrationclient";
import { left, right } from "fp-ts/lib/Either";
import { fromEither, TaskEither } from "fp-ts/lib/TaskEither";
import {
  IResponseErrorInternal,
  IResponseSuccessAccepted,
  ResponseErrorInternal,
  ResponseSuccessAccepted
} from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import {
  isOrchestratorRunning,
  makeStartEligibilityCheckOrchestratorId
} from "../utils/orchestrators";

/**
 * Check if the current user has a pending dsu validation request.
 */
export const checkEligibilityCheckIsRunning = (
  client: DurableOrchestrationClient,
  fiscalCode: FiscalCode
): TaskEither<IResponseErrorInternal | IResponseSuccessAccepted, false> =>
  isOrchestratorRunning(
    client,
    makeStartEligibilityCheckOrchestratorId(fiscalCode)
  ).foldTaskEither<IResponseErrorInternal | IResponseSuccessAccepted, false>(
    err =>
      fromEither(
        left(
          ResponseErrorInternal(
            `Error checking EligibilityCheckOrchestrator: ${err.message}`
          )
        )
      ),
    ({ isRunning }) =>
      fromEither(isRunning ? left(ResponseSuccessAccepted()) : right(false))
  );
