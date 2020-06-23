import { Either, left, right } from "fp-ts/lib/Either";
import { fromNullable } from "fp-ts/lib/Option";
import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal
} from "italia-ts-commons/lib/responses";
import { BonusProcessing } from "../models/bonus_Processing";

/**
 * Check if the current user has a pending activation request.
 * If there's no pending requests right(false) is returned
 */
export const checkBonusActivationIsRunning = (
  processingBonusIdIn: unknown
): Either<
  IResponseErrorInternal | IResponseErrorForbiddenNotAuthorized,
  false
> =>
  fromNullable(processingBonusIdIn).fold(
    // no processing bonus found for this user fiscal code
    // bonus activation can go on
    right(false),
    _ =>
      // processing bonus found for this user fiscal code
      // try to decode the result obtained from cosmosdb
      BonusProcessing.decode(_).fold<
        Either<
          IResponseErrorInternal | IResponseErrorForbiddenNotAuthorized,
          false
        >
      >(
        err =>
          left(
            ResponseErrorInternal(
              `Cannot decode the ID of the bonus being processed: '${err}'`
            )
          ),
        () =>
          // In case we have found a running bonus activation orchestrator
          // we block the eligibility check
          left(ResponseErrorForbiddenNotAuthorized)
      )
  );
