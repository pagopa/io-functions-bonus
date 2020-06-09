import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { agent } from "italia-ts-commons";
import {
  AbortableFetch,
  setFetchTimeout,
  toFetch
} from "italia-ts-commons/lib/fetch";
import { Millisecond } from "italia-ts-commons/lib/units";
import { ADEClient } from "../utils/adeClient";
import SendBonusActivationHandler from "./handler";

const httpApiFetch = agent.getHttpFetch(process.env);

const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

const abortableFetch = AbortableFetch(httpApiFetch);
const timeoutFetch = toFetch(
  setFetchTimeout(DEFAULT_REQUEST_TIMEOUT_MS as Millisecond, abortableFetch)
);

const adeServiceEndpoint = getRequiredStringEnv("ADE_SERVICE_ENDPOINT");

const adeClient = ADEClient(adeServiceEndpoint, timeoutFetch);

const SendBonusActivationActivity = SendBonusActivationHandler(adeClient);

export default SendBonusActivationActivity;
