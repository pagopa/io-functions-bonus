import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import {
  IntegerFromString,
  NumberFromString
} from "italia-ts-commons/lib/numbers";
import { Hour, Millisecond } from "italia-ts-commons/lib/units";
import { createClient } from "../clients/inpsSoapClient";
import { withInpsTracer } from "../services/loggers";
import { getProtocol, withCertificate, withTimeout } from "../utils/fetch";
import { getEligibilityCheckActivityHandler } from "./handler";

const inpsServiceEndpoint = getRequiredStringEnv("INPS_SERVICE_ENDPOINT");
const inpsServiceTimeout = IntegerFromString.decode(
  process.env.INPS_REQUEST_TIMEOUT_MS
).getOrElse(10000) as Millisecond; // 10 seconds timeout by default

const DEFAULT_DSU_DURATION_H = 24;
const dsuDuration = NumberFromString.decode(
  process.env.INPS_DSU_DURATION
).getOrElse(DEFAULT_DSU_DURATION_H) as Hour;

const fetchApi = withInpsTracer(
  withTimeout(inpsServiceTimeout)(
    withCertificate(getProtocol(inpsServiceEndpoint) || "https", () => ({
      cert: getRequiredStringEnv("INPS_SERVICE_CERT"),
      key: getRequiredStringEnv("INPS_SERVICE_KEY")
    }))()
  )
);

const soapClientAsync = createClient(inpsServiceEndpoint, fetchApi);

const eligibilityCheckActivityHandler = getEligibilityCheckActivityHandler(
  soapClientAsync,
  dsuDuration
);

export default eligibilityCheckActivityHandler;
