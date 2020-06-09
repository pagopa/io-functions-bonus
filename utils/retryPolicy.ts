import { RetryOptions } from "durable-functions";
export const retryOptions: RetryOptions = {
  backoffCoefficient: 1.5,
  firstRetryIntervalInMilliseconds: 1000,
  maxNumberOfAttempts: 10,
  maxRetryIntervalInMilliseconds: 3600 * 100,
  retryTimeoutInMilliseconds: 3600 * 1000
};
