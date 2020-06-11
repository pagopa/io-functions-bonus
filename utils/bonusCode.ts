import { randomBytes } from "crypto";
import { promisify } from "util";

import { isLeft } from "fp-ts/lib/Either";

import { BonusCode } from "../generated/definitions/BonusCode";

// Note that we redeclare the alphabet and the length of the bonus here as a
// double assurance that the implementation is correct and things will break
// in case the definition gets changed in one place only.

// Bonus codes are made of characters picked from the following alphabet
export const ALPHABET = "ACEFGHLMNPRUV3469";
const ALPHABET_LEN = ALPHABET.length;

// Bonus codes have a length of 12 characthers
export const BONUSCODE_LENGTH = 12;

const asyncRandomBytes = promisify(randomBytes);

/**
 * Generates a new random bonus code
 */
export async function genRandomBonusCode(
  getAsyncRandomBytes: typeof asyncRandomBytes = asyncRandomBytes
): Promise<BonusCode> {
  const randomBuffer = await getAsyncRandomBytes(BONUSCODE_LENGTH);
  const code = [...randomBuffer].map(b => ALPHABET[b % ALPHABET_LEN]).join("");
  const bonusCode = BonusCode.decode(code);
  if (isLeft(bonusCode)) {
    // this should never happen
    throw Error(
      `FATAL: genRandomBonusCode generated invalid bonus code [${code}]`
    );
  }
  return bonusCode.value;
}
