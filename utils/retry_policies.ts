import { RetryOptions } from "durable-functions";
import { IntegerFromString } from "italia-ts-commons/lib/numbers";

const RETRY_OPTIONS_FIRST_RETRY_INTERVAL_MS = 500;

const INTERNAL_RETRY_OPTIONS_MAX_ATTEMPTS = IntegerFromString.decode(
  process.env.INTERNAL_RETRY_OPTIONS_MAX_ATTEMPTS
).getOrElse(10);
export const internalRetryOptions: RetryOptions = new RetryOptions(
  RETRY_OPTIONS_FIRST_RETRY_INTERVAL_MS,
  INTERNAL_RETRY_OPTIONS_MAX_ATTEMPTS
);
// tslint:disable-next-line: no-object-mutation
internalRetryOptions.backoffCoefficient = 1.5;

const EXTERNAL_RETRY_OPTIONS_MAX_ATTEMPTS = IntegerFromString.decode(
  process.env.EXTERNAL_RETRY_OPTIONS_MAX_ATTEMPTS
).getOrElse(20);
export const externalRetryOptions: RetryOptions = new RetryOptions(
  RETRY_OPTIONS_FIRST_RETRY_INTERVAL_MS,
  EXTERNAL_RETRY_OPTIONS_MAX_ATTEMPTS
);
// tslint:disable-next-line: no-object-mutation
internalRetryOptions.backoffCoefficient = 1.5;
