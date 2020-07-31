import { context } from "../../__mocks__/durable-functions";
import { BonusLeaseModel } from "../../models/bonus_lease";
import { PermanentFailure } from "../../utils/errors";
import {
  getReleaseFamilyLockActivityHandler,
  ReleaseFamilyLockActivitySuccess
} from "../handler";

import { fromLeft, taskEither } from "fp-ts/lib/TaskEither";
import {
  aFamilyUID,
  aGenericQueryError,
  aNotFoundQueryError
} from "../../__mocks__/mocks";
import { trackException } from "../../utils/appinsights";

jest.mock("../../utils/appinsights");

// mockBonusActivationModel
const mockBonusActivationDeleteOneById = jest.fn().mockImplementation(_ => {
  return taskEither.of("");
});
const mockBonusLeaseModel = ({
  deleteOneById: mockBonusActivationDeleteOneById
} as unknown) as BonusLeaseModel;

describe("getReleaseFamilyLockActivityHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return failure on invalid input", async () => {
    const input = "invalid";

    const handler = getReleaseFamilyLockActivityHandler(mockBonusLeaseModel);

    const result = await handler(context, input);

    expect(PermanentFailure.decode(result).isRight()).toBeTruthy();
    expect(trackException).not.toHaveBeenCalled();
  });

  it("should return failure on lease not found", async () => {
    mockBonusActivationDeleteOneById.mockImplementationOnce(() =>
      fromLeft(aNotFoundQueryError)
    );

    const handler = getReleaseFamilyLockActivityHandler(mockBonusLeaseModel);

    const result = await handler(context, {
      familyUID: aFamilyUID
    });

    expect(PermanentFailure.decode(result).isRight()).toBeTruthy();
    expect(trackException).not.toHaveBeenCalled();
  });

  it("should throw on delete error", async () => {
    mockBonusActivationDeleteOneById.mockImplementationOnce(() =>
      fromLeft(aGenericQueryError)
    );

    const handler = getReleaseFamilyLockActivityHandler(mockBonusLeaseModel);

    try {
      await handler(context, {
        familyUID: aFamilyUID
      });
      fail("Should throw");
    } catch (ex) {
      expect(trackException).toHaveBeenCalled();
    }
  });

  it("should return success if everything is fine", async () => {
    const handler = getReleaseFamilyLockActivityHandler(mockBonusLeaseModel);

    const result = await handler(context, {
      familyUID: aFamilyUID
    });

    expect(
      ReleaseFamilyLockActivitySuccess.decode(result).isRight()
    ).toBeTruthy();
    expect(trackException).not.toHaveBeenCalled();
  });
});
