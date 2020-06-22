import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { agent } from "italia-ts-commons";
import {
  AbortableFetch,
  setFetchTimeout,
  toFetch
} from "italia-ts-commons/lib/fetch";
import {
  IntegerFromString,
  NumberFromString
} from "italia-ts-commons/lib/numbers";
import { Hour, Millisecond } from "italia-ts-commons/lib/units";
import { UrlFromString } from "italia-ts-commons/lib/url";
import { createClient } from "../clients/inpsSoapClient";
import { withInpsTracer } from "../services/loggers";
import { getEligibilityCheckActivityHandler } from "./handler";

const inpsServiceEndpoint = getRequiredStringEnv("INPS_SERVICE_ENDPOINT");
const inpsServiceTimeout = IntegerFromString.decode(
  process.env.INPS_REQUEST_TIMEOUT_MS
).getOrElse(10000); // 10 seconds timeout by default

const DEFAULT_DSU_DURATION_H = 24;
const dsuDuration = NumberFromString.decode(
  process.env.INPS_DSU_DURATION
).getOrElse(DEFAULT_DSU_DURATION_H) as Hour;

const soapClientAsync = createClient(
  inpsServiceEndpoint,
  createFetchInstance(inpsServiceEndpoint, inpsServiceTimeout)
);

const eligibilityCheckActivityHandler = getEligibilityCheckActivityHandler(
  soapClientAsync,
  dsuDuration
);

export default eligibilityCheckActivityHandler;

// util that sets up a instance of fetch suitable for inps api requests
function createFetchInstance(endpoint: string, timeout: number): typeof fetch {
  // http when developing locally
  const INPS_SERVICE_PROTOCOL = UrlFromString.decode(endpoint)
    .map(url => url.protocol?.slice(0, -1))
    .getOrElse("https");

  const fetchAgent =
    INPS_SERVICE_PROTOCOL === "http"
      ? agent.getHttpFetch(process.env)
      : agent.getHttpsFetch(process.env, {
          cert: getRequiredStringEnv("INPS_SERVICE_CERT"),
          key: getRequiredStringEnv("INPS_SERVICE_KEY")
        });

  const fetchWithTimeout = setFetchTimeout(
    timeout as Millisecond,
    AbortableFetch(fetchAgent)
  );

  return withInpsTracer(toFetch(fetchWithTimeout));
}
