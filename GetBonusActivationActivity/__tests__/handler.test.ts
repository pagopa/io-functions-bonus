import { left, right } from "fp-ts/lib/Either";
import { fromLeft } from "fp-ts/lib/IOEither";
import { fromEither, none, some } from "fp-ts/lib/Option";
import { taskEither } from "fp-ts/lib/TaskEither";
import { CosmosErrors } from "io-functions-commons/dist/src/utils/cosmosdb_model";
import { context } from "../../__mocks__/durable-functions";
import {
  aBonusId,
  aFiscalCode,
  aRetrievedBonusActivation
} from "../../__mocks__/mocks";
import { BonusActivationStatusEnum } from "../../generated/models/BonusActivationStatus";
import {
  BonusActivationModel,
  RetrievedBonusActivation
} from "../../models/bonus_activation";
import { trackException } from "../../utils/appinsights";
import { Failure, PermanentFailure } from "../../utils/errors";
import { getGetBonusActivationActivityHandler } from "../handler";

jest.mock("../../utils/appinsights");

const aQueryError: CosmosErrors = {
  error: { code: 123, name: "foobar", message: "foobar" },
  kind: "COSMOS_ERROR_RESPONSE"
};

const aRetrievedBonusActivationProcessing: RetrievedBonusActivation = {
  ...aRetrievedBonusActivation,
  status: BonusActivationStatusEnum.PROCESSING
};

// mockBonusActivationModel
const mockBonusActivationFind = jest.fn().mockImplementation(_ => {
  return taskEither.of(some(aRetrievedBonusActivationProcessing));
});
const mockBonusActivationModel = ({
  findBonusActivationForUser: mockBonusActivationFind
} as unknown) as BonusActivationModel;

describe("getGetBonusActivationActivityHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return error on invalid input", async () => {
    const input = "invalid";

    const handler = getGetBonusActivationActivityHandler(
      mockBonusActivationModel
    );

    const result = await handler(context, input);

    expect(Failure.decode(result).isRight()).toBeTruthy();
    expect(trackException).not.toHaveBeenCalled();
  });

  it("should throw an error on query error", async () => {
    mockBonusActivationFind.mockImplementationOnce(() => fromLeft(aQueryError));

    const handler = getGetBonusActivationActivityHandler(
      mockBonusActivationModel
    );

    try {
      await handler(context, {
        applicantFiscalCode: aFiscalCode,
        bonusId: aBonusId
      });
      fail();
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(trackException).toHaveBeenCalled();
    }
  });

  it("should return a permament error on bonus not found", async () => {
    mockBonusActivationFind.mockImplementationOnce(() => taskEither.of(none));

    const handler = getGetBonusActivationActivityHandler(
      mockBonusActivationModel
    );

    const result = await handler(context, {
      applicantFiscalCode: aFiscalCode,
      bonusId: aBonusId
    });

    expect(PermanentFailure.decode(result).isRight()).toBeTruthy();
    expect(trackException).not.toHaveBeenCalled();
  });

  it("should return success if anything is fine", async () => {
    const handler = getGetBonusActivationActivityHandler(
      mockBonusActivationModel
    );

    const result = await handler(context, {
      applicantFiscalCode: aFiscalCode,
      bonusId: aBonusId
    });

    if (result.kind === "SUCCESS") {
      expect(result.bonusActivation).toEqual(
        aRetrievedBonusActivationProcessing
      );
    } else {
      fail("Cannot decode output");
    }
    expect(trackException).not.toHaveBeenCalled();
  });
});
