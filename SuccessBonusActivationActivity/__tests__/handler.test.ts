// tslint:disable: no-identical-functions

import { right } from "fp-ts/lib/Either";
import { fromLeft, taskEither } from "fp-ts/lib/TaskEither";
import { context } from "../../__mocks__/durable-functions";
import {
  aBonusActivationWithFamilyUID,
  aGenericQueryError,
  aRetrievedBonusActivation,
  aRetrievedUserBonus
} from "../../__mocks__/mocks";
import { BonusActivationModel } from "../../models/bonus_activation";
import { UserBonusModel } from "../../models/user_bonus";
import { TransientFailure } from "../../utils/errors";
import {
  InvalidInputFailure,
  SuccessBonusActivationHandler,
  SuccessBonusActivationSuccess
} from "../handler";

// mockBonusActivationModel
const mockBonusActivationReplace = jest.fn().mockImplementation(_ => {
  return taskEither.of(aRetrievedBonusActivation);
});
const mockBonusActivationModel = ({
  replace: mockBonusActivationReplace
} as unknown) as BonusActivationModel;

// mockBonusLeaseModel
const mockUserBonusUpsert = jest.fn().mockImplementation(_ => {
  return taskEither.of(aRetrievedUserBonus);
});
const mockUserBonusModel = ({
  upsert: mockUserBonusUpsert
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
    mockBonusActivationReplace.mockImplementationOnce(() =>
      fromLeft(aGenericQueryError)
    );
    const handler = SuccessBonusActivationHandler(
      mockBonusActivationModel,
      mockUserBonusModel
    );

    try {
      await handler(context, {
        bonusActivation: aBonusActivationWithFamilyUID
      });
      // expect that the activity fails for a retry
      fail();
    } catch (error) {
      expect(TransientFailure.decode(error).isRight()).toBeTruthy();
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
    expect(mockUserBonusUpsert).toHaveBeenCalledTimes(familyMembers.length);
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

    const { calls } = mockUserBonusUpsert.mock;

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
