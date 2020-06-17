import { Response } from "express";
import { right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { response as MockResponse } from "jest-mock-express";
import { context } from "../../__mocks__/durable-functions";
import { UserBonus, UserBonusModel } from "../../models/user_bonus";
import { GetAllBonusActivationsHandler } from "../handler";

const mockExecuteNext = jest.fn();
const mockIterator = {
  executeNext: mockExecuteNext
};
const mockUserBonusModel = ({
  findBonusActivations: jest.fn(() => mockIterator)
} as unknown) as UserBonusModel;

const aFiscalCode = "AAABBB80A01C123D" as FiscalCode;

describe("GetAllBonusActivationsHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should returns ResponseJsonIterator with the bonus activations", async () => {
    mockExecuteNext
      .mockImplementationOnce(() =>
        Promise.resolve(
          right(
            some([
              {
                bonusId: "AAAAAAAAAAA1",
                fiscalCode: aFiscalCode,
                isApplicant: true
              } as UserBonus,
              {
                bonusId: "AAAAAAAAAAA2",
                fiscalCode: aFiscalCode,
                isApplicant: false
              } as UserBonus
            ])
          )
        )
      )
      .mockImplementationOnce(() => Promise.resolve(right(none)));
    const handler = GetAllBonusActivationsHandler(mockUserBonusModel);

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseSuccessJsonIterator");
    const mockResponse = MockResponse();
    await response.apply((mockResponse as unknown) as Response);

    expect(mockExecuteNext).toHaveBeenCalledTimes(2);
  });
  it("should returns ResponseJsonIterator with an empty array if no bonus activation was found", async () => {
    mockExecuteNext.mockImplementationOnce(() => Promise.resolve(right(none)));
    const handler = GetAllBonusActivationsHandler(mockUserBonusModel);

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseSuccessJsonIterator");
    const mockResponse = MockResponse();
    await response.apply((mockResponse as unknown) as Response);

    expect(mockExecuteNext).toHaveBeenCalledTimes(1);
    expect(mockResponse.json).toBeCalledWith({ items: [], page_size: 0 });
  });
});
