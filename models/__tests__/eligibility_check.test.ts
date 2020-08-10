import { isLeft, isRight } from "fp-ts/lib/Either";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import {
  EligibilityCheckModel,
  NewEligibilityCheck,
  RetrievedEligibilityCheck
} from "../eligibility_check";

import { Container } from "@azure/cosmos";
import { CosmosErrorResponse } from "io-functions-commons/dist/src/utils/cosmosdb_model";
import {
  mockContainer,
  mockCreate,
  mockDelete,
  mockItem,
  mockRead
} from "../../__mocks__/cosmosdb-container";
import { EligibilityCheck } from "../../generated/models/EligibilityCheck";
import { EligibilityCheckSuccess } from "../../generated/models/EligibilityCheckSuccess";
import { StatusEnum as EligibilityCheckSuccessEligibleStatus } from "../../generated/models/EligibilityCheckSuccessEligible";

const aFiscalCode = "AAABBB80A01C123D" as FiscalCode;

const aEligibilityCheckSuccess: EligibilityCheckSuccess = {
  dsuRequest: {
    dsuCreatedAt: new Date(),
    dsuProtocolId: "123" as NonEmptyString,
    familyMembers: [
      {
        fiscalCode: aFiscalCode,
        name: "Mario" as NonEmptyString,
        surname: "Rossi" as NonEmptyString
      }
    ],
    hasDiscrepancies: true,
    iseeType: "some isee type",
    maxAmount: 250,
    maxTaxBenefit: 50,
    requestId: 123
  },
  id: (aFiscalCode as unknown) as NonEmptyString,
  status: EligibilityCheckSuccessEligibleStatus.ELIGIBLE,
  validBefore: new Date()
};

const aEligibilityCheck: EligibilityCheck = aEligibilityCheckSuccess;

const aRetrievedEligibilityCheck: RetrievedEligibilityCheck = {
  ...aEligibilityCheck,
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  kind: "IRetrievedEligibilityCheck"
};

const aNewEligibilityCheck: NewEligibilityCheck = {
  ...aEligibilityCheck,
  kind: "INewEligibilityCheck"
};

const queryError = new Error("Query Error");

describe("EligibilityCheckModel#create", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should create a new EligibilityCheck", async () => {
    mockCreate.mockImplementationOnce(() =>
      Promise.resolve({ resource: aRetrievedEligibilityCheck })
    );

    const model = new EligibilityCheckModel(
      (mockContainer as unknown) as Container
    );

    const result = await model.create(aNewEligibilityCheck).run();

    expect(mockContainer.items.create.mock.calls[0][1].kind).toBeUndefined();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(aRetrievedEligibilityCheck);
    }
  });
  it("should return the error if creation fails", async () => {
    mockCreate.mockImplementationOnce(() => Promise.reject(queryError));

    const model = new EligibilityCheckModel(
      (mockContainer as unknown) as Container
    );

    const result = await model.create(aNewEligibilityCheck).run();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual(CosmosErrorResponse(queryError));
    }
  });
});

describe("EligibilityCheckModel#find", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should return an existing EligibilityCheck", async () => {
    mockRead.mockImplementationOnce(() =>
      Promise.resolve({ resource: aRetrievedEligibilityCheck })
    );

    const model = new EligibilityCheckModel(
      (mockContainer as unknown) as Container
    );

    const result = await model.find([aRetrievedEligibilityCheck.id]).run();

    expect(mockContainer.item).toHaveBeenCalledTimes(1);
    expect(mockContainer.item).toBeCalledWith(
      aRetrievedEligibilityCheck.id,
      aRetrievedEligibilityCheck.id
    );
    expect(mockRead).toBeCalledTimes(1);
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedEligibilityCheck);
    }
  });

  it("should return the error", async () => {
    mockRead.mockImplementationOnce(() => Promise.reject(queryError));

    const model = new EligibilityCheckModel(
      (mockContainer as unknown) as Container
    );

    const result = await model.find([aRetrievedEligibilityCheck.id]).run();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual(CosmosErrorResponse(queryError));
    }
  });
});

describe("EligibilityCheckModel#deleteOneById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should return the document od if the delete complete with success", async () => {
    mockDelete.mockImplementationOnce(() =>
      Promise.resolve({ resource: aEligibilityCheck })
    );

    const model = new EligibilityCheckModel(
      (mockContainer as unknown) as Container
    );

    const result = await model.deleteOneById(aEligibilityCheck.id).run();

    expect(mockItem).toHaveBeenCalledWith(
      aEligibilityCheck.id,
      aEligibilityCheck.id
    );
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(aEligibilityCheck.id);
    }
  });

  it("should return the error when delete fails", async () => {
    mockDelete.mockImplementationOnce(() => Promise.reject(queryError));

    const model = new EligibilityCheckModel(
      (mockContainer as unknown) as Container
    );

    const result = await model.deleteOneById(aEligibilityCheck.id).run();

    expect(mockItem).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual(CosmosErrorResponse(queryError));
    }
  });
});
