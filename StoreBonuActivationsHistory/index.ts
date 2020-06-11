import { AzureFunction, Context } from "@azure/functions";

const index: AzureFunction = async (
  _: Context,
  // tslint:disable-next-line: no-any
  documents: readonly any[]
) => {
  return {
    bonusActivationsLogs: documents.map(d => ({
      PartitionKey: `${d.id}`,
      Payload: JSON.stringify(d),
      RowKey: d._ts
    }))
  };
};

export default index;
