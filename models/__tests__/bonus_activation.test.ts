import * as DocumentDb from "documentdb";
import { isLeft, isRight } from "fp-ts/lib/Either";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import {
  BONUS_ACTIVATION_COLLECTION_NAME,
  BonusActivationModel
} from "../bonus_activation";

import * as DocumentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import {
  aBonusActivationWithFamilyUID,
  aNewBonusActivation,
  aRetrievedBonusActivation
} from "../../__mocks__/mocks";

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb" as NonEmptyString);
const aCollectionUri = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  BONUS_ACTIVATION_COLLECTION_NAME
);

describe("BonusActivationModel#create", () => {
  it("should create a new BonusActivation", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) =>
        cb(undefined, aRetrievedBonusActivation)
      )
    };

    const model = new BonusActivationModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.create(
      aNewBonusActivation,
      aNewBonusActivation.id
    );

    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(aRetrievedBonusActivation);
    }
  });
  it("should return the error if creation fails", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error"))
    };

    const model = new BonusActivationModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.create(
      aNewBonusActivation,
      aNewBonusActivation.id
    );

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][0]).toEqual(
      `dbs/mockdb/colls/${BONUS_ACTIVATION_COLLECTION_NAME}`
    );
    expect(clientMock.createDocument.mock.calls[0][1]).toEqual({
      ...aNewBonusActivation,
      kind: undefined
    });
    expect(clientMock.createDocument.mock.calls[0][2]).toEqual({
      partitionKey: aNewBonusActivation.id
    });
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("BonusActivationModel#find", () => {
  it("should return an existing BonusActivation", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) =>
        cb(undefined, aRetrievedBonusActivation)
      )
    };

    const model = new BonusActivationModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.find(
      aRetrievedBonusActivation.id,
      aRetrievedBonusActivation.id
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][0]).toEqual(
      `dbs/mockdb/colls/${BONUS_ACTIVATION_COLLECTION_NAME}/docs/${aRetrievedBonusActivation.id}`
    );
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({
      partitionKey: aRetrievedBonusActivation.id
    });
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedBonusActivation);
    }
  });

  it("should return the error", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb("error"))
    };

    const model = new BonusActivationModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.find(
      aRetrievedBonusActivation.id,
      aRetrievedBonusActivation.id
    );

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("BonusActivationModel#replace", () => {
  it("should return the updated document", async () => {
    const clientMock = {
      replaceDocument: jest.fn((_, __, ___, cb) =>
        cb(undefined, aRetrievedBonusActivation)
      )
    };

    const model = new BonusActivationModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.replace(aBonusActivationWithFamilyUID);

    expect(clientMock.replaceDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.replaceDocument.mock.calls[0][0]).toEqual(
      `dbs/mockdb/colls/${BONUS_ACTIVATION_COLLECTION_NAME}/docs/${aBonusActivationWithFamilyUID.id}`
    );
    expect(clientMock.replaceDocument.mock.calls[0][2]).toEqual({
      partitionKey: aBonusActivationWithFamilyUID.id
    });
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(aRetrievedBonusActivation);
    }
  });

  it("should return the error", async () => {
    const clientMock = {
      replaceDocument: jest.fn((_, __, ___, cb) => cb("error"))
    };

    const model = new BonusActivationModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.replace(aBonusActivationWithFamilyUID);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});
