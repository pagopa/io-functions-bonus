import { isLeft, isRight } from "fp-ts/lib/Either";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import {
  NewUserBonus,
  RetrievedUserBonus,
  UserBonus,
  UserBonusModel
} from "../user_bonus";

import { Container } from "@azure/cosmos";
import { CosmosErrorResponse } from "io-functions-commons/dist/src/utils/cosmosdb_model";
import {
  mockContainer,
  mockCreate,
  mockRead
} from "../../__mocks__/cosmosdb-container";
import { BonusCode } from "../../generated/models/BonusCode";

const aFiscalCode = "AAABBB80A01C123D" as FiscalCode;
const aBonusId = "AAAAAAAAAAA3" as BonusCode;
const aUserBonusId = `${aFiscalCode}-${aBonusId}` as NonEmptyString;
const aUserBonus: UserBonus = {
  bonusId: aBonusId,
  fiscalCode: aFiscalCode,
  isApplicant: true
};

const aRetrievedUserBonus: RetrievedUserBonus = {
  ...aUserBonus,
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  id: aUserBonusId,
  kind: "IRetrievedUserBonus"
};

const aNewUserBonus: NewUserBonus = {
  ...aUserBonus,
  id: aUserBonusId,
  kind: "INewUserBonus"
};

const queryError = new Error("Query Error");

describe("UserBonusModel#create", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should create a new UserBonus", async () => {
    mockCreate.mockImplementationOnce(() =>
      Promise.resolve({ resource: aRetrievedUserBonus })
    );

    const model = new UserBonusModel((mockContainer as unknown) as Container);

    const result = await model.create(aNewUserBonus).run();

    expect(mockContainer.items.create.mock.calls[0][1].kind).toBeUndefined();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(aRetrievedUserBonus);
    }
  });
  it("should return the error if creation fails", async () => {
    mockCreate.mockImplementationOnce(() => Promise.reject(queryError));

    const model = new UserBonusModel((mockContainer as unknown) as Container);

    const result = await model.create(aNewUserBonus).run();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual(CosmosErrorResponse(queryError));
    }
  });
});

describe("UserBonusModel#find", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should return an existing UserBonus", async () => {
    mockRead.mockImplementationOnce(() =>
      Promise.resolve({ resource: aRetrievedUserBonus })
    );
    const model = new UserBonusModel((mockContainer as unknown) as Container);

    const result = await model
      .find([
        aRetrievedUserBonus.id,
        (aRetrievedUserBonus.id as unknown) as FiscalCode
      ])
      .run();

    expect(mockContainer.item).toHaveBeenCalledTimes(1);
    expect(mockContainer.item).toBeCalledWith(
      aRetrievedUserBonus.id,
      aRetrievedUserBonus.id
    );
    expect(mockRead).toBeCalledTimes(1);
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedUserBonus);
    }
  });

  it("should return the error", async () => {
    mockRead.mockImplementationOnce(() => Promise.reject(queryError));

    const model = new UserBonusModel((mockContainer as unknown) as Container);

    const result = await model
      .find([
        aRetrievedUserBonus.id,
        (aRetrievedUserBonus.id as unknown) as FiscalCode
      ])
      .run();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual(CosmosErrorResponse(queryError));
    }
  });
});
