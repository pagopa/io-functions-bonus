import * as DocumentDb from "documentdb";
import { isLeft, isRight } from "fp-ts/lib/Either";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { BonusActivation } from "../../generated/models/BonusActivation";
import {
  BONUS_ACTIVATION_COLLECTION_NAME,
  BonusActivationModel,
  NewBonusActivation,
  RetrievedBonusActivation
} from "../bonus_activation";

import * as DocumentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { IWithinRangeIntegerTag } from "italia-ts-commons/lib/numbers";
import { BonusActivationStatusEnum } from "../../generated/models/BonusActivationStatus";
import { BonusCode } from "../../generated/models/BonusCode";
import { StatusEnum } from "../../generated/models/EligibilityCheckSuccessEligible";

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb" as NonEmptyString);
const aCollectionUri = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  BONUS_ACTIVATION_COLLECTION_NAME
);

const aFiscalCode = "AAABBB80A01C123D" as FiscalCode;
const aBonusId = "AAAAAAAAAAAA" as NonEmptyString & BonusCode;
const aBonusActivationId = aBonusId;
const aBonusActivation: BonusActivation = {
  id: "AAAAAAAAAAAA" as BonusCode,

  applicantFiscalCode: aFiscalCode,

  status: BonusActivationStatusEnum.ACTIVE,

  code: "a bonus code" as NonEmptyString,

  updatedAt: new Date(),

  dsuRequest: {
    familyMembers: [
      {
        fiscalCode: aFiscalCode,
        name: "MARIO" as NonEmptyString,
        surname: "ROSSI" as NonEmptyString
      }
    ],

    maxAmount: (200 as unknown) as IWithinRangeIntegerTag<150, 501> & number,

    maxTaxBenefit: (100 as unknown) as IWithinRangeIntegerTag<30, 101> & number,

    requestId: "aRequestId" as NonEmptyString,

    iseeType: "aISEEtype",

    dsuProtocolId: "aProtocolId" as NonEmptyString,

    dsuCreatedAt: new Date().toISOString(),

    hasDiscrepancies: false
  }
};

const aRetrievedBonusActivation: RetrievedBonusActivation = {
  ...aBonusActivation,
  _self: "xyz",
  _ts: 123,
  id: aBonusActivationId,
  kind: "IRetrievedBonusActivation"
};

const aNewBonusActivation: NewBonusActivation = {
  ...aBonusActivation,
  id: aBonusActivationId,
  kind: "INewBonusActivation"
};

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
