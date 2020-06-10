/**
 * Use a singleton CosmosDB client across functions.
 */
import { DocumentClient as DocumentDBClient } from "documentdb";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";

const cosmosDbUri = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_URI");
const masterKey = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_KEY");

export const documentClient = new DocumentDBClient(cosmosDbUri, {
  masterKey
});
