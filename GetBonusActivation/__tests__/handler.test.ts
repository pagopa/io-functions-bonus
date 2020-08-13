import { left, right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";
import { response as MockResponse } from "jest-mock-express";
import { context } from "../../__mocks__/durable-functions";
import {
  aBonusId,
  aFiscalCode,
  aRetrievedBonusActivation
} from "../../__mocks__/mocks";
import { BonusActivationModel } from "../../models/bonus_activation";
import { GetBonusActivationHandler } from "../handler";

// mockBonusActivationModel
const mockBonusActivationFindBonusActivationForUser = jest
  .fn()
  .mockImplementation(async _ => {
    return right(some(aRetrievedBonusActivation));
  });
const mockBonusActivationModel = ({
  findBonusActivationForUser: mockBonusActivationFindBonusActivationForUser
} as unknown) as BonusActivationModel;

describe("GetBonusActivationHandler", () => {
  it("should return success of everything is fine", async () => {
    const handler = GetBonusActivationHandler(mockBonusActivationModel);

    const result = await handler(context, aFiscalCode, aBonusId);

    expect(result.kind).toBe("IResponseSuccessJson");
    const response = MockResponse();
    result.apply(response);
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("should fail if the find query throws", async () => {
    mockBonusActivationFindBonusActivationForUser.mockImplementationOnce(
      async () => {
        throw new Error("any error");
      }
    );
    const handler = GetBonusActivationHandler(mockBonusActivationModel);

    const result = await handler(context, aFiscalCode, aBonusId);

    expect(result.kind).toBe("IResponseErrorInternal");
    const response = MockResponse();
    result.apply(response);
    expect(response.status).toHaveBeenCalledWith(500);
  });

  it("should fail if the find query fails", async () => {
    mockBonusActivationFindBonusActivationForUser.mockImplementationOnce(
      async () => left(new Error("any error"))
    );
    const handler = GetBonusActivationHandler(mockBonusActivationModel);

    const result = await handler(context, aFiscalCode, aBonusId);

    expect(result.kind).toBe("IResponseErrorInternal");
    const response = MockResponse();
    result.apply(response);
    expect(response.status).toHaveBeenCalledWith(500);
  });

  it("should notify the user if there is no bonus activation fot the current user", async () => {
    mockBonusActivationFindBonusActivationForUser.mockImplementationOnce(
      async () => right(none)
    );
    const handler = GetBonusActivationHandler(mockBonusActivationModel);

    const result = await handler(context, aFiscalCode, aBonusId);

    expect(result.kind).toBe("IResponseErrorNotFound");
    const response = MockResponse();
    result.apply(response);
    expect(response.status).toHaveBeenCalledWith(404);
  });
});
