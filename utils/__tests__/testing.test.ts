import { isNone, isSome } from "fp-ts/lib/Option";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { isTestFiscalCode } from "../testing";

const fiscalCode = "AAABBB01C02D123Z" as FiscalCode;
const testFiscalCodes = "CCCBBB10C04D123Z,EEEDDD11C04D222A";

describe("isTestFiscalCode", () => {
  it("should return none if the provided fiscal code is missing", () => {
    const result = isTestFiscalCode(fiscalCode, testFiscalCodes);
    expect(isNone(result)).toBeTruthy();
  });
  it("should return some if the provided fiscal code is present", () => {
    const result = isTestFiscalCode(
      fiscalCode,
      testFiscalCodes.concat(`,${fiscalCode}`)
    );
    expect(isSome(result)).toBeTruthy();
  });
});
