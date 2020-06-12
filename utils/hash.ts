import * as crypto from "crypto";
import { FamilyMembers } from "../generated/definitions/FamilyMembers";

export const toHash = (s: string): string => {
  const hash = crypto.createHash("sha256");
  hash.update(s);
  return hash.digest("hex");
};

export const generateFamilyUID = (familyMembers: FamilyMembers): string =>
  toHash(
    Array.from(familyMembers)
      .sort((a, b) => (a.fiscal_code > b.fiscal_code ? 1 : -1))
      .map(_ => _.fiscal_code)
      .join("")
  );
