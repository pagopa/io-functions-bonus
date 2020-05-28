import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { createClient } from "../utils/inpsSoapClient";
import { getEligibilityCheckActivityHandler } from "./handler";

const INPS_SERVICE_HOST = getRequiredStringEnv("INPS_SERVICE_HOST");
const INPS_SERVICE_ENDPOINT = getRequiredStringEnv("INPS_SERVICE_ENDPOINT");

const soapClientAsync = createClient(INPS_SERVICE_HOST, INPS_SERVICE_ENDPOINT);

const eligibilityCheckActivityHandler = getEligibilityCheckActivityHandler(
  soapClientAsync
);
export default eligibilityCheckActivityHandler;
