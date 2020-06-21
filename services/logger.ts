import { TableService } from "azure-storage";
import { constVoid } from "fp-ts/lib/function";
import {
  insertTableEntity,
  ITableEntity
} from "io-functions-commons/dist/src/utils/azure_storage";

// Example code:
//
// const loggerService = new TableService(
//   getRequiredStringEnv("BONUS_STORAGE_CONNECTION_STRING")
// );
//
// const log = getLogger<{ id: string; timestamp: string }>(
//   loggerService,
//   "tablename",
//   payload => ({
//     PartitionKey: payload.id,
//     RowKey: payload.timestamp,
//     payload: JSON.stringify(payload)
//   })
// );
//
// log({
//   id: "123",
//   timestamp: "1234"
// }).catch(console.error);

// silently eat any exception
export const getTableLogger = <T>(
  tableService: TableService,
  tableName: string,
  toEntity: (payload: T) => ITableEntity
) => async (payload: T) =>
  insertTableEntity(tableService, tableName, toEntity(payload))
    .catch(constVoid)
    .then(constVoid);

export type TableLogger<T> = (payload: T) => Promise<void>;
