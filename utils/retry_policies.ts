import { RetryOptions } from "durable-functions";

export const internalRetryOptions: RetryOptions = {
  backoffCoefficient: 1.5,
  firstRetryIntervalInMilliseconds: 500,
  maxNumberOfAttempts: 10,
  maxRetryIntervalInMilliseconds: 3600 * 100,
  retryTimeoutInMilliseconds: 3600 * 1000
};

export const externalRetryOptions: RetryOptions = {
  backoffCoefficient: 1.5,
  firstRetryIntervalInMilliseconds: 500,
  maxNumberOfAttempts: 20,
  maxRetryIntervalInMilliseconds: 3600 * 100,
  retryTimeoutInMilliseconds: 3600 * 1000
};
