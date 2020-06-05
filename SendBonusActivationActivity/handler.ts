import { Context } from "@azure/functions";
import { fromEither } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode } from "italia-ts-commons/lib/strings";

export const SendBonusActivationSuccess = t.interface({
  kind: t.literal("SUCCESS")
});
export type SendBonusActivationSuccess = t.TypeOf<
  typeof SendBonusActivationSuccess
>;

export const SendBonusActivationFailure = t.interface({
  kind: t.literal("FAILURE")
});
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

type ISendBonusActivationHandler = (
  context: Context,
  input: unknown
) => Promise<SendBonusActivationResult>;

export function SendBonusActivationHandler(): ISendBonusActivationHandler {
  return async (
    context: Context,
    input: unknown
  ): Promise<SendBonusActivationResult> => {
    context.log.info(`SendBonusActivationActivity|INFO|Input: ${input}`);
    return await fromEither(
      FiscalCode.decode(input).mapLeft(
        err => new Error(`Error: [${readableReport(err)}]`)
      )
    )
      .fold<SendBonusActivationResult>(
        _ =>
          SendBonusActivationFailure.encode({
            kind: "FAILURE"
          }),
        _ =>
          SendBonusActivationSuccess.encode({
            kind: "SUCCESS"
          })
      )
      .run();
  };
}

export default SendBonusActivationHandler;
