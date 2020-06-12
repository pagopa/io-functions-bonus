import * as crypto from "crypto";
import { FamilyMembers } from "../generated/models/FamilyMembers";

export const toHash = (s: string): string => {
  const hash = crypto.createHash("sha256");
  hash.update(s);
  return hash.digest("hex");
};

export const generateFamilyUID = (familyMembers: FamilyMembers): string =>
  toHash(
    Array.from(familyMembers)
      .map(_ => _.fiscalCode)
      .sort((a, b) => a.localeCompare(b))
      .join("")
  );
