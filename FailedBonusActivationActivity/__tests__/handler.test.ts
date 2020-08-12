// tslint:disable: no-identical-functions

import { right } from "fp-ts/lib/Either";
import { context } from "../../__mocks__/durable-functions";
import {
  aBonusActivationWithFamilyUID,
  aRetrievedBonusActivation
} from "../../__mocks__/mocks";
import { BonusActivationModel } from "../../models/bonus_activation";
import { EligibilityCheckModel } from "../../models/eligibility_check";
import { TransientFailure } from "../../utils/errors";
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
const mockBonusActivationReplace = jest.fn().mockImplementation(async _ => {
  return right(aRetrievedBonusActivation);
});
const mockBonusActivationModel = ({
  replace: mockBonusActivationReplace
} as unknown) as BonusActivationModel;

describe("FailedBonusActivationHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return a success if everything goes well", async () => {
    const handler = FailedBonusActivationHandler(
      mockBonusActivationModel,
      mockEligibilityCheckModel
    );

    const response = await handler(context, {
      bonusActivation: aBonusActivationWithFamilyUID
    });
    expect(
      FailedBonusActivationSuccess.decode(response).isRight()
    ).toBeTruthy();
  });

  it("should throw a transient error if dsu fails to delete", async () => {
    mockEligibilityCheckDeleteOneById.mockImplementationOnce(async () => {
      throw new Error("any error");
    });

    const handler = FailedBonusActivationHandler(
      mockBonusActivationModel,
      mockEligibilityCheckModel
    );

    try {
      await handler(context, {
        bonusActivation: aBonusActivationWithFamilyUID
      });
      fail();
    } catch (err) {
      expect(TransientFailure.decode(err).isRight()).toBeTruthy();
    }
  });

  it("should throw a transient error if bonus fails to update", async () => {
    mockBonusActivationReplace.mockImplementationOnce(async () => {
      throw new Error("any error");
    });

    const handler = FailedBonusActivationHandler(
      mockBonusActivationModel,
      mockEligibilityCheckModel
    );

    try {
      await handler(context, {
        bonusActivation: aBonusActivationWithFamilyUID
      });
      fail();
    } catch (err) {
      expect(TransientFailure.decode(err).isRight()).toBeTruthy();
    }
  });

  it("should fail on invalid input", async () => {
    const handler = FailedBonusActivationHandler(
      mockBonusActivationModel,
      mockEligibilityCheckModel
    );

    const response = await handler(context, {
      bonusActivation: { foo: "bar" }
    });
    expect(InvalidInputFailure.decode(response).isRight()).toBeTruthy();
  });
});
