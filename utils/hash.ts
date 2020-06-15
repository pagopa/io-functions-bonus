import * as crypto from "crypto";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { FamilyMembers } from "../generated/models/FamilyMembers";
import { FamilyUID } from "../generated/models/FamilyUID";

export const toHash = (s: string): NonEmptyString => {
  const hash = crypto.createHash("sha256");
  hash.update(s);
  return hash.digest("hex") as NonEmptyString;
};

export const generateFamilyUID = (familyMembers: FamilyMembers): FamilyUID =>
  FamilyUID.decode(
    toHash(
      Array.from(familyMembers)
        .map(_ => _.fiscalCode)
        .sort((a, b) => a.localeCompare(b))
        .join("")
    )
  ).getOrElseL(err => {
    throw new Error(
      `Cannot generate FamilyUID for family ${JSON.stringify(
        familyMembers
      )}: ${readableReport(err)}`
    );
  });
