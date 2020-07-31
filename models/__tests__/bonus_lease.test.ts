import { isLeft, isRight } from "fp-ts/lib/Either";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

import { Container } from "@azure/cosmos";
import { CosmosErrorResponse } from "io-functions-commons/dist/src/utils/cosmosdb_model";
import {
  mockContainer,
  mockCreate,
  mockDelete,
  mockItem
} from "../../__mocks__/cosmosdb-container";
import {
  BonusLease,
  BonusLeaseModel,
  NewBonusLease,
  RetrievedBonusLease
} from "../bonus_lease";

const aFamilyUID = "AAABBB80A01C123D" as NonEmptyString;
const aBonusLease: BonusLease = {
  id: aFamilyUID
};

const aRetrievedBonusLease: RetrievedBonusLease = {
  ...aBonusLease,
  kind: "IRetrievedBonusLease"
};

const aNewBonusLease: NewBonusLease = {
  ...aBonusLease,
  kind: "INewBonusLease"
};

const queryError = new Error("Query Error");

describe("BonusLeaseModel#create", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should create a new BonusLease", async () => {
    mockCreate.mockImplementationOnce(() =>
      Promise.resolve({ resource: aRetrievedBonusLease })
    );

    const model = new BonusLeaseModel((mockContainer as unknown) as Container);

    const result = await model.create(aNewBonusLease).run();

    expect(mockContainer.items.create.mock.calls[0][1].kind).toBeUndefined();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(aRetrievedBonusLease);
    }
  });
  it("should return the error if creation fails", async () => {
    mockCreate.mockImplementationOnce(() => Promise.reject(queryError));

    const model = new BonusLeaseModel((mockContainer as unknown) as Container);

    const result = await model.create(aNewBonusLease).run();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual(CosmosErrorResponse(queryError));
    }
  });
});

describe("BonusLeaseModel#deleteOneById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should return the document od if the delete complete with success", async () => {
    mockDelete.mockImplementationOnce(() =>
      Promise.resolve({ resource: aBonusLease })
    );

    const model = new BonusLeaseModel((mockContainer as unknown) as Container);

    const result = await model.deleteOneById(aBonusLease.id).run();

    expect(mockItem).toHaveBeenCalledWith(aBonusLease.id);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(aBonusLease.id);
    }
  });

  it("should return the error when delete fails", async () => {
    mockDelete.mockImplementationOnce(() => Promise.reject(queryError));

    const model = new BonusLeaseModel((mockContainer as unknown) as Container);

    const result = await model.deleteOneById(aBonusLease.id).run();

    expect(mockItem).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual(CosmosErrorResponse(queryError));
    }
  });
});
