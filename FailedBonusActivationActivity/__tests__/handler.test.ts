// tslint:disable: no-identical-functions

import { left, right } from "fp-ts/lib/Either";
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
  InvalidInputFailure,
  UnhandledFailure
} from "../handler";

// mockEligibilityCheckModel
const mockEligibilityCheckDeleteOneById = jest
  .fn()
  .mockImplementation(async () => right(""));
const mockEligibilityCheckModel = ({
  deleteOneById: mockEligibilityCheckDeleteOneById
} as unknown) as EligibilityCheckModel;

// mockBonusActivationModel
const mockBonusActivationReplace = jest.fn().mockImplementation(async _ => {
  return right(aRetrievedBonusActivation);
});
const mockBonusActivationModel = ({
  replace: mockBonusActivationReplace
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

  it("should return a success if dsu fails to delete", async () => {
    mockEligibilityCheckDeleteOneById.mockImplementationOnce(async () => {
      throw new Error("any error");
    });

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

  it("should return a success if bonus fails to update", async () => {
    mockBonusActivationReplace.mockImplementationOnce(async () => {
      throw new Error("any error");
    });

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

  it("should fail if lock fails to release", async () => {
    mockBonusLeaseDeleteOneById.mockImplementationOnce(async () => {
      throw new Error("any error");
    });

    const handler = FailedBonusActivationHandler(
      mockBonusActivationModel,
      mockBonusLeaseModel,
      mockEligibilityCheckModel
    );

    try {
      await handler(context, {
        bonusActivation: aBonusActivationWithFamilyUID
      });
      // expect that the activity fails
      expect(false).toBeTruthy();
    } catch (error) {
      expect(UnhandledFailure.decode(error).isRight()).toBeTruthy();
    }
  });
});
