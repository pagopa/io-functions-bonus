import { isLeft, isRight } from "fp-ts/lib/Either";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import {
  BONUS_ACTIVATION_COLLECTION_NAME,
  BonusActivationModel
} from "../bonus_activation";

import { Container } from "@azure/cosmos";
import { CosmosErrorResponse } from "io-functions-commons/dist/src/utils/cosmosdb_model";
import {
  aBonusActivationWithFamilyUID,
  aNewBonusActivation,
  aRetrievedBonusActivation
} from "../../__mocks__/mocks";

const mockReplace = jest.fn();
const mockFetchAll = jest.fn();
const mockCreate = jest.fn();
const mockRead = jest.fn();

const mockQuery = jest
  .fn()
  .mockImplementation(() => ({ fetchAll: mockFetchAll }));
const mockItem = jest
  .fn()
  .mockImplementation(() => ({ replace: mockReplace, read: mockRead }));
const mockContainer = {
  item: mockItem,
  items: {
    create: mockCreate,
    query: mockQuery
  }
};

describe("BonusActivationModel#create", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should create a new BonusActivation", async () => {
    mockCreate.mockImplementationOnce(() =>
      Promise.resolve({ resource: aRetrievedBonusActivation })
    );
    const model = new BonusActivationModel(
      (mockContainer as unknown) as Container
    );

    const result = await model.create(aNewBonusActivation).run();

    expect(mockContainer.items.create.mock.calls[0][1].kind).toBeUndefined();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(aRetrievedBonusActivation);
    }
  });
  it("should return the error if creation fails", async () => {
    const expectedError = new Error("Query Error");
    mockCreate.mockImplementationOnce(() => Promise.reject(expectedError));

    const model = new BonusActivationModel(
      (mockContainer as unknown) as Container
    );

    const result = await model.create(aNewBonusActivation).run();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual(CosmosErrorResponse(expectedError));
    }
  });
});

describe("BonusActivationModel#find", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should return an existing BonusActivation", async () => {
    mockRead.mockImplementationOnce(() =>
      Promise.resolve({ resource: aRetrievedBonusActivation })
    );

    const model = new BonusActivationModel(
      (mockContainer as unknown) as Container
    );

    const result = await model
      .find(aRetrievedBonusActivation.id, aRetrievedBonusActivation.id)
      .run();

    expect(mockContainer.item).toHaveBeenCalledTimes(1);
    expect(mockContainer.item).toBeCalledWith(
      aRetrievedBonusActivation.id,
      aRetrievedBonusActivation.id
    );
    expect(mockRead).toBeCalledTimes(1);
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedBonusActivation);
    }
  });

  it("should return the error", async () => {
    const expectedError = new Error("Query Error");
    mockRead.mockImplementationOnce(() => Promise.reject(expectedError));

    const model = new BonusActivationModel(
      (mockContainer as unknown) as Container
    );

    const result = await model
      .find(aRetrievedBonusActivation.id, aRetrievedBonusActivation.id)
      .run();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual(CosmosErrorResponse(expectedError));
    }
  });
});

describe("BonusActivationModel#replace", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should return the updated document", async () => {
    mockReplace.mockImplementationOnce(() =>
      Promise.resolve({ resource: aRetrievedBonusActivation })
    );

    const model = new BonusActivationModel(
      (mockContainer as unknown) as Container
    );

    const result = await model.replace(aBonusActivationWithFamilyUID).run();

    expect(mockItem).toHaveBeenCalledWith(aBonusActivationWithFamilyUID.id);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(aBonusActivationWithFamilyUID);
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual(aRetrievedBonusActivation);
    }
  });

  it("should return the error", async () => {
    const expectedError = new Error("Query Error");
    mockReplace.mockImplementationOnce(() => Promise.reject(expectedError));

    const model = new BonusActivationModel(
      (mockContainer as unknown) as Container
    );

    const result = await model.replace(aBonusActivationWithFamilyUID).run();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual(CosmosErrorResponse(expectedError));
    }
  });
});
