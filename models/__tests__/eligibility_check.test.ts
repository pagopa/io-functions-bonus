import * as DocumentDb from "documentdb";
import { isLeft, isRight } from "fp-ts/lib/Either";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { EligibilityCheckStatusEnum } from "../../generated/definitions/EligibilityCheckStatus";
import { EligibilityCheckSuccess } from "../../generated/definitions/EligibilityCheckSuccess";
import {
  ELIGIBILITY_CHECK_COLLECTION_NAME,
  EligibilityCheckModel,
  NewEligibilityCheck,
  RetrievedEligibilityCheck
} from "../eligibility_check";

import * as DocumentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { EligibilityCheck } from "../../generated/definitions/EligibilityCheck";

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb" as NonEmptyString);
const aCollectionUri = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  ELIGIBILITY_CHECK_COLLECTION_NAME
);

const aFiscalCode = "AAABBB80A01C123D" as FiscalCode;

const aEligibilityCheckSuccess: EligibilityCheckSuccess = {
  family_members: [
    {
      fiscal_code: aFiscalCode,
      name: "Mario" as NonEmptyString,
      surname: "Rossi" as NonEmptyString
    }
  ],
  id: (aFiscalCode as unknown) as NonEmptyString,
  status: EligibilityCheckStatusEnum.ELIGIBLE
};

const aEligibilityCheck: EligibilityCheck = aEligibilityCheckSuccess;

const aRetrievedEligibilityCheck: RetrievedEligibilityCheck = {
  ...aEligibilityCheck,
  _self: "xyz",
  _ts: 123,
  kind: "IRetrievedEligibilityCheck"
};

const aNewEligibilityCheck: NewEligibilityCheck = {
  ...aEligibilityCheck,
  kind: "INewEligibilityCheck"
};

describe("EligibilityCheckModel#create", () => {
  it("should create a new EligibilityCheck", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) =>
        cb(undefined, aRetrievedEligibilityCheck)
      )
    };

    const model = new EligibilityCheckModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.create(
      aNewEligibilityCheck,
      aNewEligibilityCheck.id
    );

    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(aRetrievedEligibilityCheck);
    }
  });
  it("should return the error if creation fails", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error"))
    };

    const model = new EligibilityCheckModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.create(
      aNewEligibilityCheck,
      aNewEligibilityCheck.id
    );

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][0]).toEqual(
      `dbs/mockdb/colls/${ELIGIBILITY_CHECK_COLLECTION_NAME}`
    );
    expect(clientMock.createDocument.mock.calls[0][1]).toEqual({
      ...aNewEligibilityCheck,
      kind: undefined
    });
    expect(clientMock.createDocument.mock.calls[0][2]).toEqual({
      partitionKey: aNewEligibilityCheck.id
    });
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("EligibilityCheckModel#find", () => {
  it("should return an existing EligibilityCheck", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) =>
        cb(undefined, aRetrievedEligibilityCheck)
      )
    };

    const model = new EligibilityCheckModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.find(
      aRetrievedEligibilityCheck.id,
      aRetrievedEligibilityCheck.id
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][0]).toEqual(
      `dbs/mockdb/colls/${ELIGIBILITY_CHECK_COLLECTION_NAME}/docs/${aRetrievedEligibilityCheck.id}`
    );
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({
      partitionKey: aRetrievedEligibilityCheck.id
    });
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedEligibilityCheck);
    }
  });

  it("should return the error", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb("error"))
    };

    const model = new EligibilityCheckModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.find(
      aRetrievedEligibilityCheck.id,
      aRetrievedEligibilityCheck.id
    );

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("EligibilityCheckModel#deleteOneById", () => {
  it("should return the document od if the delete complete with success", async () => {
    const clientMock = {
      deleteDocument: jest.fn((_, __, cb) =>
        cb(undefined, aEligibilityCheck.id)
      )
    };

    const model = new EligibilityCheckModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.deleteOneById(aEligibilityCheck.id);

    expect(clientMock.deleteDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.deleteDocument.mock.calls[0][0]).toEqual(
      `dbs/mockdb/colls/${ELIGIBILITY_CHECK_COLLECTION_NAME}/docs/${aRetrievedEligibilityCheck.id}`
    );
    expect(clientMock.deleteDocument.mock.calls[0][1]).toEqual({
      partitionKey: aEligibilityCheck.id
    });
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(aEligibilityCheck.id);
    }
  });

  it("should return the error when delete fails", async () => {
    const aQueryError = {};
    const clientMock = {
      deleteDocument: jest.fn((_, __, cb) => cb(aQueryError))
    };

    const model = new EligibilityCheckModel(
      (clientMock as unknown) as DocumentDb.DocumentClient,
      aCollectionUri
    );

    const result = await model.deleteOneById(aEligibilityCheck.id);

    expect(clientMock.deleteDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.deleteDocument.mock.calls[0][0]).toEqual(
      `dbs/mockdb/colls/${ELIGIBILITY_CHECK_COLLECTION_NAME}/docs/${aRetrievedEligibilityCheck.id}`
    );
    expect(clientMock.deleteDocument.mock.calls[0][1]).toEqual({
      partitionKey: aEligibilityCheck.id
    });
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual(aQueryError);
    }
  });
});
