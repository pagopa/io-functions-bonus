import { fromNullable, Option } from "fp-ts/lib/Option";
import { FiscalCode } from "italia-ts-commons/lib/strings";

/**
 * Check if a fiscalCode is included into the testing set.
 * Comma separated testing fiscal codes can be provided
 * using `TEST_FISCAL_CODES` env variable.
 *
 * @returns `none` in case the fiscal code is a real one, `some` otherwise
 */
export const isTestFiscalCode = (
  fiscalCode: FiscalCode,
  testFiscalCodes = process.env.TEST_FISCAL_CODES
): Option<readonly string[]> =>
  fromNullable(testFiscalCodes)
    .map(_ => _.split(","))
    .filter(_ => _.includes(fiscalCode));
