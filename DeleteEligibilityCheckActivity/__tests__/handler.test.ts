import { left, right } from "fp-ts/lib/Either";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { context } from "../../__mocks__/durable-functions";
import { EligibilityCheckModel } from "../../models/eligibility_check";
import {
  ActivityResultFailure,
  ActivityResultSuccess,
  getDeleteEligibilityCheckActivityHandler
} from "../handler";

const mockDeleteOneById = jest.fn();
const mockEligibilityCheckModel = ({
  deleteOneById: mockDeleteOneById
} as unknown) as EligibilityCheckModel;

const aFiscalCode = "AAABBB80A01C123D" as NonEmptyString;

describe("DeleteEligibilityCheckActivityHandler", () => {
  it("should delete EligibilityCheck and return success ", async () => {
    mockDeleteOneById.mockImplementationOnce(async _ => right(_));
    const handler = getDeleteEligibilityCheckActivityHandler(
      mockEligibilityCheckModel
    );

    const response = await handler(context, aFiscalCode);

    const decodedReponse = ActivityResultSuccess.decode(response);

    expect(decodedReponse.isRight()).toBeTruthy();
  });
  it("should returns success if delete EligibilityCheck returns code 404", async () => {
    mockDeleteOneById.mockImplementationOnce(async _ => left({ code: 404 }));
    const handler = getDeleteEligibilityCheckActivityHandler(
      mockEligibilityCheckModel
    );

    const response = await handler(context, aFiscalCode);

    const decodedReponse = ActivityResultSuccess.decode(response);

    expect(decodedReponse.isRight()).toBeTruthy();
  });
  it("should returns failure if delete EligibilityCheck returns an error", async () => {
    mockDeleteOneById.mockImplementationOnce(async _ =>
      left(new Error("Query Error"))
    );
    const handler = getDeleteEligibilityCheckActivityHandler(
      mockEligibilityCheckModel
    );

    const response = await handler(context, aFiscalCode);

    const decodedReponse = ActivityResultFailure.decode(response);

    expect(decodedReponse.isRight()).toBeTruthy();
  });
});
