import { QueryError } from "documentdb";
import { left, right } from "fp-ts/lib/Either";
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
    mockDeleteOneById.mockImplementationOnce(async _ => right(_));
    const handler = getDeleteEligibilityCheckActivityHandler(
      mockEligibilityCheckModel
    );

    const response = await handler(context, aFiscalCode);

    const decodedReponse = ActivityResultSuccess.decode(response);

    expect(decodedReponse.isRight()).toBeTruthy();
  });
  it("should returns success if delete EligibilityCheck returns Query Error with code 404", async () => {
    const expectedQueryError: QueryError = {
      body: "Not Found",
      code: 404
    };
    mockDeleteOneById.mockImplementationOnce(async _ =>
      left(expectedQueryError)
    );
    const handler = getDeleteEligibilityCheckActivityHandler(
      mockEligibilityCheckModel
    );

    const response = await handler(context, aFiscalCode);

    const decodedReponse = ActivityResultSuccess.decode(response);

    expect(decodedReponse.isRight()).toBeTruthy();
  });
  it("should throw if delete EligibilityCheck returns an error", async () => {
    const expectedQueryError: QueryError = {
      body: "CODE BODY",
      code: 1000
    };
    mockDeleteOneById.mockImplementationOnce(async _ =>
      left(expectedQueryError)
    );
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
    const expectedQueryError: QueryError = {
      body: "not found",
      code: 404
    };
    mockDeleteOneById.mockImplementationOnce(async _ =>
      left(expectedQueryError)
    );
    const handler = getDeleteEligibilityCheckActivityHandler(
      mockEligibilityCheckModel
    );

    const result = await handler(context, aFiscalCode);
    expect(result).toMatchObject({
      kind: "SUCCESS"
    });
  });
});
