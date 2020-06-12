import { isRight } from "fp-ts/lib/Either";
import { aRetrievedBonusActivation } from "../../__mocks__/mocks";
import { RetrievedBonusActivation } from "../bonus_activation";

describe("simple", () => {
  it("should decode", () => {
    const clone = RetrievedBonusActivation.encode(aRetrievedBonusActivation);
    const cloneDecoded = RetrievedBonusActivation.decode(clone);

    expect(isRight(cloneDecoded)).toBeTruthy();
  });
});
