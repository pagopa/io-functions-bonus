import { constUndefined } from "fp-ts/lib/function";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { agent } from "italia-ts-commons";
import {
  IntegerFromString,
  NumberFromString
} from "italia-ts-commons/lib/numbers";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { Hour, Millisecond } from "italia-ts-commons/lib/units";
import { createClient, ISoapClientAsync } from "../clients/inpsSoapClient";
import { withInpsTracer } from "../services/loggers";
import { getProtocol, withCertificate, withTimeout } from "../utils/fetch";
import { isTestFiscalCode } from "../utils/testing";
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

const prodSoapClientAsync = createClient(inpsServiceEndpoint, fetchApi);
const testSoapClientAsync = NonEmptyString.decode(
  process.env.TEST_INPS_SERVICE_ENDPOINT
).fold(constUndefined, testInpsServiceEndpoint =>
  createClient(testInpsServiceEndpoint, fetchApi)
);

// If the user fiscal code is included in the testing set
// and the test SOAP client is defined,
// use the latter instead of the production one
const soapClientAsync: ISoapClientAsync = {
  ConsultazioneSogliaIndicatore: ({ CodiceFiscale, ...others }) =>
    isTestFiscalCode(CodiceFiscale)
      .mapNullable(_ => testSoapClientAsync)
      .getOrElse(prodSoapClientAsync)
      .ConsultazioneSogliaIndicatore({ CodiceFiscale, ...others })
};

const eligibilityCheckActivityHandler = getEligibilityCheckActivityHandler(
  soapClientAsync,
  dsuDuration
);

export default eligibilityCheckActivityHandler;
