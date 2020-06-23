import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { IntegerFromString } from "italia-ts-commons/lib/numbers";
import { Millisecond } from "italia-ts-commons/lib/units";
import { ADEClient } from "../clients/adeClient";
import { withAdeTracer } from "../services/loggers";
import { getProtocol, withCertificate, withTimeout } from "../utils/fetch";
import SendBonusActivationHandler from "./handler";

const adeServiceEndpoint = getRequiredStringEnv("ADE_SERVICE_ENDPOINT");
const adeServiceTimeout = IntegerFromString.decode(
  process.env.ADE_REQUEST_TIMEOUT_MS
).getOrElse(10000) as Millisecond; // 10 seconds timeout by default

const fetchApi = withAdeTracer(
  withTimeout(adeServiceTimeout)(
    withCertificate(getProtocol(adeServiceEndpoint) || "https", () => ({
      cert: getRequiredStringEnv("ADE_SERVICE_CERT"),
      key: getRequiredStringEnv("ADE_SERVICE_KEY")
    }))()
  )
);

const adeClient = ADEClient(adeServiceEndpoint, fetchApi);

const SendBonusActivationActivity = SendBonusActivationHandler(adeClient);

export default SendBonusActivationActivity;
