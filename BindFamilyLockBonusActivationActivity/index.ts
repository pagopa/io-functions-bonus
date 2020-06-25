import { AzureFunction, Context } from "@azure/functions";
import { isRight } from "fp-ts/lib/Either";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { RetrievedBonusActivation } from "../models/bonus_activation";
import { CosmosDbDocumentCollection } from "../services/cosmosdb";

const index: AzureFunction = async (_: Context, input: unknown) => {
  const decoded = CosmosDbDocumentCollection.decode(input);
  if (decoded.isLeft()) {
    throw Error(
      `BindFamilyLockBonusActivationActivity: cannot decode input [${readableReport(
        decoded.value
      )}]`
    );
  }
  const documents = decoded.value
    .map(RetrievedBonusActivation.decode)
    .filter(isRight)
    .map(rightDocument => rightDocument.value);
  return {
    bonusLeaseBindings: documents.map(document => ({
      BonusID: document.id,
      PartitionKey: document.familyUID,
      RowKey: document.familyUID,
      Status: document.status
    }))
  };
};

export default index;
