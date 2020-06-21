import * as df from "durable-functions";
import { isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";
import {
  context,
  mockRaiseEvent,
  mockStartNew
} from "../../__mocks__/durable-functions";
import {
  aBonusActivation,
  aBonusActivationWithFamilyUID,
  aBonusId,
  aFiscalCode
} from "../../__mocks__/mocks";
import { BonusActivationStatusEnum } from "../../generated/models/BonusActivationStatus";
import { BonusActivationModel } from "../../models/bonus_activation";
import { ContinueBonusActivationHandler } from "../handler";

describe("ContinueBonusActivation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should not activate bonus if status is not processing", async () => {
    const mockBonusActivationkModel = ({
      findBonusActivationForUser: jest.fn().mockImplementationOnce(async () =>
        right(
          some({
            bonusActivation: {
              ...aBonusActivation,
              status: BonusActivationStatusEnum.ACTIVE
            }
          })
        )
      )
    } as unknown) as BonusActivationModel;

    const response = await ContinueBonusActivationHandler(
      df.getClient(context),
      mockBonusActivationkModel,
      aFiscalCode,
      aBonusId
    ).run();

    expect(isLeft(response)).toBeTruthy();
    if (isLeft(response)) {
      expect(response.value.kind).toEqual("PERMANENT");
    }
  });

  it("should not activate bonus if querying for existing bonus throw", async () => {
    const mockBonusActivationkModel = ({
      findBonusActivationForUser: jest.fn().mockImplementationOnce(async () => {
        throw new Error("foobar");
      })
    } as unknown) as BonusActivationModel;

    const response = await ContinueBonusActivationHandler(
      df.getClient(context),
      mockBonusActivationkModel,
      aFiscalCode,
      aBonusId
    ).run();

    expect(isLeft(response)).toBeTruthy();
    if (isLeft(response)) {
      expect(response.value.kind).toEqual("PERMANENT");
      expect(response.value.reason).toContain("foobar");
    }
  });

  it("should not activate bonus if status is querying for bonus fail", async () => {
    const mockBonusActivationkModel = ({
      findBonusActivationForUser: jest
        .fn()
        .mockImplementationOnce(async () => left({ code: 500, body: "foobar" }))
    } as unknown) as BonusActivationModel;

    const response = await ContinueBonusActivationHandler(
      df.getClient(context),
      mockBonusActivationkModel,
      aFiscalCode,
      aBonusId
    ).run();

    expect(isLeft(response)).toBeTruthy();
    if (isLeft(response)) {
      expect(response.value.kind).toEqual("PERMANENT");
      expect(response.value.reason).toContain("foobar");
    }
  });

  it("should not activate bonus if an existing bonus is not found", async () => {
    const mockBonusActivationkModel = ({
      findBonusActivationForUser: jest
        .fn()
        .mockImplementationOnce(async () => right(none))
    } as unknown) as BonusActivationModel;

    const response = await ContinueBonusActivationHandler(
      df.getClient(context),
      mockBonusActivationkModel,
      aFiscalCode,
      aBonusId
    ).run();

    expect(isLeft(response)).toBeTruthy();
    if (isLeft(response)) {
      expect(response.value.kind).toEqual("PERMANENT");
    }
  });

  it("should return a transient error if raise event throws", async () => {
    mockRaiseEvent.mockImplementationOnce(async () => {
      throw new Error("foobar");
    });
    const mockBonusActivationkModel = ({
      findBonusActivationForUser: jest.fn().mockImplementationOnce(async () =>
        right(
          some({
            bonusActivation: {
              ...aBonusActivationWithFamilyUID,
              status: BonusActivationStatusEnum.PROCESSING
            }
          })
        )
      )
    } as unknown) as BonusActivationModel;

    const response = await ContinueBonusActivationHandler(
      df.getClient(context),
      mockBonusActivationkModel,
      aFiscalCode,
      aBonusId
    ).run();

    expect(isLeft(response)).toBeTruthy();
    if (isLeft(response)) {
      expect(response.value.kind).toEqual("TRANSIENT");
      expect(response.value.reason).toContain("foobar");
    }
  });

  it("should activate bonus if status is processing", async () => {
    const mockBonusActivationkModel = ({
      findBonusActivationForUser: jest.fn().mockImplementationOnce(async () =>
        right(
          some({
            bonusActivation: {
              ...aBonusActivationWithFamilyUID,
              status: BonusActivationStatusEnum.PROCESSING
            }
          })
        )
      )
    } as unknown) as BonusActivationModel;

    const response = await ContinueBonusActivationHandler(
      df.getClient(context),
      mockBonusActivationkModel,
      aFiscalCode,
      aBonusId
    ).run();

    expect(isRight(response)).toBeTruthy();
    if (isRight(response)) {
      expect(response.value).toEqual(true);
    }
  });
});
