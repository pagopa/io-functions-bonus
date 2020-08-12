import { TableService } from "azure-storage";
import {
  insertTableEntity,
  ITableEntity
} from "io-functions-commons/dist/src/utils/azure_storage";

import { constVoid } from "fp-ts/lib/function";
import { none, Option, some } from "fp-ts/lib/Option";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import * as t from "io-ts";
import { UTCISODateFromString } from "italia-ts-commons/lib/dates";

const loggerService = new TableService(
  getRequiredStringEnv("BONUS_STORAGE_CONNECTION_STRING")
);

///////////

const fiscalCodeRegex = /[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]/;

export const extractFiscalCode = (payload: string): Option<string> => {
  const matches = payload.match(fiscalCodeRegex);
  return matches ? some(matches[0]) : none;
};

// silently eat any exception
const getTableLogger = <T>(
  tableService: TableService,
  tableName: string,
  toEntity: (payload: T) => ITableEntity
) => (payload: T) =>
  insertTableEntity(tableService, tableName, toEntity(payload)).catch(
    constVoid
  );

/**
 * Bind to a specific tracing function to create a wrapper for a fetch function that allow tracing of request and response.
 * It returns a factory method that gets the original fetch function
 *
 * @param traceFn the tracing function
 *
 * @returns a factory method that gets the original fetch function and return an invariant version of fetch
 */
export const logHttpFetch = (
  traceFn: (
    input: RequestInfo,
    init: RequestInit | undefined,
    res: Response
  ) => Promise<void>
) => (f: typeof fetch): typeof fetch => {
  return async (input, init) => {
    const res = f(input, init);
    res
      .then(_ => _.clone())
      .then(clonedRes => traceFn(input, init, clonedRes))
      .catch(constVoid);
    return res;
  };
};

const IBasicHttpTrace = t.type({
  RequestPayload: t.string,
  ResponsePayload: t.string,
  ResponseStatus: t.Integer,
  ResponseStatusText: t.string,
  Timestamp: UTCISODateFromString
});
type IBasicHttpTrace = t.TypeOf<typeof IBasicHttpTrace>;

export const createBasicHttpRequestTracer = <T extends IBasicHttpTrace>(
  tableName: string
) =>
  getTableLogger<T>(loggerService, tableName, payload => ({
    PartitionKey: extractFiscalCode(payload.RequestPayload).getOrElse(
      payload.Timestamp.getTime().toString()
    ),
    RequestPayload: payload.RequestPayload,
    ResponsePayload: payload.ResponsePayload,
    ResponseStatus: payload.ResponseStatus,
    ResponseStatusText: payload.ResponseStatusText,
    RowKey: payload.Timestamp.getTime().toString()
  }));

////////////////////////////////////

const INPS_LOG_TABLE_NAME = "inpslogs";
export const InpsLogEntity = IBasicHttpTrace;
export type InpsLogEntity = t.TypeOf<typeof InpsLogEntity>;

export const traceInpsRequest = createBasicHttpRequestTracer<InpsLogEntity>(
  INPS_LOG_TABLE_NAME
);

/**
 * Creates a fetch-like function which wraps the provided fetch implementation to add INPS-specific tracing
 *
 * @param fetch a fetch implementation to wrap
 *
 * @returns a fetch-like function
 */
export const withInpsTracer = logHttpFetch(async (_, init, res) => {
  const ResponsePayload = await res.text();
  await traceInpsRequest({
    RequestPayload: JSON.stringify(init?.body || ""),
    ResponsePayload: JSON.stringify(ResponsePayload),
    ResponseStatus: res.status,
    ResponseStatusText: res.statusText,
    Timestamp: new Date()
  });
});

////////////////////////////////////

const ADE_LOG_TABLE_NAME = "adelogs";
export const AdeLogEntity = IBasicHttpTrace;
export type AdeLogEntity = t.TypeOf<typeof AdeLogEntity>;

export const traceAdeRequest = createBasicHttpRequestTracer<AdeLogEntity>(
  ADE_LOG_TABLE_NAME
);

/**
 * Creates a fetch-like function which wraps the provided fetch implementation to add ADE-specific tracing
 *
 * @param fetch a fetch implementation to wrap
 *
 * @returns a fetch-like function
 */
export const withAdeTracer = logHttpFetch(async (_, init, res) => {
  const ResponsePayload = await res.text();
  await traceAdeRequest({
    RequestPayload: JSON.stringify(init?.body || ""),
    ResponsePayload: JSON.stringify(ResponsePayload),
    ResponseStatus: res.status,
    ResponseStatusText: res.statusText,
    Timestamp: new Date()
  });
});
