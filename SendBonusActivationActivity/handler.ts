import { Context } from "@azure/functions";
import { toError } from "fp-ts/lib/Either";
import {
  fromEither,
  fromLeft,
  TaskEither,
  taskEither,
  tryCatch
} from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { TypeofApiResponse } from "italia-ts-commons/lib/requests";
import {
  ADEClientInstance,
  BonusVacanzaInvalidRequestError,
  BonusVacanzaTransientError
} from "../clients/adeClient";
import { BonusVacanzaBase } from "../generated/ade/BonusVacanzaBase";
import { RichiestaBonusT } from "../generated/ade/requestTypes";
import { trackException } from "../utils/appinsights";

export const SendBonusActivationInput = BonusVacanzaBase;
export type SendBonusActivationInput = t.TypeOf<
  typeof SendBonusActivationInput
>;

// fails validating activity input
export type InvalidInputFailure = t.TypeOf<typeof UnhandledFailure>;
export const InvalidInputFailure = t.interface({
  kind: t.literal("INVALID_INPUT"),
  reason: t.string
});

// fails parsing the response from ADE service
export type ResponseParseFailure = t.TypeOf<typeof ResponseParseFailure>;
export const ResponseParseFailure = t.interface({
  kind: t.literal("RESPONSE_PARSE"),
  reason: t.string
});

// fails to perfom a request to the ADE service
export type ADEServiceFailure = t.TypeOf<typeof ADEServiceFailure>;
export const ADEServiceFailure = t.interface({
  kind: t.literal("ADE_SERVICE"),
  reason: t.string
});

// unhandled code failure
export type UnhandledFailure = t.TypeOf<typeof UnhandledFailure>;
export const UnhandledFailure = t.interface({
  kind: t.literal("UNHANDLED_FAILURE"),
  reason: t.string
});

// the response from ADE service is ok, but the bonus wasn't accepted by ADE
export type InvalidRequestFailure = t.TypeOf<typeof InvalidRequestFailure>;
export const InvalidRequestFailure = t.interface({
  kind: t.literal("INVALID_REQUEST_FAILURE"),
  reason: BonusVacanzaInvalidRequestError
});

// failures related to the execution of the current activity
export type ActivityRuntimeFailure = t.TypeOf<typeof ActivityRuntimeFailure>;
export const ActivityRuntimeFailure = t.union(
  [
    UnhandledFailure,
    InvalidInputFailure,
    ResponseParseFailure,
    ADEServiceFailure
  ],
  "ActivityRuntimeFailure"
);

// any failure case for this activity
export type SendBonusActivationFailure = t.TypeOf<
  typeof SendBonusActivationFailure
>;
export const SendBonusActivationFailure = t.union(
  [ActivityRuntimeFailure, InvalidRequestFailure],
  "SendBonusActivationFailure"
);

// no runtime errors and the response from ADE was positive
export type SendBonusActivationSuccess = t.TypeOf<
  typeof SendBonusActivationSuccess
>;
export const SendBonusActivationSuccess = t.interface({
  kind: t.literal("SUCCESS")
});

// union all possibile outcomes of the current activity
export const SendBonusActivationResult = t.taggedUnion("kind", [
  SendBonusActivationFailure,
  SendBonusActivationSuccess
]);
export type SendBonusActivationResult = t.TypeOf<
  typeof SendBonusActivationResult
>;

// any case we consider to be temporary error
export type SendBonusActivationTransientFailure = t.TypeOf<
  typeof SendBonusActivationTransientFailure
>;
export const SendBonusActivationTransientFailure = t.union(
  [BonusVacanzaTransientError, ADEServiceFailure],
  "SendBonusActivationTransientFailure"
);

/**
 * Lift adeClient.richiestaBonus to TaskEither type
 * @param adeClient a client instance
 * @param bonusVacanzaBase the input to be pass
 *
 * @returns either an Error or an API Response
 */
const richiestaBonusTask = (
  adeClient: ADEClientInstance,
  bonusVacanzaBase: BonusVacanzaBase
): TaskEither<
  ADEServiceFailure | ResponseParseFailure,
  TypeofApiResponse<RichiestaBonusT>
