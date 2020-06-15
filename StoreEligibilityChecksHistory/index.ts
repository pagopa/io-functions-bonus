import { AzureFunction, Context } from "@azure/functions";

import { readableReport } from "italia-ts-commons/lib/reporters";

import { CosmosDbDocumentCollection, toBaseDoc } from "../utils/cosmosdb";

const index: AzureFunction = async (_: Context, input: unknown) => {
  const decoded = CosmosDbDocumentCollection.decode(input);
  if (decoded.isLeft()) {
    throw Error(
      `StoreEligibilityChecksHistory: cannot decode input [${readableReport(
        decoded.value
      )}]`
    );
  }

  const documents = decoded.value;

  return {
    eligibilityChecksLogs: documents.map(d => ({
      PartitionKey: `${d.id}`,
      Payload: JSON.stringify(toBaseDoc(d)),
      RowKey: d._ts
    }))
  };
};

export default index;
