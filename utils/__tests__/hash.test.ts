import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { FamilyMembers } from "../../generated/models/FamilyMembers";
import { generateFamilyUID, toHash } from "../hash";

const firstFiscalCode = "AAABAB01C02D123Z" as FiscalCode;
const secondFiscalCode = "AAABBB01C02D123Z" as FiscalCode;
const familyMembers: FamilyMembers = [
  {
    fiscalCode: secondFiscalCode,
    name: "AAA" as NonEmptyString,
    surname: "BBB" as NonEmptyString
  },
  {
    fiscalCode: firstFiscalCode,
    name: "AAA" as NonEmptyString,
    surname: "BBB" as NonEmptyString
  }
];

describe("hash#generateFamilyUID", () => {
  it("should hash FamilyMembers", async () => {
    const familyUID = generateFamilyUID(familyMembers);
    const expectedFamilyUID = toHash(`${firstFiscalCode}${secondFiscalCode}`);
    expect(firstFiscalCode < secondFiscalCode).toBeTruthy();
    expect(familyUID).toStrictEqual(expectedFamilyUID);
  });
});
