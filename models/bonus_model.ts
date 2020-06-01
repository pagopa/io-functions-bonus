import * as t from "io-ts";
import { PathReporter } from "io-ts/lib/PathReporter";

import * as DocumentDb from "documentdb";
import {
  DocumentDbModelVersioned,
  ModelId,
  VersionedModel
} from "io-functions-commons/dist/src//utils/documentdb_model_versioned";
import * as DocumentDbUtils from "io-functions-commons/dist/src/utils/documentdb";

import { Either } from "fp-ts/lib/Either";
import { Option } from "fp-ts/lib/Option";

import { nonEmptyStringToModelId } from "io-functions-commons/dist/src/utils/conversions";
import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";

import { tag } from "italia-ts-commons/lib/types";

export const BONUS_COLLECTION_NAME = "bonus";
export const BONUS_MODEL_PK_FIELD = "applicantFiscalCode";

// required attributes
const BonusR = t.interface({
  applicantFiscalCode: FiscalCode,
  bonusId: NonEmptyString
});

// optional attributes
const BonusO = t.partial({});

/**
 * Base interface for Bonus objects
 */
export const Bonus = t.intersection([BonusR, BonusO], "Bonus");
export type Bonus = t.TypeOf<typeof Bonus>;

/**
 * Interface for new Bonus objects
 */
interface INewBonusTag {
  readonly kind: "INewBonus";
}
export const NewBonus = tag<INewBonusTag>()(
  t.intersection([Bonus, DocumentDbUtils.NewDocument, VersionedModel])
);
export type NewBonus = t.TypeOf<typeof NewBonus>;

/**
 * Interface for retrieved Bonus objects
 *
 * Existing Bonus records have a version number.
 */
interface IRetrievedBonusTag {
  readonly kind: "IRetrievedBonus";
}
export const RetrievedBonus = tag<IRetrievedBonusTag>()(
  t.intersection([Bonus, DocumentDbUtils.RetrievedDocument, VersionedModel])
);
export type RetrievedBonus = t.TypeOf<typeof RetrievedBonus>;

function toRetrieved(result: DocumentDb.RetrievedDocument): RetrievedBonus {
  const validation = RetrievedBonus.decode(result);
  return validation.getOrElseL(_ => {
    throw new Error(PathReporter.report(validation).join("\n"));
  });
}

function getModelId(o: Bonus): ModelId {
  return nonEmptyStringToModelId(o.bonusId);
}

function updateModelId(
  o: Bonus,
  id: NonEmptyString,
  version: NonNegativeNumber
): NewBonus {
  return {
    ...o,
    id,
    kind: "INewBonus",
    version
  };
}

export function toBaseType(o: RetrievedBonus): Bonus {
  return t.exact(Bonus).encode(o);
}

/**
 * A model for handling Bonus
 */
export class BonusModel extends DocumentDbModelVersioned<
  Bonus,
  NewBonus,
  RetrievedBonus
> {
  /**
   * Creates a new Bonus model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   */
  constructor(
    dbClient: DocumentDb.DocumentClient,
    collectionUrl: DocumentDbUtils.IDocumentDbCollectionUri
  ) {
    super(
      dbClient,
      collectionUrl,
      toBaseType,
      toRetrieved,
      getModelId,
      updateModelId
    );
  }

  public findOneByBonusId(
    bonusId: NonEmptyString
  ): Promise<Either<DocumentDb.QueryError, Option<RetrievedBonus>>> {
    return super.findLastVersionByModelId(
      BONUS_MODEL_PK_FIELD,
      bonusId,
      BONUS_MODEL_PK_FIELD,
      bonusId
    );
  }
}
