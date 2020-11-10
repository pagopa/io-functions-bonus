/**
 * Use a singleton CosmosDB client across functions.
 */
import * as t from "io-ts";

import { CosmosClient } from "@azure/cosmos";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";

const endpoint = getRequiredStringEnv("COSMOSDB_BONUS_URI");
const key = getRequiredStringEnv("COSMOSDB_BONUS_KEY");
export const cosmosClient = new CosmosClient({
  consistencyLevel: "Strong",
  endpoint,
  key
});

export const CosmosDbDocument = t.readonly(t.UnknownRecord);
export type CosmosDbDocument = t.TypeOf<typeof CosmosDbDocument>;

export const CosmosDbDocumentCollection = t.readonlyArray(CosmosDbDocument);
export type CosmosDbDocumentCollection = t.TypeOf<
  typeof CosmosDbDocumentCollection
>;

export const toBaseDoc = (doc: CosmosDbDocument) => {
  const { _rid, _self, _ts, _etag, _lsn, _metadata, ...clean } = doc;
  return clean;
};
