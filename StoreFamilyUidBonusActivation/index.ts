import { AzureFunction, Context } from "@azure/functions";
import { TableService } from "azure-storage";
import { rights } from "fp-ts/lib/Array";
import { isLeft } from "fp-ts/lib/Either";
import { toString } from "fp-ts/lib/function";
import { taskify } from "fp-ts/lib/TaskEither";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { RetrievedBonusActivation } from "../models/bonus_activation";
import { CosmosDbDocumentCollection } from "../services/cosmosdb";

const BONUS_LEASE_TO_BONUS_ACTIVATIONS_TABLE_NAME = "bonusleasebindings";

const tableService = new TableService(
  getRequiredStringEnv("BONUS_STORAGE_CONNECTION_STRING")
);

const insertOrReplaceEntity = taskify(
  tableService.insertOrReplaceEntity.bind(tableService)
);

/**
 * Store into a table the tuple FamilyUID -> (BonusId, Bonus Status)
 * for each upsert into the bonus-activations CosmosDB collection.
 *
 * This is a CosmosDB index used to get the
 * "Processing Bonus Activation" relative to a familyUID
 */
const index: AzureFunction = async (context: Context, input: unknown) => {
  const logPrefix = `StoreFamilyLockBonusActivation`;
  const decoded = CosmosDbDocumentCollection.decode(input);
  if (isLeft(decoded)) {
    context.log.error(
      `${logPrefix}|ERROR=cannot decode input [${readableReport(
        decoded.value
      )}]`
    );
    return;
  }

  const documents = rights(decoded.value.map(RetrievedBonusActivation.decode));

  // it looks like we must use the table storage SDK:
  // see https://docs.microsoft.com/it-it/azure/azure-functions/functions-bindings-storage-table?tabs=csharp#output

  documents.forEach(document => {
    insertOrReplaceEntity(BONUS_LEASE_TO_BONUS_ACTIVATIONS_TABLE_NAME, {
      BonusID: document.id,
      PartitionKey: document.familyUID,
      RowKey: document.familyUID,
      Status: document.status
    })
      .run()
      .catch(err => {
        context.log.error(`${logPrefix}|ERROR=${toString(err)}`);
      });
  });
};

export default index;
