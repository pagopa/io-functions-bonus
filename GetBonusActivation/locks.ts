import { Either, fromOption, left, right } from "fp-ts/lib/Either";
import { Option } from "fp-ts/lib/Option";
import {
  IResponseErrorInternal,
  IResponseSuccessAccepted,
  ResponseErrorInternal,
  ResponseSuccessAccepted
} from "italia-ts-commons/lib/responses";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { InstanceId } from "../generated/definitions/InstanceId";
import { BonusProcessing } from "../models/bonus_processing";

/**
 * Check if the current user has a pending activation request.
 * If there's no pending requests right(false) is returned
 */
export const checkBonusActivationIsRunning = (
  maybeBonusProcessing: Option<BonusProcessing>
): Either<
  IResponseErrorInternal | IResponseSuccessAccepted<InstanceId>,
  false
> =>
  fromOption(undefined)(maybeBonusProcessing).fold(
    // no processing bonus found for this user fiscal code
    _ => right(false),
    _ =>
      // processing bonus found for this user fiscal code
      // try to decode the result obtained from cosmosdb
      BonusProcessing.decode(_).fold<
        Either<
          IResponseErrorInternal | IResponseSuccessAccepted<InstanceId>,
          false
        >
      >(
        err =>
          left(
            ResponseErrorInternal(
              `Cannot decode the ID of the bonus being processed: '${err}'`
            )
          ),
        ({ bonusId }) =>
          // In case we have found a running bonus activation orchestrator
          // we must return (202) the related bonus ID to the caller of the API:
          // the client needs to know the endpoint to poll to get the bonus details.
          left(
            ResponseSuccessAccepted(
              "Still running",
              InstanceId.encode({
                // PatternString vs NonEmptyString
                id: (bonusId as unknown) as NonEmptyString
              })
            )
          )
      )
  );
