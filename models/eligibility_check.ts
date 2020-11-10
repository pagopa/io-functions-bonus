/**
 * An EligibilityCheck is a request from the User to validate his/her DSU (dichiarazione sostitutiva unica). It might be referred also as DSU Request.
 * An EligibilityCheck is identified by the User's unique identifier (thus at most one EligibilityCheck can exist for a User at a given time).
 * It can be a case of Success of Failure: in the first case it will also include a list of the family members of the associated DSU
 */

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
import { EligibilityCheck } from "../generated/models/EligibilityCheck";

export const ELIGIBILITY_CHECK_COLLECTION_NAME = "eligibility-checks";
export const ELIGIBILITY_CHECK_MODEL_PK_FIELD = "id" as const;

export const RetrievedEligibilityCheck = wrapWithKind(
  t.intersection([EligibilityCheck, CosmosResource]),
  "IRetrievedEligibilityCheck" as const
);
export type RetrievedEligibilityCheck = t.TypeOf<
  typeof RetrievedEligibilityCheck
>;

export const NewEligibilityCheck = wrapWithKind(
  t.intersection([EligibilityCheck, BaseModel]),
  "INewEligibilityCheck" as const
);
export type NewEligibilityCheck = t.TypeOf<typeof NewEligibilityCheck>;

export class EligibilityCheckModel extends CosmosdbModel<
  EligibilityCheck,
  NewEligibilityCheck,
  RetrievedEligibilityCheck
> {
  /**
   * Creates a new EligibilityCheck model
   *
   * @param container the CosmosDB container
   */
  constructor(container: Container) {
    super(container, NewEligibilityCheck, RetrievedEligibilityCheck);
  }

  /**
   * Deletes the document by its ID
   * @param documentId
   *
   * @returns either a query error or the id of the deleted document
   */
  public deleteOneById(
    documentId: EligibilityCheck["id"]
  ): TaskEither<CosmosErrors, string> {
    return tryCatch<CosmosErrors, ItemResponse<EligibilityCheck>>(
      () => this.container.item(documentId, documentId).delete(),
      toCosmosErrorResponse
    ).map(_ => documentId);
  }
}
