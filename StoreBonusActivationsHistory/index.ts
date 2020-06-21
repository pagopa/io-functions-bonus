import { AzureFunction, Context } from "@azure/functions";

import { readableReport } from "italia-ts-commons/lib/reporters";

import { CosmosDbDocumentCollection, toBaseDoc } from "../services/cosmosdb";

const index: AzureFunction = async (_: Context, input: unknown) => {
  const decoded = CosmosDbDocumentCollection.decode(input);
  if (decoded.isLeft()) {
    throw Error(
      `StoreBonusActivationsHistory: cannot decode input [${readableReport(
        decoded.value
      )}]`
    );
  }

  const documents = decoded.value;

  return {
    bonusActivationsLogs: documents.map(d => ({
      PartitionKey: `${d.id}`,
      Payload: JSON.stringify(toBaseDoc(d)),
      RowKey: d._ts
    }))
  };
};

export default index;
