import { Context } from "@azure/functions";
import { NewMessage } from "io-functions-commons/dist/generated/definitions/NewMessage";
import { readableReport } from "italia-ts-commons/lib/reporters";

import * as t from "io-ts";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { toHash } from "../utils/hash";
import { sendMessage } from "../utils/notifications";

// TODO: switch text based on user's preferred_language
const eligibiliyCheckMessage = () =>
  NewMessage.decode({
    content: {
      // TODO: insert real text
      markdown: `In non occaecat aliqua pariatur consectetur ad. Fugiat aliquip ut in nulla commodo irure enim consectetur eiusmod magna sint ea. Incididunt consequat pariatur nisi elit anim et fugiat dolore enim dolor adipisicing laboris do. Aliquip aliquip dolore sint excepteur fugiat deserunt consequat.`,
      subject: `IO App - ricezione dati ISEE`
    }
  }).getOrElseL(errs => {
    throw new Error("Invalid MessageContent: " + readableReport(errs));
  });

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

export const ActivityInput = t.interface({
  blobName: t.string,
  fiscalCode: FiscalCode,
  password: t.string
});
export type ActivityInput = t.TypeOf<typeof ActivityInput>;

export const getActivityFunction = (
  publicApiUrl: NonEmptyString,
  publicApiKey: NonEmptyString,
  timeoutFetch: typeof fetch,
  logPrefix = `NotifyEligibilityCheckActivity`
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
    async ({ fiscalCode }) => {
      const cfHash = toHash(fiscalCode);
      // throws in case of timeout so
      // the orchestrator can schedule a retry
      const status = await sendMessage(
        fiscalCode,
        publicApiUrl,
        publicApiKey,
        eligibiliyCheckMessage(),
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

      context.log.info(`${logPrefix}|CFHASH=${cfHash}|RESPONSE=${status}`);
      return success();
    }
  );
};

export default getActivityFunction;
