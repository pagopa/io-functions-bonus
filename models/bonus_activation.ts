import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { DocumentDbModel } from "io-functions-commons/dist/src/utils/documentdb_model";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { pick, tag } from "italia-ts-commons/lib/types";
import { BonusActivation } from "../generated/models/BonusActivation";
import { keys } from "../utils/types";

export const BONUS_ACTIVATION_COLLECTION_NAME = "bonus-activations";

// familyUID = hash(CF1, CF2, ..., "BVC01")
// computed on all family members as returned from the eligibility check
// when successfull and user is eligible
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
  return RetrievedBonusActivation.decode(result).getOrElseL(errs => {
    throw new Error(
      `Retrieved result wasn't a RetrievedBonusActivation: ${readableReport(
        errs
      )}`
    );
  });
}

function toBaseType(o: RetrievedBonusActivation): BonusActivation {
  // removes attributes of RetrievedBonusActivation which aren't of BonusActivation
  // TODO: try to use BonusActivation.encode(o)
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
}
