import { fromNullable } from "fp-ts/lib/Option";
import { FiscalCode } from "italia-ts-commons/lib/strings";

/**
 * Check if a fiscalCode is a testing one.
 * Comma separated testing fiscal codes can be provided with `TEST_FISCAL_CODES` env variable.
 * @returns Option<string[]> Returns `some` if is for testing, `none` otherwise
 */
export const isTestFiscalCode = (fiscalCode: FiscalCode, env = process.env) =>
  fromNullable(env.TEST_FISCAL_CODES)
    .map(_ => _.split(","))
    .filter(_ => _.includes(fiscalCode));
