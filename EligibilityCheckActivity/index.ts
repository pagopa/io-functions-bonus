import { TableService } from "azure-storage";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { NumberFromString } from "italia-ts-commons/lib/numbers";
import { Hour } from "italia-ts-commons/lib/units";
import { getTableLogger } from "../services/logger";
import { createClient } from "../utils/inpsSoapClient";
import {
  getEligibilityCheckActivityHandler,
  IINPSLoggerEntity
} from "./handler";

const INPS_SERVICE_ENDPOINT = getRequiredStringEnv("INPS_SERVICE_ENDPOINT");

const DEFAULT_DSU_DURATION_H = 24;

const dsuDuration = NumberFromString.decode(
  process.env.INPS_DSU_DURATION
).getOrElse(DEFAULT_DSU_DURATION_H) as Hour;

const soapClientAsync = createClient(INPS_SERVICE_ENDPOINT);

const ELIGIBILITY_CHECK_LOG_TABLE_NAME = "eligibility-check-logs";

const loggerService = new TableService(
  getRequiredStringEnv("BONUS_STORAGE_CONNECTION_STRING")
);

const logToTable = getTableLogger<IINPSLoggerEntity>(
  loggerService,
  ELIGIBILITY_CHECK_LOG_TABLE_NAME,
  payload => ({
    PartitionKey: payload.Id,
    RequestPayload: JSON.stringify(payload.RequestPayload),
    ResponsePayload: JSON.stringify(payload.ResponsePayload),
    RowKey: payload.Timestamp.toUTCString()
  })
);

const eligibilityCheckActivityHandler = getEligibilityCheckActivityHandler(
  soapClientAsync,
  dsuDuration,
  logToTable
);
export default eligibilityCheckActivityHandler;
