import { Context } from "@azure/functions";
import { NewMessage } from "io-functions-commons/dist/generated/definitions/NewMessage";
import { readableReport } from "italia-ts-commons/lib/reporters";

import { MessageContent } from "io-functions-commons/dist/generated/definitions/MessageContent";
import * as t from "io-ts";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { toHash } from "../utils/hash";
import { sendMessage } from "../utils/notifications";

const makeNewMessage = (content: MessageContent) =>
  NewMessage.decode({
    content
  }).getOrElseL(errs => {
    throw new Error("Invalid MessageContent: " + readableReport(errs));
  });

export const ActivityInput = t.interface({
  content: MessageContent,
  fiscalCode: FiscalCode
});
export type ActivityInput = t.TypeOf<typeof ActivityInput>;

// Activity result
const ActivityResultSuccess = t.interface({
  kind: t.literal("SUCCESS")
});

type ActivityResultSuccess = t.TypeOf<typeof ActivityResultSuccess>;

const ActivityResultFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});

type ActivityResultFailure = t.TypeOf<typeof ActivityResultFailure>;

export const ActivityResult = t.taggedUnion("kind", [
  ActivityResultSuccess,
  ActivityResultFailure
]);
export type ActivityResult = t.TypeOf<typeof ActivityResult>;

export const getActivityFunction = (
  publicApiUrl: NonEmptyString,
  publicApiKey: NonEmptyString,
  timeoutFetch: typeof fetch,
  logPrefix = `SendMessageActivity`
) => (context: Context, input: unknown): Promise<ActivityResult> => {
  const failure = (reason: string) => {
    context.log.error(reason);
    return ActivityResultFailure.encode({
      kind: "FAILURE",
      reason
    });
  };

  const success = () =>
    ActivityResultSuccess.encode({
      kind: "SUCCESS"
    });

  return ActivityInput.decode(input).fold<Promise<ActivityResult>>(
    async errs =>
      failure(
        `${logPrefix}|Cannot decode input|ERROR=${readableReport(
          errs
        )}|INPUT=${JSON.stringify(input)}`
      ),
    async ({ content, fiscalCode }) => {
      const cfHash = toHash(fiscalCode);
      // throws in case of timeout so
      // the orchestrator can schedule a retry
      const status = await sendMessage(
        fiscalCode,
        publicApiUrl,
        publicApiKey,
        makeNewMessage(content),
        timeoutFetch
      );

      if (status !== 201) {
        const msg = `${logPrefix}|CFHASH=${cfHash}|ERROR=${status}`;
        if (status >= 500) {
          throw new Error(msg);
        } else {
          return failure(msg);
        }
      }

      context.log.verbose(`${logPrefix}|CFHASH=${cfHash}|RESPONSE=${status}`);
      return success();
    }
  );
};

export default getActivityFunction;
