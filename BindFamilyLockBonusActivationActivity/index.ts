import { AzureFunction, Context } from "@azure/functions";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { BonusActivation } from "../generated/models/BonusActivation";
import { CosmosDbDocumentCollection, toBaseDoc } from "../services/cosmosdb";
import { generateFamilyUID } from "../utils/hash";

const index: AzureFunction = async (_: Context, input: unknown) => {
  const decoded = CosmosDbDocumentCollection.decode(input);
  if (decoded.isLeft()) {
    throw Error(
      `BindFamilyLockBonusActivationActivity: cannot decode input [${readableReport(
        decoded.value
      )}]`
    );
  }
  const documents = decoded.value.reduce(
    (prev, rawDocument) => {
      const errorOrBonusActivation = BonusActivation.decode(rawDocument);
      // Skip invalid documents
      if (errorOrBonusActivation.isLeft()) {
        return prev;
      }
      const bonusActivation = errorOrBonusActivation.value;
      return [
        ...prev,
        {
          familyUID: generateFamilyUID(
            bonusActivation.dsuRequest.familyMembers
          ),
          originalDocument: bonusActivation
        }
      ];
    },
    [] as ReadonlyArray<{
      familyUID: NonEmptyString;
      originalDocument: BonusActivation;
    }>
  );
  return {
    bonusLeaseBindings: documents.map(d => ({
      BonusID: d.originalDocument.id,
      PartitionKey: d.familyUID,
      RowKey: d.familyUID,
      Status: d.originalDocument.status
    }))
  };
};

export default index;
