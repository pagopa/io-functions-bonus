// tslint:disable: no-identical-functions

import { fromLeft, taskEither } from "fp-ts/lib/TaskEither";
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
  .mockImplementation(() => taskEither.of(""));
const mockEligibilityCheckModel = ({
  deleteOneById: mockEligibilityCheckDeleteOneById
} as unknown) as EligibilityCheckModel;

// mockBonusActivationModel
const mockBonusActivationReplace = jest.fn().mockImplementation(_ => {
  return taskEither.of(aRetrievedBonusActivation);
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
    mockEligibilityCheckDeleteOneById.mockImplementationOnce(() =>
      fromLeft(new Error("any error"))
    );

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
    mockBonusActivationReplace.mockImplementationOnce(() =>
      fromLeft(new Error("any error"))
    );

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
