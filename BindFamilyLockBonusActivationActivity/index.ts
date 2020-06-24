import { AzureFunction, Context } from "@azure/functions";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { BonusActivation } from "../generated/models/BonusActivation";
import { BonusActivationStatusEnum } from "../generated/models/BonusActivationStatus";
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
      // Skip invalid documents and BonusActivation with state not PROCESSING
      if (
        errorOrBonusActivation.isLeft() ||
        errorOrBonusActivation.value.status !==
          BonusActivationStatusEnum.PROCESSING
      ) {
        return prev;
      }
      const bonusActivation = errorOrBonusActivation.value;
      return [
        ...prev,
        {
          familyUID: generateFamilyUID(
            bonusActivation.dsuRequest.familyMembers
          ),
          originalDocument: toBaseDoc(rawDocument),
          rawDocument
        }
      ];
    },
    [] as ReadonlyArray<{
      familyUID: NonEmptyString;
      originalDocument: { readonly [x: string]: unknown };
      rawDocument: { readonly [x: string]: unknown };
    }>
  );
  return {
    bonusLeaseBindings: documents.map(d => ({
      BonusID: d.originalDocument.id,
      PartitionKey: `${d.familyUID}`,
      Payload: JSON.stringify(d.originalDocument),
      RowKey: d.rawDocument._ts
    }))
  };
};

export default index;
