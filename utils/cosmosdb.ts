/**
 * Use a singleton CosmosDB client across functions.
 */
import * as t from "io-ts";

import { DocumentClient as DocumentDBClient } from "documentdb";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";

const cosmosDbUri = getRequiredStringEnv("COSMOSDB_BONUS_URI");
const masterKey = getRequiredStringEnv("COSMOSDB_BONUS_KEY");

export const documentClient = new DocumentDBClient(cosmosDbUri, {
  masterKey
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