> => {
  return tryCatch(
    () => adeClient.richiestaBonus({ bonusVacanzaBase }),
    err =>
      ADEServiceFailure.encode({
        kind: "ADE_SERVICE",
        reason: toError(err).message
      })
  ).foldTaskEither<
    ADEServiceFailure | ResponseParseFailure,
    TypeofApiResponse<RichiestaBonusT>
  >(
    err => fromLeft(err),
    validationErrorOrResponse =>
      fromEither(validationErrorOrResponse).mapLeft(validations =>
        ResponseParseFailure.encode({
          kind: "RESPONSE_PARSE",
          reason: readableReport(validations)
        })
      )
  );
};

type ISendBonusActivationHandler = (
  context: Context,
  input: unknown
) => Promise<SendBonusActivationResult>;

/**
 * Call ADE rest service to activate a bonus
 *
 * @param adeClient an instance of ADE Client
 *
 * @returns either a success or a failure request
 * @throws when the response is considered a transient failure and thus is not considered a domain message
 */
export function SendBonusActivationHandler(
  adeClient: ADEClientInstance,
  logPrefix = `SendBonusActivationActivity`
): ISendBonusActivationHandler {
  return async (
    context: Context,
    input: unknown
  ): Promise<SendBonusActivationResult> => {
    context.log.verbose(`${logPrefix}|ACTIVITY_INPUT=${JSON.stringify(input)}`);
    return taskEither
      .of<ActivityRuntimeFailure, void>(void 0)
      .chain(_ =>
        fromEither(SendBonusActivationInput.decode(input)).mapLeft(err =>
          InvalidInputFailure.encode({
            kind: "INVALID_INPUT",
            reason: readableReport(err)
          })
        )
      )
      .chain(bonusVacanzaBase =>
        richiestaBonusTask(adeClient, bonusVacanzaBase)
      )
      .fold<SendBonusActivationResult>(
        activityFailure => {
          if (SendBonusActivationTransientFailure.is(activityFailure)) {
            const error = `${logPrefix}|TRANSIENT_ERROR=${activityFailure.kind}:${activityFailure.reason}`;
            context.log.error(error);

            trackException({
              exception: new Error(error),
              properties: {
                name: "bonus.activation.failure.temporary"
              }
            });

            // Trigger a retry in case of temporary failures
            throw activityFailure;
          } else {
            const error = `${logPrefix}|PERMANENT_ERROR=${activityFailure.kind}=${activityFailure.reason}`;
            context.log.error(error);

            trackException({
              exception: new Error(error),
              properties: {
                name: "bonus.activation.failure.permanent"
              }
            });

            return activityFailure;
          }
        },
        adeResponse => {
          if (SendBonusActivationTransientFailure.is(adeResponse.value)) {
            const error = `${logPrefix}|TRANSIENT_ERROR=${adeResponse.status}:${adeResponse.value}`;
            context.log.error(error);

            trackException({
              exception: new Error(error),
              properties: {
                name: "bonus.activation.failure.temporary"
              }
            });

            // Trigger a retry in case of temporary failures
            throw adeResponse;
          } else if (BonusVacanzaInvalidRequestError.is(adeResponse.value)) {
            // ADE rejected the user's bonus activation

            const error = `${logPrefix}|PERMANENT_ERROR=${adeResponse.status}:${adeResponse.value}`;
            context.log.error(error);

            trackException({
              exception: new Error(error),
              properties: {
                name: "bonus.activation.failure.permanent"
              }
            });

            return InvalidRequestFailure.encode({
              kind: "INVALID_REQUEST_FAILURE",
              reason: adeResponse.value
            });
          } else if (adeResponse.status === 200) {
            // Everything is ok, why did you worried so much?
            return SendBonusActivationSuccess.encode({
              kind: "SUCCESS"
            });
          } else {
            // This should not happen, as BonusVacanzaInvalidRequestError
            // and BonusVacanzaTransientError should map the entire set of rejection
            const error = `${logPrefix}|UNEXPECTED_ERROR=${adeResponse.status}:${adeResponse.value.errorCode}=${adeResponse.value.errorMessage}`;
            context.log.error(error);

            trackException({
              exception: new Error(error),
              properties: {
                name: "bonus.activation.failure.unexpected"
              }
            });

            return UnhandledFailure.encode({
              kind: "UNHANDLED_FAILURE",
              reason: JSON.stringify(adeResponse)
            });
          }
        }
      )
      .run();
  };
}

export default SendBonusActivationHandler;
