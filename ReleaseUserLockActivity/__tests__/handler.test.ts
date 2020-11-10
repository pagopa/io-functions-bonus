import { fromLeft } from "fp-ts/lib/IOEither";
import { taskEither } from "fp-ts/lib/TaskEither";
import { context } from "../../__mocks__/durable-functions";
import {
  aFiscalCode,
  aGenericQueryError,
  aNotFoundQueryError
} from "../../__mocks__/mocks";
import { BonusProcessingModel } from "../../models/bonus_processing";
import { trackException } from "../../utils/appinsights";
import { PermanentFailure } from "../../utils/errors";
import {
  getReleaseUserLockActivityHandler,
  ReleaseUserLockActivitySuccess
} from "../handler";

jest.mock("../../utils/appinsights");

// mockBonusProcessingModel
const mockBonusProcessingDeleteOneById = jest.fn().mockImplementation(_ => {
  return taskEither.of("");
});
const mockBonusProcessingModel = ({
  deleteOneById: mockBonusProcessingDeleteOneById
} as unknown) as BonusProcessingModel;

describe("getReleaseUserLockActivityHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return failure on invalid input", async () => {
    const input = "invalid";

    const handler = getReleaseUserLockActivityHandler(mockBonusProcessingModel);

    const result = await handler(context, input);

    expect(PermanentFailure.decode(result).isRight()).toBeTruthy();
    expect(trackException).not.toHaveBeenCalled();
  });

  it("should return failure on lease not found", async () => {
    mockBonusProcessingDeleteOneById.mockImplementationOnce(() =>
      fromLeft(aNotFoundQueryError)
    );

    const handler = getReleaseUserLockActivityHandler(mockBonusProcessingModel);

    const result = await handler(context, {
      id: aFiscalCode
    });

    expect(PermanentFailure.decode(result).isRight()).toBeTruthy();
    expect(trackException).not.toHaveBeenCalled();
  });

  it("should throw on delete error", async () => {
    mockBonusProcessingDeleteOneById.mockImplementationOnce(() =>
      fromLeft(aGenericQueryError)
    );

    const handler = getReleaseUserLockActivityHandler(mockBonusProcessingModel);

    try {
      await handler(context, {
        id: aFiscalCode
      });
      fail("Should throw");
    } catch (ex) {
      expect(trackException).toHaveBeenCalled();
    }
  });

  it("should return success if everything is fine", async () => {
    const handler = getReleaseUserLockActivityHandler(mockBonusProcessingModel);

    const result = await handler(context, {
      id: aFiscalCode
    });

    expect(
      ReleaseUserLockActivitySuccess.decode(result).isRight()
    ).toBeTruthy();
    expect(trackException).not.toHaveBeenCalled();
  });
});
