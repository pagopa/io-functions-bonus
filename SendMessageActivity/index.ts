import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { agent } from "italia-ts-commons";
import {
  AbortableFetch,
  setFetchTimeout,
  toFetch
} from "italia-ts-commons/lib/fetch";
import { IntegerFromString } from "italia-ts-commons/lib/numbers";
import { Millisecond } from "italia-ts-commons/lib/units";

import { getGetProfile, getSendMessage } from "../utils/notifications";
import { getSendMessageActivityHandler } from "./handler";

// HTTP external requests timeout in milliseconds
const SERVICES_REQUEST_TIMEOUT_MS = IntegerFromString.decode(
  process.env.SERVICES_REQUEST_TIMEOUT_MS
).getOrElse(10000);

// Needed to call notifications API
const servicesApiUrl = getRequiredStringEnv("SERVICES_API_URL");
const servicesApiKey = getRequiredStringEnv("SERVICES_API_KEY");

// HTTP-only fetch with optional keepalive agent
// @see https://github.com/pagopa/io-ts-commons/blob/master/src/agent.ts#L10
const httpApiFetch = agent.getHttpFetch(process.env);

// a fetch that can be aborted and that gets cancelled after fetchTimeoutMs
const abortableFetch = AbortableFetch(httpApiFetch);
const timeoutFetch = toFetch(
  setFetchTimeout(SERVICES_REQUEST_TIMEOUT_MS as Millisecond, abortableFetch)
);

const sendMessageActivityHandler = getSendMessageActivityHandler(
  getGetProfile(servicesApiUrl, servicesApiKey, timeoutFetch),
  getSendMessage(servicesApiUrl, servicesApiKey, timeoutFetch)
);

export default sendMessageActivityHandler;
