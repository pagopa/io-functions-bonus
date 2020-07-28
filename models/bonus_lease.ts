import { Container, ItemResponse } from "@azure/cosmos";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import {
  BaseModel,
  CosmosdbModel,
  CosmosErrors,
  toCosmosErrorResponse
} from "io-functions-commons/dist/src/utils/cosmosdb_model";
import { wrapWithKind } from "io-functions-commons/dist/src/utils/types";
import * as t from "io-ts";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

export const BONUS_LEASE_COLLECTION_NAME = "bonus-leases";

// Computed unique ID from family members fiscal codes
export const BONUS_LEASE_MODEL_PK_FIELD = "id";

export const BonusLease = t.interface({
  id: NonEmptyString
});
export type BonusLease = t.TypeOf<typeof BonusLease>;

export const RetrievedBonusLease = wrapWithKind(
  t.intersection([BonusLease, BaseModel]),
  "IRetrievedBonusLease" as const
);
export type RetrievedBonusLease = t.TypeOf<typeof RetrievedBonusLease>;

export const NewBonusLease = wrapWithKind(
  t.intersection([BonusLease, BaseModel]),
  "INewBonusLease" as const
);
export type NewBonusLease = t.TypeOf<typeof NewBonusLease>;

export class BonusLeaseModel extends CosmosdbModel<
  BonusLease,
  NewBonusLease,
  RetrievedBonusLease
> {
  /**
   * Creates a new BonusLease model
   *
   * @param container the CosmosDB container
   */
  constructor(container: Container) {
    super(container, NewBonusLease, RetrievedBonusLease);
  }

  /**
   * Deletes the document by its ID
   * @param documentId
   *
   * @returns either a query error or the id of the deleted document
   */
  public deleteOneById(
    documentId: BonusLease["id"]
  ): TaskEither<CosmosErrors, string> {
    return tryCatch<CosmosErrors, ItemResponse<BonusLease>>(
      () => this.container.item(documentId).delete(),
      toCosmosErrorResponse
    ).map(_ => documentId);
  }
}
