import { isRight } from "fp-ts/lib/Either";
import { NewMessage } from "io-functions-commons/dist/generated/definitions/NewMessage";
import { MESSAGES } from "../messages";

describe("Messages", () => {
  it("should decode all messages", () => {
    Object.keys(MESSAGES).forEach(k => {
      // tslint:disable-next-line: no-any
      const ret = NewMessage.decode({ content: (MESSAGES as any)[k]() });
      expect(isRight(ret)).toBeTruthy();
    });
  });
});
