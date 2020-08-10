import { Container, ItemResponse } from "@azure/cosmos";
import { left } from "fp-ts/lib/Either";
import { fromNullable, Option } from "fp-ts/lib/Option";
import { fromEither, TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import {
  BaseModel,
  CosmosdbModel,
  CosmosDecodingError,
  CosmosErrorResponse,
  CosmosErrors,
  CosmosResource,
  toCosmosErrorResponse
} from "io-functions-commons/dist/src/utils/cosmosdb_model";
import { wrapWithKind } from "io-functions-commons/dist/src/utils/types";
import * as t from "io-ts";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { BonusActivationWithFamilyUID } from "../generated/models/BonusActivationWithFamilyUID";
import { BonusCode } from "../generated/models/BonusCode";

export const BONUS_ACTIVATION_COLLECTION_NAME = "bonus-activations";

// 12 characters unique ID
export const BONUS_ACTIVATION_MODEL_PK_FIELD = "id" as const;

export const RetrievedBonusActivation = wrapWithKind(
  t.intersection([BonusActivationWithFamilyUID, CosmosResource]),
  "IRetrievedBonusActivation" as const
);

export type RetrievedBonusActivation = t.TypeOf<
  typeof RetrievedBonusActivation
>;

export const NewBonusActivation = wrapWithKind(
  t.intersection([BonusActivationWithFamilyUID, BaseModel]),
  "INewBonusActivation" as const
);

export type NewBonusActivation = t.TypeOf<typeof NewBonusActivation>;

export class BonusActivationModel extends CosmosdbModel<
  BonusActivationWithFamilyUID,
  NewBonusActivation,
  RetrievedBonusActivation
> {
  /**
   * Creates a new BonusActivation model
   *
   * @param container the CosmosDB container
   */
  constructor(container: Container) {
    super(container, NewBonusActivation, RetrievedBonusActivation);
  }

  public findBonusActivationForUser(
    bonusId: BonusCode,
    fiscalCode: FiscalCode
  ): TaskEither<CosmosErrors, Option<RetrievedBonusActivation>> {
    return this.findOneByQuery({
      parameters: [
        {
          name: "@bonusId",
          value: bonusId
        },
        {
          name: "@fiscalCode",
          value: fiscalCode
        }
      ],
      query: `SELECT VALUE b FROM b JOIN familyMember IN b.dsuRequest.familyMembers WHERE b.${BONUS_ACTIVATION_MODEL_PK_FIELD} = @bonusId AND familyMember.fiscalCode = @fiscalCode`
    });
  }

  /**
   * Updates a document by replacing it
   * @param documentId
   *
   * @returns either a query error or the new document
   */
  public replace(
    document: BonusActivationWithFamilyUID
  ): TaskEither<CosmosErrors, RetrievedBonusActivation> {
    return tryCatch<CosmosErrors, ItemResponse<BonusActivationWithFamilyUID>>(
      () => this.container.item(document.id, document.id).replace(document),
      toCosmosErrorResponse
    )
      .map(_ => fromNullable(_.resource))
      .chain(_ =>
        _.isSome()
          ? fromEither(
              RetrievedBonusActivation.decode(_.value).mapLeft(
                CosmosDecodingError
              )
            )
          : fromEither(
              left(
                CosmosErrorResponse({
                  code: 404,
                  message: "Document not found",
                  name: "Not Found"
                })
              )
            )
      );
  }
}
