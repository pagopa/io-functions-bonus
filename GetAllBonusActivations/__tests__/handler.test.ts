import { Container } from "@azure/cosmos";
import { Response } from "express";
import { right } from "fp-ts/lib/Either";
import { taskEither } from "fp-ts/lib/TaskEither";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { response as MockResponse } from "jest-mock-express";
import { mockContainer, mockQuery } from "../../__mocks__/cosmosdb-container";
import { context } from "../../__mocks__/durable-functions";
import { aRetrievedUserBonus } from "../../models/__tests__/user_bonus.test";
import { UserBonus, UserBonusModel } from "../../models/user_bonus";
import { GetAllBonusActivationsHandler } from "../handler";

const mockNext = jest.fn();
const mockAsyncIterator = {
  next: mockNext
};
const mockFindBonusActivations = jest.fn();
const mockUserBonusModel = ({
  findBonusActivations: mockFindBonusActivations
} as unknown) as UserBonusModel;

const aFiscalCode = "AAABBB80A01C123D" as FiscalCode;

describe("GetAllBonusActivationsHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should returns ResponseJsonIterator with the bonus activations", async () => {
    mockNext
      .mockImplementationOnce(() =>
        Promise.resolve({
          done: false,
          value: [
            right({
              bonusId: "AAAAAAAAAAA1",
              fiscalCode: aFiscalCode,
              isApplicant: true
            } as UserBonus),
            right({
              bonusId: "AAAAAAAAAAA2",
              fiscalCode: aFiscalCode,
              isApplicant: false
            } as UserBonus)
          ]
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ done: true, value: undefined })
      );
    mockFindBonusActivations.mockImplementationOnce(() =>
      taskEither.of(mockAsyncIterator)
    );
    const handler = GetAllBonusActivationsHandler(mockUserBonusModel);

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseSuccessJsonIterator");
    const mockResponse = MockResponse();
    await response.apply((mockResponse as unknown) as Response);

    expect(mockNext).toHaveBeenCalledTimes(2);
  });
  it("should returns ResponseJsonIterator with an empty array if no bonus activation was found", async () => {
    mockNext.mockImplementationOnce(() =>
      Promise.resolve({ done: true, value: undefined })
    );
    mockFindBonusActivations.mockImplementationOnce(() =>
      taskEither.of(mockAsyncIterator)
    );
    const handler = GetAllBonusActivationsHandler(mockUserBonusModel);

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseSuccessJsonIterator");
    const mockResponse = MockResponse();
    await response.apply((mockResponse as unknown) as Response);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockResponse.json).toBeCalledWith({ items: [], page_size: 0 });
  });

  it("should raise an expection when response apply is called if getAsyncIterator throws", async () => {
    const expectedError = new Error("Query Iterator exception");
    // tslint:disable-next-line: no-any
    async function* mockAsyncIterable(): AsyncIterable<any> {
      yield { resources: [aRetrievedUserBonus] };
      throw expectedError;
    }
    mockQuery.mockImplementation(() => ({
      getAsyncIterator: mockAsyncIterable
    }));

    const model = new UserBonusModel((mockContainer as unknown) as Container);
    const handler = GetAllBonusActivationsHandler(model);
    const response = await handler(context, aFiscalCode);

    expect.assertions(2);
    expect(response.kind).toBe("IResponseSuccessJsonIterator");
    const mockResponse = MockResponse();
    try {
      await response.apply((mockResponse as unknown) as Response);
    } catch (err) {
      // This exception is catched inside the wrapRequestHandler
      // and a ResponseErrorInternal was returned
      expect(err).toEqual(expectedError);
    }
  });
});
