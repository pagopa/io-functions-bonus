import * as t from "io-ts";

import { Context } from "@azure/functions";

import { MessageContent } from "io-functions-commons/dist/generated/definitions/MessageContent";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import { toHash } from "../utils/hash";
import {
  GetProfileT,
  makeNewMessage,
  SendMessageT
} from "../utils/notifications";

export const ActivityInput = t.interface({
  checkProfile: t.boolean,
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

export const getSendMessageActivityHandler = (
  getProfile: GetProfileT,
  sendMessage: SendMessageT,
  logPrefix: string = `SendMessageActivity`
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
    async ({ content, fiscalCode, checkProfile }) => {
      const cfHash = toHash(fiscalCode);
      // throws in case of timeout so
      // the orchestrator can schedule a retry
      if (checkProfile) {
        const getProfileStatus = await getProfile(fiscalCode);

        if (getProfileStatus !== 200) {
          if (getProfileStatus === 404) {
            context.log.verbose(
              `${logPrefix}|CFHASH=${cfHash}|PROFILE_NOT_FOUND`
            );
            // In case the profile is not found continue
            return success();
          }
          const msg = `${logPrefix}|CFHASH=${cfHash}|ERROR=${getProfileStatus}`;
          if (getProfileStatus >= 500) {
            throw new Error(msg);
          } else {
            return failure(msg);
          }
        }
      }

      const sendMessageStatus = await sendMessage(
        fiscalCode,
        makeNewMessage(content)
      );

      if (sendMessageStatus !== 201) {
        const msg = `${logPrefix}|CFHASH=${cfHash}|ERROR=${sendMessageStatus}`;
        if (sendMessageStatus >= 500) {
          throw new Error(msg);
        } else {
          return failure(msg);
        }
      }

      context.log.verbose(
        `${logPrefix}|CFHASH=${cfHash}|RESPONSE=${sendMessageStatus}`
      );
      return success();
    }
  );
};
