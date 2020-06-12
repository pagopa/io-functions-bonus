import * as DocumentDb from "documentdb";
import { DocumentDbModel } from "io-functions-commons/dist/src//utils/documentdb_model";
import * as DocumentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { tag } from "italia-ts-commons/lib/types";
import { BonusCode } from "../generated/models/BonusCode";

export const USER_BONUS_COLLECTION_NAME = "user-bonuses";
export const USER_BONUS_MODEL_PK_FIELD = "fiscalCode";

const UserBonus = t.interface({
  // Id of the Bonus available to the user
  bonusId: BonusCode,
  // The id of the user
  fiscalCode: FiscalCode,
  // Whether this person is the one in his/her family that applied for the bonus to activate
  isApplicant: t.boolean
});
export type UserBonus = t.TypeOf<typeof UserBonus>;

interface IRetrievedUserBonus {
  readonly kind: "IRetrievedUserBonus";
}
export const RetrievedUserBonus = tag<IRetrievedUserBonus>()(
  t.intersection([UserBonus, DocumentDbUtils.RetrievedDocument])
);
export type RetrievedUserBonus = t.TypeOf<typeof RetrievedUserBonus>;

interface INewUserBonusTag {
  readonly kind: "INewUserBonus";
}
export const NewUserBonus = tag<INewUserBonusTag>()(
  t.intersection([UserBonus, DocumentDbUtils.NewDocument])
);
export type NewUserBonus = t.TypeOf<typeof NewUserBonus>;

function toRetrieved(result: DocumentDb.RetrievedDocument): RetrievedUserBonus {
  return RetrievedUserBonus.decode(result).getOrElseL(errs => {
    throw new Error(
      `Retrieved result wasn't a RetrievedUserBonus: ${readableReport(errs)}`
    );
  });
}

function toBaseType(o: RetrievedUserBonus): UserBonus {
  return t.exact(UserBonus).encode(o);
}

export class UserBonusModel extends DocumentDbModel<
  UserBonus,
  NewUserBonus,
  RetrievedUserBonus
> {
  /**
   * Creates a new UserBonus model
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
  public findBonusActivations(
    fiscalCode: FiscalCode
  ): DocumentDbUtils.IResultIterator<UserBonus> {
    return DocumentDbUtils.queryDocuments(
      this.dbClient,
      this.collectionUri,
      {
        parameters: [
          {
            name: "@fiscalCode",
            value: fiscalCode
          }
        ],
        query: `SELECT * FROM m WHERE m.${USER_BONUS_MODEL_PK_FIELD} = @fiscalCode`
      },
      fiscalCode
    );
  }
}
