import { Container, ItemResponse } from "@azure/cosmos";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import {
  BaseModel,
  CosmosdbModel,
  CosmosErrors,
  CosmosResource,
  toCosmosErrorResponse
} from "io-functions-commons/dist/src/utils/cosmosdb_model";
import { wrapWithKind } from "io-functions-commons/dist/src/utils/types";
import * as t from "io-ts";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { BonusCode } from "../generated/models/BonusCode";

export const BONUS_PROCESSING_COLLECTION_NAME = "bonus-processing";

// Applicant fiscal code
export const BONUS_PROCESSING_MODEL_PK_FIELD = "id";

export const BonusProcessing = t.interface({
  bonusId: BonusCode,
  id: FiscalCode
});
export type BonusProcessing = t.TypeOf<typeof BonusProcessing>;

export const RetrievedBonusProcessing = wrapWithKind(
  t.intersection([BonusProcessing, CosmosResource]),
  "IRetrievedBonusProcessing" as const
);
export type RetrievedBonusProcessing = t.TypeOf<
  typeof RetrievedBonusProcessing
>;

export const NewBonusProcessing = wrapWithKind(
  t.intersection([BonusProcessing, BaseModel]),
  "INewBonusProcessing" as const
);
export type NewBonusProcessing = t.TypeOf<typeof NewBonusProcessing>;

export class BonusProcessingModel extends CosmosdbModel<
  BonusProcessing,
  NewBonusProcessing,
  RetrievedBonusProcessing
> {
  /**
   * Creates a new BonusProcessing model
   *
   * @param container the CosmosDB container
   */
  constructor(container: Container) {
    super(container, NewBonusProcessing, RetrievedBonusProcessing);
  }

  /**
   * Deletes the document by its ID
   * @param documentId
   *
   * @returns either a query error or the id of the deleted document
   */
  public deleteOneById(
    documentId: BonusProcessing["id"]
  ): TaskEither<CosmosErrors, string> {
    return tryCatch<CosmosErrors, ItemResponse<BonusProcessing>>(
      () => this.container.item(documentId).delete(),
      toCosmosErrorResponse
    ).map(_ => documentId);
  }
}
