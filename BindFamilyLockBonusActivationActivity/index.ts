import { AzureFunction, Context } from "@azure/functions";

import { readableReport } from "italia-ts-commons/lib/reporters";

import { array } from "fp-ts/lib/Array";
import { isRight } from "fp-ts/lib/Either";
import { taskEither, tryCatch } from "fp-ts/lib/TaskEither";
import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { BonusActivation } from "../generated/models/BonusActivation";
import { BonusActivationStatusEnum } from "../generated/models/BonusActivationStatus";
import {
  BONUS_LEASE_COLLECTION_NAME,
  BonusLeaseModel
} from "../models/bonus_lease";
import { CosmosDbDocumentCollection } from "../services/cosmosdb";
import { documentClient } from "../services/cosmosdb";
import { generateFamilyUID } from "../utils/hash";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);

const bonusLeaseModel = new BonusLeaseModel(
  documentClient,
  documentDbUtils.getCollectionUri(
    documentDbDatabaseUrl,
    BONUS_LEASE_COLLECTION_NAME
  )
);

const index: AzureFunction = async (context: Context, input: unknown) => {
  const decoded = CosmosDbDocumentCollection.decode(input);
  if (decoded.isLeft()) {
    throw Error(
      `BindFamilyLockBonusActivationActivity: cannot decode input [${readableReport(
        decoded.value
      )}]`
    );
  }
  await array
    .sequence(taskEither)(
      decoded.value
        .map(BonusActivation.decode)
        .filter(isRight)
        .map(_ => _.value)
        .filter(_ => _.status === BonusActivationStatusEnum.PROCESSING)
        .map(_ => ({
          bonusID: _.id,
          id: generateFamilyUID(_.dsuRequest.familyMembers)
        }))
        .map(_ =>
          tryCatch(
            () => bonusLeaseModel.replaceDocument(_, _.id),
            () => new Error("Error updating BonusLease")
          )
        )
    )
    .run();
};

export default index;
