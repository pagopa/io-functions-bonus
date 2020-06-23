import * as DocumentDb from "documentdb";
import { Either, left, right } from "fp-ts/lib/Either";
import * as DocumentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { DocumentDbModel } from "io-functions-commons/dist/src/utils/documentdb_model";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { pick, tag } from "italia-ts-commons/lib/types";
import { BonusCode } from "../generated/models/BonusCode";
import { keys } from "../utils/types";

export const BONUS_PROCESSING_COLLECTION_NAME = "bonus-processings";

// Applicant fiscal code
export const BONUS_PROCESSING_MODEL_PK_FIELD = "id";

export const BonusProcessing = t.interface({
  bonusId: BonusCode,
  id: FiscalCode
});
export type BonusProcessing = t.TypeOf<typeof BonusProcessing>;

interface IRetrievedBonusProcessing {
  readonly kind: "IRetrievedBonusProcessing";
}
export const RetrievedBonusProcessing = tag<IRetrievedBonusProcessing>()(
  t.intersection([BonusProcessing, DocumentDbUtils.RetrievedDocument])
);
export type RetrievedBonusProcessing = t.TypeOf<
  typeof RetrievedBonusProcessing
>;

interface INewBonusProcessingTag {
  readonly kind: "INewBonusProcessing";
}
export const NewBonusProcessing = tag<INewBonusProcessingTag>()(
  t.intersection([BonusProcessing, DocumentDbUtils.NewDocument])
);
export type NewBonusProcessing = t.TypeOf<typeof NewBonusProcessing>;

function toRetrieved(
  result: DocumentDb.RetrievedDocument
): RetrievedBonusProcessing {
  return RetrievedBonusProcessing.decode(result).getOrElseL(err => {
    throw new Error(
      `Failed decoding RetrievedBonusProcessing object: ${readableReport(err)}`
    );
  });
}

function toBaseType(o: RetrievedBonusProcessing): BonusProcessing {
  // removes attributes of RetrievedBonusProcessing which aren't of BonusProcessing
  return pick(keys(BonusProcessing._A), o);
}

export class BonusProcessingModel extends DocumentDbModel<
  BonusProcessing,
  NewBonusProcessing,
  RetrievedBonusProcessing
> {
  /**
   * Creates a new BonusProcessing model
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
    documentId: BonusProcessing["id"]
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
