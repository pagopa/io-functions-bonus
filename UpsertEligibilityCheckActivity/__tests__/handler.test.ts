import { fromLeft } from "fp-ts/lib/IOEither";
import { taskEither } from "fp-ts/lib/TaskEither";
import { context } from "../../__mocks__/durable-functions";
import {
  aEligibilityCheckSuccessEligibleValid,
  aGenericQueryError
} from "../../__mocks__/mocks";
import { EligibilityCheckModel } from "../../models/eligibility_check";
import {
  ActivityResultFailure,
  ActivityResultSuccess,
  getUpsertEligibilityCheckActivityHandler
} from "../handler";

const mockUpsert = jest.fn();
const mockEligibilityCheckModel = ({
  upsert: mockUpsert
} as unknown) as EligibilityCheckModel;

describe("UpsertEligibilityCheckActivityHandler", () => {
  it("should upsert EligibilityCheck and return success ", async () => {
    mockUpsert.mockImplementationOnce(_ =>
      taskEither.of(aEligibilityCheckSuccessEligibleValid)
    );
    const handler = getUpsertEligibilityCheckActivityHandler(
      mockEligibilityCheckModel
    );

    const response = await handler(
      context,
      aEligibilityCheckSuccessEligibleValid
    );

    expect(mockUpsert).toBeCalledWith({
      ...aEligibilityCheckSuccessEligibleValid,
      kind: "INewEligibilityCheck"
    });

    const decodedReponse = ActivityResultSuccess.decode(response);

    expect(decodedReponse.isRight()).toBeTruthy();
  });

  it("should returns failure if upsert EligibilityCheck returns an error", async () => {
    mockUpsert.mockImplementationOnce(_ => fromLeft(aGenericQueryError));
    const handler = getUpsertEligibilityCheckActivityHandler(
      mockEligibilityCheckModel
    );

    const response = await handler(
      context,
      aEligibilityCheckSuccessEligibleValid
    );

    const decodedReponse = ActivityResultFailure.decode(response);

    expect(decodedReponse.isRight()).toBeTruthy();
  });
});
