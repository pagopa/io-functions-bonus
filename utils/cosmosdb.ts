/**
 * Use a singleton CosmosDB client across functions.
 */
import { DocumentClient as DocumentDBClient } from "documentdb";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";

const cosmosDbUri = getRequiredStringEnv("COSMOSDB_BONUS_URI");
const masterKey = getRequiredStringEnv("COSMOSDB_BONUS_KEY");

export const documentClient = new DocumentDBClient(cosmosDbUri, {
  masterKey
});

// tslint:disable-next-line: no-any
export const toBaseDoc = (doc: any) => {
  const { _rid, _self, _ts, _etag, _lsn, _metadata, ...clean } = doc;
  return clean;
};
