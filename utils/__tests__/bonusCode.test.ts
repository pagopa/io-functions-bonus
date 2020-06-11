import fc from "fast-check";

import { isLeft, isRight } from "fp-ts/lib/Either";

import { BonusCode } from "../../generated/definitions/BonusCode";

import { ALPHABET, genRandomBonusCode } from "../bonusCode";

describe("BonusCode", () => {
  const alphaIdxArb = fc.integer(0, ALPHABET.length - 1);
  const alphaArb = alphaIdxArb.map(i => ALPHABET[i]);
  const bonusCodeArb = fc.stringOf(alphaArb, 12, 12);
  const invalidBonusCodeArb = fc
    .string()
    .filter(s => s.length !== 12 || !s.split("").every(ALPHABET.includes));

  it("should decode valid bonus codes", () => {
    fc.assert(
      fc.property(bonusCodeArb, code => {
        expect(isRight(BonusCode.decode(code)));
      })
    );
  });

  it("should not decode invalid bonus codes", () => {
    fc.assert(
      fc.property(invalidBonusCodeArb, code => {
        expect(isLeft(BonusCode.decode(code)));
      })
    );
  });
});

describe("genRandomBonusCode", () => {
  const arbRandomBytes = fc.array(fc.integer(0, 255), 12, 12).map(Buffer.from);
  it("should generate valid codes", async () => {
    await fc.assert(
      fc.asyncProperty(arbRandomBytes, async randomBytes => {
        const code = await genRandomBonusCode(() =>
          Promise.resolve(randomBytes)
        );
        expect(BonusCode.decode(code).isRight()).toBeTruthy();
      })
    );
  });
});
