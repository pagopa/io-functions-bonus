import { left, right } from "fp-ts/lib/Either";
import { context } from "../../__mocks__/durable-functions";
import { aEligibilityCheckSuccessEligibleValid } from "../../__mocks__/mocks";
import { EligibilityCheckModel } from "../../models/eligibility_check";
import { toApiEligibilityCheck } from "../../utils/conversions";
import {
  ActivityResultFailure,
  ActivityResultSuccess,
  getUpsertEligibilityCheckActivityHandler
} from "../handler";

const mockCreateOrUpdate = jest.fn();
const mockEligibilityCheckModel = ({
  createOrUpdate: mockCreateOrUpdate
} as unknown) as EligibilityCheckModel;

describe("UpsertEligibilityCheckActivityHandler", () => {
  it("should upsert EligibilityCheck and return success ", async () => {
    mockCreateOrUpdate.mockImplementationOnce(async _ =>
      right(aEligibilityCheckSuccessEligibleValid)
    );
    const handler = getUpsertEligibilityCheckActivityHandler(
      mockEligibilityCheckModel
    );
    const eligibilityCheck = toApiEligibilityCheck(
      aEligibilityCheckSuccessEligibleValid
    );
    expect(eligibilityCheck.isRight()).toBeTruthy();

    const response = await handler(context, eligibilityCheck.value);

    expect(mockCreateOrUpdate).toBeCalledWith(
      {
        ...aEligibilityCheckSuccessEligibleValid,
        kind: "INewEligibilityCheck"
      },
      aEligibilityCheckSuccessEligibleValid.id
    );

    const decodedReponse = ActivityResultSuccess.decode(response);

    expect(decodedReponse.isRight()).toBeTruthy();
  });

  it("should returns failure if upsert EligibilityCheck returns an error", async () => {
    mockCreateOrUpdate.mockImplementationOnce(async _ =>
      left(new Error("Query Error"))
    );
    const handler = getUpsertEligibilityCheckActivityHandler(
      mockEligibilityCheckModel
    );
    const eligibilityCheck = toApiEligibilityCheck(
      aEligibilityCheckSuccessEligibleValid
    );
    expect(eligibilityCheck.isRight()).toBeTruthy();

    const response = await handler(context, eligibilityCheck.value);

    const decodedReponse = ActivityResultFailure.decode(response);

    expect(decodedReponse.isRight()).toBeTruthy();
  });
});
