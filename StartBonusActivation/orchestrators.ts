import { DurableOrchestrationClient } from "durable-functions/lib/src/durableorchestrationclient";
import { left, right } from "fp-ts/lib/Either";
import {
  fromEither,
  fromLeft,
  TaskEither,
  taskEither,
  tryCatch
} from "fp-ts/lib/TaskEither";
import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseSuccessAccepted,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal,
  ResponseSuccessAccepted
} from "italia-ts-commons/lib/responses";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import {
  isOrchestratorRunning,
  makeStartBonusActivationOrchestratorId,
  makeStartEligibilityCheckOrchestratorId
} from "../utils/orchestrators";

import { toString } from "fp-ts/lib/function";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { InstanceId } from "../generated/definitions/InstanceId";

/**
 * Check if the provided user has a pending activation request.
 * If there's no pending requests right(false) is returned
 * @param client
 * @param fiscalCode
 *
 * @returns either false or a custom response indicating whether there's a process running or there has been an internal error during the check
 */
export const checkBonusActivationIsRunning = (
  client: DurableOrchestrationClient,
  fiscalCode: FiscalCode
): TaskEither<
  // FIXME: the fact that an IResponseSuccessAccepted is on the left side of the
  //        Either is a little weird, perhaps we should have it on the right
  //        side as an option (some -> true/instanceId, none -> false)
  IResponseErrorInternal | IResponseSuccessAccepted<InstanceId>,
  false
> =>
  isOrchestratorRunning(
    client,
    makeStartBonusActivationOrchestratorId(fiscalCode)
  ).foldTaskEither(
    err =>
      fromEither(
        left(
          ResponseErrorInternal(
            `Cannot get BonusActivationOrchestrator status: ${err.message}`
          )
        )
      ),
    ({ customStatus, isRunning }) =>
      isRunning
        ? tryCatch(
            async () => {
              // In case we have found a running bonus activation orchestrator
              // we must return (202) the related bonus ID to the caller of the API:
              // the client needs to know the endpoint to poll to get the bonus details.
              // That's why here we try to get the bonus ID from the
              // running orchestrator custom status.
              return NonEmptyString.decode(customStatus).fold<
                IResponseErrorInternal | IResponseSuccessAccepted<InstanceId>
              >(
                errs =>
                  ResponseErrorInternal(
                    `Cannot decode the ID of the bonus being processed: '${readableReport(
                      errs
                    )}'`
                  ),
                bonusId =>
                  ResponseSuccessAccepted(
                    "Still running",
                    InstanceId.encode({
                      id: bonusId
                    })
                  )
              );
            },
            err =>
              ResponseErrorInternal(
                `Cannot get the ID of the bonus being processed: ${toString(
                  err
                )}`
              )
            // collapse the right parts into lefts
            // as the only right value here may be the boolean 'false'
          ).foldTaskEither<
            IResponseErrorInternal | IResponseSuccessAccepted<InstanceId>,
            false
          >(fromLeft, fromLeft)
        : taskEither.of(false)
  );

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
