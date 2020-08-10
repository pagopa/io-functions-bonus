import { Container } from "@azure/cosmos";
import { tryCatch2v } from "fp-ts/lib/Either";
import { fromEither, TaskEither } from "fp-ts/lib/TaskEither";
import {
  BaseModel,
  CosmosdbModel,
  CosmosErrors,
  CosmosResource,
  toCosmosErrorResponse
} from "io-functions-commons/dist/src/utils/cosmosdb_model";
import { wrapWithKind } from "io-functions-commons/dist/src/utils/types";
import * as t from "io-ts";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { BonusCode } from "../generated/models/BonusCode";

export const USER_BONUS_COLLECTION_NAME = "user-bonuses";
export const USER_BONUS_MODEL_PK_FIELD = "fiscalCode" as const;

const UserBonus = t.interface({
  // Id of the Bonus available to the user
  bonusId: BonusCode,
  // The id of the user
  fiscalCode: FiscalCode,
  // Whether this person is the one in his/her family that applied for the bonus to activate
  isApplicant: t.boolean
});
export type UserBonus = t.TypeOf<typeof UserBonus>;

export const RetrievedUserBonus = wrapWithKind(
  t.intersection([UserBonus, CosmosResource]),
  "IRetrievedUserBonus" as const
);
export type RetrievedUserBonus = t.TypeOf<typeof RetrievedUserBonus>;

export const NewUserBonus = wrapWithKind(
  t.intersection([UserBonus, BaseModel]),
  "INewUserBonus" as const
);
export type NewUserBonus = t.TypeOf<typeof NewUserBonus>;

export class UserBonusModel extends CosmosdbModel<
  UserBonus,
  NewUserBonus,
  RetrievedUserBonus,
  typeof USER_BONUS_MODEL_PK_FIELD
> {
  /**
   * Creates a new UserBonus model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   */
  constructor(container: Container) {
    super(container, NewUserBonus, RetrievedUserBonus);
  }

  public findBonusActivations(
    fiscalCode: FiscalCode
  ): TaskEither<
    CosmosErrors,
    AsyncIterator<ReadonlyArray<t.Validation<RetrievedUserBonus>>>
  > {
    const iterator = this.getQueryIterator({
      parameters: [
        {
          name: "@fiscalCode",
          value: fiscalCode
        }
      ],
      query: `SELECT * FROM m WHERE m.${USER_BONUS_MODEL_PK_FIELD} = @fiscalCode`
    })[Symbol.asyncIterator]();
    return fromEither(tryCatch2v(() => iterator, toCosmosErrorResponse));
  }
}
