// tslint:disable: no-identical-functions

import { right } from "fp-ts/lib/Either";
import { context } from "../../__mocks__/durable-functions";
import {
  aBonusActivationWithFamilyUID,
  aRetrievedBonusActivation
} from "../../__mocks__/mocks";
import { BonusActivationModel } from "../../models/bonus_activation";
import { BonusLeaseModel } from "../../models/bonus_lease";
import { EligibilityCheckModel } from "../../models/eligibility_check";
import {
  FailedBonusActivationHandler,
  FailedBonusActivationSuccess,
  InvalidInputFailure
} from "../handler";

// mockEligibilityCheckModel
const mockEligibilityCheckDeleteOneById = jest
  .fn()
  .mockImplementation(async () => right(""));
const mockEligibilityCheckModel = ({
  deleteOneById: mockEligibilityCheckDeleteOneById
} as unknown) as EligibilityCheckModel;

// mockBonusActivationModel
const mockBonusActivationCreateOrUpdate = jest
  .fn()
  .mockImplementation(async _ => {
    return right(aRetrievedBonusActivation);
  });
const mockBonusActivationModel = ({
  createOrUpdate: mockBonusActivationCreateOrUpdate
} as unknown) as BonusActivationModel;

// mockBonusLeaseModel
const mockBonusLeaseDeleteOneById = jest.fn().mockImplementation(async _ => {
  return right("");
});
const mockBonusLeaseModel = ({
  deleteOneById: mockBonusLeaseDeleteOneById
} as unknown) as BonusLeaseModel;

describe("FailedBonusActivationHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return a success if everything goes well", async () => {
    const handler = FailedBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel
    );

    const response = await handler(context, {
      bonusActivation: aBonusActivationWithFamilyUID
    });
    expect(
      FailedBonusActivationSuccess.decode(response).isRight()
    ).toBeTruthy();
  });

  it("should fail on invalid input", async () => {
    const handler = FailedBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel
    );

    const response = await handler(context, {
      bonusActivation: { foo: "bar" }
    });
    expect(InvalidInputFailure.decode(response).isRight()).toBeTruthy();
  });
});
