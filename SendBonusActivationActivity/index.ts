import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { agent } from "italia-ts-commons";
import {
  AbortableFetch,
  setFetchTimeout,
  toFetch
} from "italia-ts-commons/lib/fetch";
import { IntegerFromString } from "italia-ts-commons/lib/numbers";
import { Millisecond } from "italia-ts-commons/lib/units";
import { UrlFromString } from "italia-ts-commons/lib/url";
import { ADEClient } from "../clients/adeClient";
import { withAdeTracer } from "../services/loggers";
import SendBonusActivationHandler from "./handler";

const adeServiceEndpoint = getRequiredStringEnv("ADE_SERVICE_ENDPOINT");
const adeServiceTimeout = IntegerFromString.decode(
  process.env.ADE_REQUEST_TIMEOUT_MS
).getOrElse(10000); // 10 seconds timeout by default

const adeClient = ADEClient(
  adeServiceEndpoint,
  createFetchInstance(adeServiceEndpoint, adeServiceTimeout)
);

const SendBonusActivationActivity = SendBonusActivationHandler(adeClient);

export default SendBonusActivationActivity;

// util that sets up a instance of fetch suitable for ade api requests
function createFetchInstance(endpoint: string, timeout: number): typeof fetch {
  // http when developing locally
  const ADE_SERVICE_PROTOCOL = UrlFromString.decode(endpoint)
    .map(url => url.protocol?.slice(0, -1))
    .getOrElse("https");

  const fetchAgent =
    ADE_SERVICE_PROTOCOL === "http"
      ? agent.getHttpFetch(process.env)
      : agent.getHttpsFetch(process.env, {
          cert: getRequiredStringEnv("ADE_SERVICE_CERT"),
          key: getRequiredStringEnv("ADE_SERVICE_KEY")
        });

  const fetchWithTimeout = setFetchTimeout(
    timeout as Millisecond,
    AbortableFetch(fetchAgent)
  );

  return withAdeTracer(toFetch(fetchWithTimeout));
}
