import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { NumberFromString } from "italia-ts-commons/lib/numbers";
import { Hour } from "italia-ts-commons/lib/units";
import { createClient } from "../clients/inpsSoapClient";
import { getEligibilityCheckActivityHandler } from "./handler";

const INPS_SERVICE_ENDPOINT = getRequiredStringEnv("INPS_SERVICE_ENDPOINT");

const DEFAULT_DSU_DURATION_H = 24;

const dsuDuration = NumberFromString.decode(
  process.env.INPS_DSU_DURATION
).getOrElse(DEFAULT_DSU_DURATION_H) as Hour;

const soapClientAsync = createClient(INPS_SERVICE_ENDPOINT);

const eligibilityCheckActivityHandler = getEligibilityCheckActivityHandler(
  soapClientAsync,
  dsuDuration
);
export default eligibilityCheckActivityHandler;
