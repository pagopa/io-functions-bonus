import { Context } from "@azure/functions";
import { Left, toError } from "fp-ts/lib/Either";
import { fromEither, TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { BonusVacanzaBase } from "../generated/ade/BonusVacanzaBase";
import {
  ADEClientInstance,
  BonusVacanzaInvalidRequestError,
  BonusVacanzaTransientError
} from "../utils/adeClient";

export const SendBonusActivationSuccess = t.interface({
  kind: t.literal("SUCCESS")
});
export type SendBonusActivationSuccess = t.TypeOf<
  typeof SendBonusActivationSuccess
>;

export const SendBonusActivationUnhandledFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.union([t.string, t.object])
});
export type SendBonusActivationUnhandledFailure = t.TypeOf<
  typeof SendBonusActivationUnhandledFailure
>;

export const SendBonusActivationInvalidRequestFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: BonusVacanzaInvalidRequestError
});
export type SendBonusActivationInvalidRequestFailure = t.TypeOf<
  typeof SendBonusActivationInvalidRequestFailure
>;

export const SendBonusActivationFailure = t.union(
  [
    SendBonusActivationInvalidRequestFailure,
    SendBonusActivationUnhandledFailure
  ],
  "SendBonusActivationFailure"
);
export type SendBonusActivationFailure = t.TypeOf<
  typeof SendBonusActivationFailure
>;

export const SendBonusActivationResult = t.taggedUnion("kind", [
  SendBonusActivationSuccess,
  SendBonusActivationFailure
]);
export type SendBonusActivationResult = t.TypeOf<
  typeof SendBonusActivationResult
>;

type RichiestaBonusResponseT = ReturnType<
  ADEClientInstance["richiestaBonus"]
> extends Promise<infer L>
  ? L extends Left<infer _, infer T>
    ? T
    : never
  : never;

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
): TaskEither<Error, RichiestaBonusResponseT> => {
  return tryCatch(
    () =>
      adeClient
        .richiestaBonus({ bonusVacanzaBase })
        .then(validationErrorOrResponse =>
          validationErrorOrResponse.fold(
            err => {
              throw new Error(`Error: [${readableReport(err)}]`);
            },
            resp => resp
          )
        ),
    toError
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
  adeClient: ADEClientInstance
): ISendBonusActivationHandler {
  return async (
    context: Context,
    input: unknown
  ): Promise<SendBonusActivationResult> => {
    context.log.info(`SendBonusActivationActivity|INFO|Input: ${input}`);
    return await fromEither(
      BonusVacanzaBase.decode(input).mapLeft(
        err => new Error(`Error: [${readableReport(err)}]`)
      )
    )
      .chain(bonusVacanzaBase =>
        richiestaBonusTask(adeClient, bonusVacanzaBase)
      )
      .fold<SendBonusActivationResult>(
        unhandledError => {
          context.log.error(
            `SendBonusActivationActivity|UNHANDLED_ERROR=${unhandledError.message}`
          );
          return SendBonusActivationUnhandledFailure.encode({
            kind: "FAILURE",
            reason: unhandledError.message
          });
        },
        response => {
          if (BonusVacanzaTransientError.is(response.value)) {
            context.log.error(
              `SendBonusActivationActivity|TRANSIENT_ERROR=${response.status}:${response.value}`
            );
            // throw the exception so the activity can be retried by the orchestrator
            throw response;
          } else if (BonusVacanzaInvalidRequestError.is(response.value)) {
            context.log.error(
              `SendBonusActivationActivity|PERMANENT_ERROR=${response.status}:${response.value}`
            );
            return SendBonusActivationInvalidRequestFailure.encode({
              kind: "FAILURE",
              reason: response.value
            });
          } else if (response.status === 200) {
            return SendBonusActivationSuccess.encode({
              kind: "SUCCESS"
            });
          }
          context.log.error(
            `SendBonusActivationActivity|UNEXPECTED_ERROR=${response.status}:${response.value}`
          );
          return SendBonusActivationUnhandledFailure.encode({
            kind: "FAILURE",
            reason: response
          });
        }
      )
      .run();
  };
}

export default SendBonusActivationHandler;
