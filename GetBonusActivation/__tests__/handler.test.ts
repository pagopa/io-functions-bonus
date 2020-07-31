import { none, some } from "fp-ts/lib/Option";
import { fromLeft, taskEither } from "fp-ts/lib/TaskEither";
import { CosmosErrorResponse } from "io-functions-commons/dist/src/utils/cosmosdb_model";
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
  .mockImplementation(_ => {
    return taskEither.of(some(aRetrievedBonusActivation));
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

  it("should fail if the find query fails", async () => {
    mockBonusActivationFindBonusActivationForUser.mockImplementationOnce(() =>
      fromLeft(CosmosErrorResponse(new Error("any error")))
    );
    const handler = GetBonusActivationHandler(mockBonusActivationModel);

    const result = await handler(context, aFiscalCode, aBonusId);

    expect(result.kind).toBe("IResponseErrorInternal");
    const response = MockResponse();
    result.apply(response);
    expect(response.status).toHaveBeenCalledWith(500);
  });

  it("should notify the user if there is no bonus activation fot the current user", async () => {
    mockBonusActivationFindBonusActivationForUser.mockImplementationOnce(() =>
      taskEither.of(none)
    );
    const handler = GetBonusActivationHandler(mockBonusActivationModel);

    const result = await handler(context, aFiscalCode, aBonusId);

    expect(result.kind).toBe("IResponseErrorNotFound");
    const response = MockResponse();
    result.apply(response);
    expect(response.status).toHaveBeenCalledWith(404);
  });
});
