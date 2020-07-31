import { left } from "fp-ts/lib/Either";
import { fromLeft, taskEither } from "fp-ts/lib/TaskEither";
import { CosmosErrors } from "io-functions-commons/dist/src/utils/cosmosdb_model";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { context } from "../../__mocks__/durable-functions";
import { EligibilityCheckModel } from "../../models/eligibility_check";
import {
  ActivityResultSuccess,
  getDeleteEligibilityCheckActivityHandler
} from "../handler";

const mockDeleteOneById = jest.fn();
const mockEligibilityCheckModel = ({
  deleteOneById: mockDeleteOneById
} as unknown) as EligibilityCheckModel;

const aFiscalCode = "AAABBB80A01C123D" as NonEmptyString;

describe("DeleteEligibilityCheckActivityHandler", () => {
  it("should fail permanently on invalid input", async () => {
    const handler = getDeleteEligibilityCheckActivityHandler(
      mockEligibilityCheckModel
    );
    const result = handler(context, {});
    return expect(result).rejects;
  });

  it("should delete EligibilityCheck and return success ", async () => {
    mockDeleteOneById.mockImplementationOnce(_ => taskEither.of(_));
    const handler = getDeleteEligibilityCheckActivityHandler(
      mockEligibilityCheckModel
    );

    const response = await handler(context, aFiscalCode);

    const decodedReponse = ActivityResultSuccess.decode(response);

    expect(decodedReponse.isRight()).toBeTruthy();
  });
  it("should returns success if delete EligibilityCheck returns Query Error with code 404", async () => {
    const expectedQueryError: CosmosErrors = {
      error: {
        code: 404,
        message: "Document not found",
        name: "Not Found"
      },
      kind: "COSMOS_ERROR_RESPONSE"
    };
    mockDeleteOneById.mockImplementationOnce(_ => fromLeft(expectedQueryError));
    const handler = getDeleteEligibilityCheckActivityHandler(
      mockEligibilityCheckModel
    );

    const response = await handler(context, aFiscalCode);

    const decodedReponse = ActivityResultSuccess.decode(response);

    expect(decodedReponse.isRight()).toBeTruthy();
  });
  it("should throw if delete EligibilityCheck returns an error", async () => {
    const expectedQueryError: CosmosErrors = {
      error: {
        code: 1000,
        message: "Error message",
        name: "Error name"
      },
      kind: "COSMOS_ERROR_RESPONSE"
    };
    mockDeleteOneById.mockImplementationOnce(_ => fromLeft(expectedQueryError));
    const handler = getDeleteEligibilityCheckActivityHandler(
      mockEligibilityCheckModel
    );
    try {
      await handler(context, aFiscalCode);
      // expect that the activity fails
      fail();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
  it("should fail if EligibilityCheck does not exist", async () => {
    const expectedQueryError: CosmosErrors = {
      error: {
        code: 404,
        message: "Document not found",
        name: "Not Found"
      },
      kind: "COSMOS_ERROR_RESPONSE"
    };
    mockDeleteOneById.mockImplementationOnce(_ => fromLeft(expectedQueryError));
    const handler = getDeleteEligibilityCheckActivityHandler(
      mockEligibilityCheckModel
    );

    const result = await handler(context, aFiscalCode);
    expect(result).toMatchObject({
      kind: "SUCCESS"
    });
  });
});
