import { TableService } from "azure-storage";
import { constVoid } from "fp-ts/lib/function";
import {
  insertTableEntity,
  ITableEntity
} from "io-functions-commons/dist/src/utils/azure_storage";

import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import * as t from "io-ts";
import { UTCISODateFromString } from "italia-ts-commons/lib/dates";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

const loggerService = new TableService(
  getRequiredStringEnv("BONUS_STORAGE_CONNECTION_STRING")
);

// silently eat any exception
const getTableLogger = <T>(
  tableService: TableService,
  tableName: string,
  toEntity: (payload: T) => ITableEntity
) => (payload: T) =>
  insertTableEntity(tableService, tableName, toEntity(payload))
    .catch(constVoid)
    .then(constVoid);

////////////////////////////////////

const INPS_LOG_TABLE_NAME = "inps-logs";
const InpsLogEntity = t.type({
  Id: NonEmptyString,
  RequestPayload: t.string,
  ResponsePayload: t.string,
  Timestamp: UTCISODateFromString
});
type InpsLogEntity = t.TypeOf<typeof InpsLogEntity>;

export const inpsTableLog = getTableLogger<InpsLogEntity>(
  loggerService,
  INPS_LOG_TABLE_NAME,
  payload => ({
    PartitionKey: payload.Id,
    RequestPayload: JSON.stringify(payload.RequestPayload),
    ResponsePayload: JSON.stringify(payload.ResponsePayload),
    RowKey: payload.Timestamp.toUTCString()
  })
);

////////////////////////////////////

const ADE_LOG_TABLE_NAME = "ade-logs";
const AdeLogEntity = t.type({
  Id: NonEmptyString,
  RequestPayload: t.string,
  ResponsePayload: t.string,
  Timestamp: UTCISODateFromString
});
type AdeLogEntity = t.TypeOf<typeof AdeLogEntity>;

export const adeTableLog = getTableLogger<AdeLogEntity>(
  loggerService,
  ADE_LOG_TABLE_NAME,
  payload => ({
    PartitionKey: payload.Id,
    RequestPayload: JSON.stringify(payload.RequestPayload),
    ResponsePayload: JSON.stringify(payload.ResponsePayload),
    RowKey: payload.Timestamp.toUTCString()
  })
);
