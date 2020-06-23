import { DurableOrchestrationClient } from "durable-functions/lib/src/durableorchestrationclient";
import { left, right } from "fp-ts/lib/Either";
import { fromEither, TaskEither } from "fp-ts/lib/TaskEither";
import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal
} from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import {
  isOrchestratorRunning,
  makeStartEligibilityCheckOrchestratorId
} from "../utils/orchestrators";

/**
 * Check if the current user has a pending dsu validation request.
 * If there's no pending requests right(false) is returned
 * @param client
 * @param fiscalCode
 *
 * @returns either false or a custom response indicating whether there's a process running or there has been an internal error during the check
 */
export const checkEligibilityCheckIsRunning = (
  client: DurableOrchestrationClient,
  fiscalCode: FiscalCode
): TaskEither<
  IResponseErrorInternal | IResponseErrorForbiddenNotAuthorized,
  false
> =>
  isOrchestratorRunning(
    client,
    makeStartEligibilityCheckOrchestratorId(fiscalCode)
  ).foldTaskEither<
    IResponseErrorInternal | IResponseErrorForbiddenNotAuthorized,
    false
  >(
    err =>
      fromEither(
        left(
          ResponseErrorInternal(
            `Error checking EligibilityCheckOrchestrator: ${err.message}`
          )
        )
      ),
    ({ isRunning }) =>
      fromEither(
        isRunning ? left(ResponseErrorForbiddenNotAuthorized) : right(false)
      )
  );
