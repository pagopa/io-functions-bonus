import * as DocumentDb from "documentdb";
import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { none, Option } from "fp-ts/lib/Option";
import * as DocumentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { DocumentDbModel } from "io-functions-commons/dist/src/utils/documentdb_model";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { pick, tag } from "italia-ts-commons/lib/types";
import { BonusActivationWithFamilyUID } from "../generated/models/BonusActivationWithFamilyUID";
import { BonusCode } from "../generated/models/BonusCode";
import { keys } from "../utils/types";

export const BONUS_ACTIVATION_COLLECTION_NAME = "bonus-activations";

// 12 characters unique ID
export const BONUS_ACTIVATION_MODEL_PK_FIELD = "id";

interface IRetrievedBonusActivation {
  readonly kind: "IRetrievedBonusActivation";
}
export const RetrievedBonusActivation = tag<IRetrievedBonusActivation>()(
  t.intersection([
    BonusActivationWithFamilyUID,
    DocumentDbUtils.RetrievedDocument
  ])
);
export type RetrievedBonusActivation = t.TypeOf<
  typeof RetrievedBonusActivation
>;

interface INewBonusActivationTag {
  readonly kind: "INewBonusActivation";
}
export const NewBonusActivation = tag<INewBonusActivationTag>()(
  t.intersection([BonusActivationWithFamilyUID, DocumentDbUtils.NewDocument])
);
export type NewBonusActivation = t.TypeOf<typeof NewBonusActivation>;

function toRetrieved(
  result: DocumentDb.RetrievedDocument
): RetrievedBonusActivation {
  return RetrievedBonusActivation.decode(result).getOrElseL(err => {
    throw new Error(
      `Failed decoding RetrievedBonusActivation object: ${readableReport(err)}`
    );
  });
}

function toBaseType(o: RetrievedBonusActivation): BonusActivationWithFamilyUID {
  // removes attributes of RetrievedBonusActivation which aren't of BonusActivation
  return pick(keys(BonusActivationWithFamilyUID._A), o);
}

export class BonusActivationModel extends DocumentDbModel<
  BonusActivationWithFamilyUID,
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

  public async findBonusActivationForUser(
    bonusId: BonusCode,
    fiscalCode: FiscalCode
  ): Promise<Either<DocumentDb.QueryError, Option<RetrievedBonusActivation>>> {
    const bonusActivationAlias = "bonusActivation";
    const errorOrMaybeDocument = await DocumentDbUtils.queryOneDocument(
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
        query: `SELECT b as ${bonusActivationAlias} FROM b JOIN familyMember IN b.dsuRequest.familyMembers WHERE b.${BONUS_ACTIVATION_MODEL_PK_FIELD} = @bonusId AND familyMember.fiscalCode = @fiscalCode`
      },
      bonusId
    );

    if (
      isLeft(errorOrMaybeDocument) &&
      errorOrMaybeDocument.value.code === 404
    ) {
      // if the error is 404 (Not Found), we return an empty value
      return right<DocumentDb.QueryError, Option<RetrievedBonusActivation>>(
        none
      );
    }
    return errorOrMaybeDocument.map(maybeDocument =>
      maybeDocument.map(doc => this.toRetrieved(doc[`${bonusActivationAlias}`]))
    );
  }

  /**
   * Updates a document by replacing it
   * @param documentId
   *
   * @returns either a query error or the new document
   */
  public replace(
    document: BonusActivationWithFamilyUID
  ): Promise<Either<DocumentDb.QueryError, RetrievedBonusActivation>> {
    const documentUri = DocumentDbUtils.getDocumentUri(
      this.collectionUri,
      document.id
    );
    return new Promise(resolve =>
      this.dbClient.replaceDocument(
        documentUri.uri,
        document,
        { partitionKey: document.id },
        (err: DocumentDb.QueryError, newDoc: DocumentDb.RetrievedDocument) =>
          resolve(err ? left(err) : right(toRetrieved(newDoc)))
      )
    );
  }
}
