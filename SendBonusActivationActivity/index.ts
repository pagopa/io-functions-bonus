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
import { ADEClient } from "../utils/adeClient";
import SendBonusActivationHandler from "./handler";

// 10 seconds timeout by default
// 10 seconds timeout by default
const ADE_REQUEST_TIMEOUT_MS = IntegerFromString.decode(
  process.env.ADE_REQUEST_TIMEOUT_MS
).getOrElse(10000);

const adeServiceEndpoint = getRequiredStringEnv("ADE_SERVICE_ENDPOINT");

// http when developing locally
const ADE_SERVICE_PROTOCOL = UrlFromString.decode(adeServiceEndpoint)
  .map(url => url.protocol?.slice(0, -1))
  .getOrElse("https");

const fetchAgent =
  ADE_SERVICE_PROTOCOL === "http"
    ? agent.getHttpFetch(process.env)
    : agent.getHttpsFetch(process.env, {
        cert: process.env.ADE_SERVICE_CERT,
        key: process.env.ADE_SERVICE_KEY
      });

const fetchWithTimeout = setFetchTimeout(
  ADE_REQUEST_TIMEOUT_MS as Millisecond,
  AbortableFetch(fetchAgent)
);

const httpFetch = toFetch(fetchWithTimeout);

const adeClient = ADEClient(adeServiceEndpoint, httpFetch);

const SendBonusActivationActivity = SendBonusActivationHandler(adeClient);

export default SendBonusActivationActivity;
