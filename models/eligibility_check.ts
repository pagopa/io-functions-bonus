/**
 * An EligibilityCheck is a request from the User to validate his/her DSU (dichiarazione sostitutiva unica). It might be referred also as DSU Request.
 * An EligibilityCheck is identified by the User's unique identifier (thus at most one EligibilityCheck can exist for a User at a given time).
 * It can be a case of Success of Failure: in the first case it will also include a list of the family members of the associated DSU
 */

import * as DocumentDb from "documentdb";
import { Either, left, right } from "fp-ts/lib/Either";
import * as DocumentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { DocumentDbModel } from "io-functions-commons/dist/src/utils/documentdb_model";
import * as t from "io-ts";
import { pick, tag } from "italia-ts-commons/lib/types";
import { EligibilityCheck } from "../types/EligibilityCheck";
import { keys, assertNever } from "../utils/types";
import { EligibilityCheckSuccessEligible } from "../types/EligibilityCheckSuccessEligible";
import { EligibilityCheckFailure } from "../types/EligibilityCheckFailure";
import { EligibilityCheckSuccessIneligible } from "../types/EligibilityCheckSuccessIneligible";

export const ELIGIBILITY_CHECK_COLLECTION_NAME = "eligibility-checks";
export const ELIGIBILITY_CHECK_MODEL_PK_FIELD = "id";

interface IRetrievedEligibilityCheck {
  readonly kind: "IRetrievedEligibilityCheck";
}
export const RetrievedEligibilityCheck = tag<IRetrievedEligibilityCheck>()(
  t.intersection([EligibilityCheck, DocumentDbUtils.RetrievedDocument])
);
export type RetrievedEligibilityCheck = t.TypeOf<
  typeof RetrievedEligibilityCheck
>;

interface INewEligibilityCheckTag {
  readonly kind: "INewEligibilityCheck";
}
export const NewEligibilityCheck = tag<INewEligibilityCheckTag>()(
  t.intersection([EligibilityCheck, DocumentDbUtils.NewDocument])
);
export type NewEligibilityCheck = t.TypeOf<typeof NewEligibilityCheck>;

function toRetrieved(
  result: DocumentDb.RetrievedDocument
): RetrievedEligibilityCheck {
  return {
    ...result,
    kind: "IRetrievedEligibilityCheck"
  } as RetrievedEligibilityCheck;
}

function toBaseType(o: RetrievedEligibilityCheck): EligibilityCheck {
  // removes attributes of RetrievedEligibilityCheck which aren't of EligibilityCheck
  // TODO: try to use t.exact(EligibilityCheck).encode(o)
  return EligibilityCheckSuccessEligible.is(o)
    ? pick(keys(EligibilityCheckSuccessEligible._A), o)
    : EligibilityCheckSuccessIneligible.is(o)
    ? pick(keys(EligibilityCheckSuccessIneligible._A), o)
    : EligibilityCheckFailure.is(o)
    ? pick(keys(EligibilityCheckFailure._A), o)
    : assertNever(o);
}

export class EligibilityCheckModel extends DocumentDbModel<
  EligibilityCheck,
  NewEligibilityCheck,
  RetrievedEligibilityCheck
> {
  /**
   * Creates a new EligibilityCheck model
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
    documentId: EligibilityCheck["id"]
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
