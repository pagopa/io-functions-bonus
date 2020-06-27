import { AzureFunction, Context } from "@azure/functions";
import { TableService } from "azure-storage";
import { array } from "fp-ts/lib/Array";
import {
  fromLeft,
  taskEither,
  TaskEither,
  taskify
} from "fp-ts/lib/TaskEither";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { RetrievedBonusActivation } from "../models/bonus_activation";
import { CosmosDbDocumentCollection } from "../services/cosmosdb";

// "bonusleasebindings"
const BONUS_LEASE_BINDINGS_TABLE_NAME = getRequiredStringEnv(
  "BONUS_LEASE_BINDINGS_TABLE_NAME"
);

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
  const tasks = CosmosDbDocumentCollection.decode(input).fold(
    errs => {
      const error = `${logPrefix}|ERROR=cannot decode input [${readableReport(
        errs
      )}]`;
      context.log.error(error);
      // tslint:disable-next-line: readonly-array
      return [] as Array<TaskEither<Error, TableService.EntityMetadata>>;
    },
    docs =>
      docs.map(_ =>
        RetrievedBonusActivation.decode(_).fold(
          errs => fromLeft(new Error(readableReport(errs))),
          document =>
            // it looks like we must use the table storage SDK:
            // see https://docs.microsoft.com/it-it/azure/azure-functions/functions-bindings-storage-table?tabs=csharp#output
            insertOrReplaceEntity(BONUS_LEASE_BINDINGS_TABLE_NAME, {
              BonusID: document.id,
              PartitionKey: document.familyUID,
              RowKey: document.familyUID,
              Status: document.status
            })
        )
      )
  );
  return array
    .sequence(taskEither)(tasks)
    .run()
    .catch(err => {
      context.log.error(err);
    });
};

export default index;
