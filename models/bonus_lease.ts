import * as DocumentDb from "documentdb";
import { Either, left, right } from "fp-ts/lib/Either";
import * as DocumentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { DocumentDbModel } from "io-functions-commons/dist/src/utils/documentdb_model";
import * as t from "io-ts";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { pick, tag } from "italia-ts-commons/lib/types";
import { keys } from "../utils/types";

export const BONUS_LEASE_COLLECTION_NAME = "bonus-leases";

// Computed unique ID from family members fiscal codes
export const BONUS_LEASE_MODEL_PK_FIELD = "id";

export const BonusLease = t.interface({
  id: NonEmptyString
});
export type BonusLease = t.TypeOf<typeof BonusLease>;

interface IRetrievedBonusLease {
  readonly kind: "IRetrievedBonusLease";
}
export const RetrievedBonusLease = tag<IRetrievedBonusLease>()(
  t.intersection([BonusLease, DocumentDbUtils.RetrievedDocument])
);
export type RetrievedBonusLease = t.TypeOf<typeof RetrievedBonusLease>;

interface INewBonusLeaseTag {
  readonly kind: "INewBonusLease";
}
export const NewBonusLease = tag<INewBonusLeaseTag>()(
  t.intersection([BonusLease, DocumentDbUtils.NewDocument])
);
export type NewBonusLease = t.TypeOf<typeof NewBonusLease>;

function toRetrieved(
  result: DocumentDb.RetrievedDocument
): RetrievedBonusLease {
  return {
    ...result,
    kind: "IRetrievedBonusLease"
  } as RetrievedBonusLease;
}

function toBaseType(o: RetrievedBonusLease): BonusLease {
  // removes attributes of RetrievedBonusLease which aren't of BonusLease
  return pick(keys(BonusLease._A), o);
}

export class BonusLeaseModel extends DocumentDbModel<
  BonusLease,
  NewBonusLease,
  RetrievedBonusLease
> {
  /**
   * Creates a new BonusLease model
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

  /**
   * Deletes the document by its ID
   * @param documentId
   *
   * @returns either a query error or the id of the deleted document
   */
  public deleteOneById(
    documentId: BonusLease["id"]
  ): Promise<Either<DocumentDb.QueryError, string>> {
    const documentUri = DocumentDbUtils.getDocumentUri(
      this.collectionUri,
      documentId
    );
    return new Promise(resolve =>
      this.dbClient.deleteDocument(
        documentUri.uri,
        { partitionKey: documentId },
        (err: DocumentDb.QueryError) =>
          resolve(err ? left(err) : right(documentId))
      )
    );
  }
}
