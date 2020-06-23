import { fromNullable, Option } from "fp-ts/lib/Option";
import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal
} from "italia-ts-commons/lib/responses";
import { BonusProcessing } from "../models/bonus_processing";

/**
 * Check if the current user has a pending bonus activation request.
 */
export const checkBonusActivationIsRunning = (
  processingBonusIdIn: unknown
): Option<IResponseErrorInternal | IResponseErrorForbiddenNotAuthorized> =>
  fromNullable(processingBonusIdIn).map(
    // no processing bonus found for this user fiscal code
    // bonus activation can go on
    _ =>
      // processing bonus found for this user fiscal code
      // try to decode the result obtained from cosmosdb
      BonusProcessing.decode(_).fold<
        IResponseErrorInternal | IResponseErrorForbiddenNotAuthorized
      >(
        err =>
          ResponseErrorInternal(
            `Cannot decode the ID of the bonus being processed: '${err}'`
          ),
        () =>
          // In case we have found a running bonus activation orchestrator
          // we block the eligibility check
          ResponseErrorForbiddenNotAuthorized
      )
  );
