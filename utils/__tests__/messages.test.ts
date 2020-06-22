import { isRight } from "fp-ts/lib/Either";
import { NewMessage } from "io-functions-commons/dist/generated/definitions/NewMessage";
import { getMessage } from "../../EligibilityCheckOrchestrator/index";
import { MESSAGES } from "../messages";

const aValidBeforeDate = new Date();

describe("Messages", () => {
  it("should decode all messages", () => {
    Object.keys(MESSAGES).forEach(k => {
      // tslint:disable-next-line: no-any
      const obtainedMessage = getMessage(
        k as keyof typeof MESSAGES,
        aValidBeforeDate
      );
      const ret = NewMessage.decode({
        content: obtainedMessage
      });
      expect(isRight(ret)).toBeTruthy();
    });
  });
});
