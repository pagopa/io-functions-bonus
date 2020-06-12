import * as DocumentDb from "documentdb";
import { Either } from "fp-ts/lib/Either";
import { Option } from "fp-ts/lib/Option";
import * as DocumentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { DocumentDbModel } from "io-functions-commons/dist/src/utils/documentdb_model";
import * as t from "io-ts";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { pick, tag } from "italia-ts-commons/lib/types";
import { BonusActivation } from "../generated/models/BonusActivation";
import { BonusCode } from "../generated/models/BonusCode";
import { keys } from "../utils/types";

export const BONUS_ACTIVATION_COLLECTION_NAME = "bonus-activations";

// 12 characters unique ID
export const BONUS_ACTIVATION_MODEL_PK_FIELD = "id";

interface IRetrievedBonusActivation {
  readonly kind: "IRetrievedBonusActivation";
}
export const RetrievedBonusActivation = tag<IRetrievedBonusActivation>()(
  t.intersection([BonusActivation, DocumentDbUtils.RetrievedDocument])
);
export type RetrievedBonusActivation = t.TypeOf<
  typeof RetrievedBonusActivation
>;

interface INewBonusActivationTag {
  readonly kind: "INewBonusActivation";
}
export const NewBonusActivation = tag<INewBonusActivationTag>()(
  t.intersection([BonusActivation, DocumentDbUtils.NewDocument])
);
export type NewBonusActivation = t.TypeOf<typeof NewBonusActivation>;

function toRetrieved(
  result: DocumentDb.RetrievedDocument
): RetrievedBonusActivation {
  return {
    ...result,
    kind: "IRetrievedBonusActivation"
  } as RetrievedBonusActivation;
}

function toBaseType(o: RetrievedBonusActivation): BonusActivation {
  // removes attributes of RetrievedBonusActivation which aren't of BonusActivation
  return pick(keys(BonusActivation._A), o);
}

export class BonusActivationModel extends DocumentDbModel<
  BonusActivation,
  NewBonusActivation,
  RetrievedBonusActivation
> {
  /**
   * Creates a new BonusActivation model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   */
  constructor(
    dbClient: DocumentDb.DocumentClient,
    collectionUrl: DocumentDbUtils.IDocumentDbCollectionUri
  ) {
    super(dbClient, collectionUrl, toBaseType, toRetrieved);
  }

  public findBonusActivationForUser(
    bonusId: BonusCode,
    fiscalCode: FiscalCode
  ): Promise<
    Either<DocumentDb.QueryError, Option<{ bonusActivation: BonusActivation }>>
  > {
    return DocumentDbUtils.queryOneDocument(
      this.dbClient,
      this.collectionUri,
      {
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
        query: `SELECT b as bonusActivation FROM b JOIN familyMember IN b.dsuRequest.familyMembers WHERE b.${BONUS_ACTIVATION_MODEL_PK_FIELD} = @bonusId AND familyMember.fiscalCode = @fiscalCode`
      },
      bonusId
    );
  }
}
