import * as DocumentDb from "documentdb";
import { isLeft, isRight } from "fp-ts/lib/Either";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

import {
  BONUS_LEASE_COLLECTION_NAME,
  BonusLease,
  BonusLeaseModel,
  NewBonusLease,
  RetrievedBonusLease
} from "../bonus_lease";

import * as DocumentDbUtils from "io-functions-commons/dist/src/utils/documentdb";

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb" as NonEmptyString);
const aCollectionUri = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  BONUS_LEASE_COLLECTION_NAME
);

const aFamilyUID = "AAABBB80A01C123D" as NonEmptyString;
const aBonusLease: BonusLease = {
  id: aFamilyUID
};

const aRetrievedBonusLease: RetrievedBonusLease = {
  ...aBonusLease,
  _self: "xyz",
  _ts: 123,
  kind: "IRetrievedBonusLease"
};

const aNewBonusLease: NewBonusLease = {
  ...aBonusLease,
  kind: "INewBonusLease"
};

describe("BonusLeaseModel#create", () => {
  it("should create a new BonusLease", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) =>
        cb(undefined, aRetrievedBonusLease)
      )
    };

    const model = new BonusLeaseModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.create(aNewBonusLease, aNewBonusLease.id);

    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(aRetrievedBonusLease);
    }
  });
  it("should return the error if creation fails", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error"))
    };

    const model = new BonusLeaseModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.create(aNewBonusLease, aNewBonusLease.id);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][0]).toEqual(
      `dbs/mockdb/colls/${BONUS_LEASE_COLLECTION_NAME}`
    );
    expect(clientMock.createDocument.mock.calls[0][1]).toEqual({
      ...aNewBonusLease,
      kind: undefined
    });
    expect(clientMock.createDocument.mock.calls[0][2]).toEqual({
      partitionKey: aNewBonusLease.id
    });
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("BonusLeaseModel#deleteOneById", () => {
  it("should return the document od if the delete complete with success", async () => {
    const clientMock = {
      deleteDocument: jest.fn((_, __, cb) => cb(undefined, aBonusLease.id))
    };

    const model = new BonusLeaseModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.deleteOneById(aBonusLease.id);

    expect(clientMock.deleteDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.deleteDocument.mock.calls[0][0]).toEqual(
      `dbs/mockdb/colls/${BONUS_LEASE_COLLECTION_NAME}/docs/${aBonusLease.id}`
    );
    expect(clientMock.deleteDocument.mock.calls[0][1]).toEqual({
      partitionKey: aBonusLease.id
    });
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(aBonusLease.id);
    }
  });

  it("should return the error when delete fails", async () => {
    const aQueryError = {};
    const clientMock = {
      deleteDocument: jest.fn((_, __, cb) => cb(aQueryError))
    };

    const model = new BonusLeaseModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.deleteOneById(aBonusLease.id);

    expect(clientMock.deleteDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.deleteDocument.mock.calls[0][0]).toEqual(
      `dbs/mockdb/colls/${BONUS_LEASE_COLLECTION_NAME}/docs/${aBonusLease.id}`
    );
    expect(clientMock.deleteDocument.mock.calls[0][1]).toEqual({
      partitionKey: aBonusLease.id
    });
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual(aQueryError);
    }
  });
});
