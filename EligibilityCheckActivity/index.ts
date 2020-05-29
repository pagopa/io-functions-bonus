import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { createClient } from "../utils/inpsSoapClient";
import { getEligibilityCheckActivityHandler } from "./handler";

const INPS_SERVICE_HOST = getRequiredStringEnv("INPS_SERVICE_HOST");
const INPS_SERVICE_ENDPOINT = getRequiredStringEnv("INPS_SERVICE_ENDPOINT");
const INPS_SERVICE_PROTOCOL = getRequiredStringEnv("INPS_SERVICE_PROTOCOL");
const INPS_SERVICE_PORT = getRequiredStringEnv("INPS_SERVICE_PORT");

const soapClientAsync = createClient(
  `${INPS_SERVICE_PROTOCOL}://${INPS_SERVICE_HOST}:${INPS_SERVICE_PORT}${INPS_SERVICE_ENDPOINT}` as NonEmptyString
);

const eligibilityCheckActivityHandler = getEligibilityCheckActivityHandler(
  soapClientAsync
);
export default eligibilityCheckActivityHandler;
