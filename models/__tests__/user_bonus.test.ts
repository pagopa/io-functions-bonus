import * as DocumentDb from "documentdb";
import { isLeft, isRight } from "fp-ts/lib/Either";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import {
  NewUserBonus,
  RetrievedUserBonus,
  USER_BONUS_COLLECTION_NAME,
  UserBonus,
  UserBonusModel
} from "../user_bonus";

import * as DocumentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { BonusCode } from "../../generated/models/BonusCode";

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb" as NonEmptyString);
const aCollectionUri = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  USER_BONUS_COLLECTION_NAME
);

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
  _self: "xyz",
  _ts: 123,
  id: aUserBonusId,
  kind: "IRetrievedUserBonus"
};

const aNewUserBonus: NewUserBonus = {
  ...aUserBonus,
  id: aUserBonusId,
  kind: "INewUserBonus"
};

describe("UserBonusModel#create", () => {
  it("should create a new UserBonus", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) =>
        cb(undefined, aRetrievedUserBonus)
      )
    };

    const model = new UserBonusModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.create(aNewUserBonus, aNewUserBonus.id);

    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(aRetrievedUserBonus);
    }
  });
  it("should return the error if creation fails", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error"))
    };

    const model = new UserBonusModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.create(aNewUserBonus, aNewUserBonus.id);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][0]).toEqual(
      `dbs/mockdb/colls/${USER_BONUS_COLLECTION_NAME}`
    );
    expect(clientMock.createDocument.mock.calls[0][1]).toEqual({
      ...aNewUserBonus,
      kind: undefined
    });
    expect(clientMock.createDocument.mock.calls[0][2]).toEqual({
      partitionKey: aNewUserBonus.id
    });
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("UserBonusModel#find", () => {
  it("should return an existing UserBonus", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb(undefined, aRetrievedUserBonus))
    };

    const model = new UserBonusModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.find(
      aRetrievedUserBonus.id,
      aRetrievedUserBonus.id
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][0]).toEqual(
      `dbs/mockdb/colls/${USER_BONUS_COLLECTION_NAME}/docs/${aRetrievedUserBonus.id}`
    );
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({
      partitionKey: aRetrievedUserBonus.id
    });
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedUserBonus);
    }
  });

  it("should return the error", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb("error"))
    };

    const model = new UserBonusModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.find(
      aRetrievedUserBonus.id,
      aRetrievedUserBonus.id
    );

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});
