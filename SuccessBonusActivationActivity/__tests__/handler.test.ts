// tslint:disable: no-identical-functions

import { right } from "fp-ts/lib/Either";
import { context } from "../../__mocks__/durable-functions";
import {
  aBonusActivationWithFamilyUID,
  aRetrievedBonusActivation,
  aRetrievedUserBonus
} from "../../__mocks__/mocks";
import { BonusActivationModel } from "../../models/bonus_activation";
import { UserBonusModel } from "../../models/user_bonus";
import {
  InvalidInputFailure,
  SuccessBonusActivationHandler,
  SuccessBonusActivationSuccess,
  UnhandledFailure
} from "../handler";

// mockBonusActivationModel
const mockBonusActivationReplace = jest.fn().mockImplementation(async _ => {
  return right(aRetrievedBonusActivation);
});
const mockBonusActivationModel = ({
  replace: mockBonusActivationReplace
} as unknown) as BonusActivationModel;

// mockBonusLeaseModel
const mockUserBonusCreateOrUpdate = jest.fn().mockImplementation(async _ => {
  return right(aRetrievedUserBonus);
});
const mockUserBonusModel = ({
  createOrUpdate: mockUserBonusCreateOrUpdate
} as unknown) as UserBonusModel;

describe("SuccessBonusActivationHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return a success if everything goes well", async () => {
    const handler = SuccessBonusActivationHandler(
      mockBonusActivationModel,
      mockUserBonusModel
    );

    const response = await handler(context, {
      bonusActivation: aBonusActivationWithFamilyUID
    });
    expect(
      SuccessBonusActivationSuccess.decode(response).isRight()
    ).toBeTruthy();
  });

  it("should return an error if the bonus update fails", async () => {
    mockBonusActivationReplace.mockImplementationOnce(async () => {
      throw new Error("any error");
    });
    const handler = SuccessBonusActivationHandler(
      mockBonusActivationModel,
      mockUserBonusModel
    );

    try {
      await handler(context, {
        bonusActivation: aBonusActivationWithFamilyUID
      });
      // expect that the activity fails for a retry
      expect(false).toBeTruthy();
    } catch (error) {
      expect(UnhandledFailure.decode(error).isRight()).toBeTruthy();
    }
  });

  it("should save a userbonus for each family member", async () => {
    const {
      dsuRequest: { familyMembers }
    } = aBonusActivationWithFamilyUID;

    const handler = SuccessBonusActivationHandler(
      mockBonusActivationModel,
      mockUserBonusModel
    );

    const response = await handler(context, {
      bonusActivation: aBonusActivationWithFamilyUID
    });
    expect(mockUserBonusCreateOrUpdate).toHaveBeenCalledTimes(
      familyMembers.length
    );
    expect(
      SuccessBonusActivationSuccess.decode(response).isRight()
    ).toBeTruthy();
  });

  it("should save a userbonus with correct applicant flag", async () => {
    const handler = SuccessBonusActivationHandler(
      mockBonusActivationModel,
      mockUserBonusModel
    );

    const response = await handler(context, {
      bonusActivation: aBonusActivationWithFamilyUID
    });

    const { calls } = mockUserBonusCreateOrUpdate.mock;

    // only the correct applicant id
    calls.forEach(([{ isApplicant, fiscalCode }]) => {
      expect(isApplicant).toBe(
        fiscalCode === aBonusActivationWithFamilyUID.applicantFiscalCode
      );
    });
    // exactly one
    const count = new Set(calls.filter(([{ isApplicant }]) => isApplicant))
      .size;
    expect(count).toBe(1);

    expect(
      SuccessBonusActivationSuccess.decode(response).isRight()
    ).toBeTruthy();
  });

  it("should fail on invalid input", async () => {
    const handler = SuccessBonusActivationHandler(
      mockBonusActivationModel,
      mockUserBonusModel
    );

    const response = await handler(context, {
      bonusActivation: { foo: "bar" }
    });
    expect(InvalidInputFailure.decode(response).isRight()).toBeTruthy();
  });
});
