import * as df from "durable-functions";
import { left, right } from "fp-ts/lib/Either";
import { fromLeft } from "fp-ts/lib/IOEither";
import { none, some } from "fp-ts/lib/Option";
import { taskEither } from "fp-ts/lib/TaskEither";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import {
  context,
  mockGetStatus,
  mockStatusCompleted,
  mockTerminate
} from "../../__mocks__/durable-functions";
import {
  aEligibilityCheckSuccessEligible,
  aEligibilityCheckSuccessEligibleValid
} from "../../__mocks__/mocks";
import { EligibilityCheckModel } from "../../models/eligibility_check";
import { makeStartEligibilityCheckOrchestratorId } from "../../utils/orchestrators";
import { GetEligibilityCheckHandler } from "../handler";

const aFiscalCode = "AAABBB80A01C123D" as FiscalCode;

const mockFind = jest.fn();
const mockEligibilityCheckModel = ({
  find: mockFind
} as unknown) as EligibilityCheckModel;

describe("GetEligibilityCheckHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    // This is the default, happy path behavior
    // I need this because I don't know how many times df.getStatus get called.
    mockGetStatus.mockImplementation(async () => mockStatusCompleted);
  });

  it("should returns a 202 status response if EligibilityCheck is running for the same user", async () => {
    mockGetStatus.mockImplementationOnce(async _ => ({
      customStatus: "RUNNING"
    }));

    const handler = GetEligibilityCheckHandler(mockEligibilityCheckModel);

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseSuccessAccepted");
  });
  it("should returns ResponseSuccessJson if Eligible EligibilityCheck exists", async () => {
    mockGetStatus.mockImplementationOnce(async _ => ({
      customStatus: "COMPLETED",
      runtimeStatus: df.OrchestrationRuntimeStatus.Running
    }));

    mockFind.mockImplementation((_, __) =>
      taskEither.of(some(aEligibilityCheckSuccessEligibleValid))
    );

    const handler = GetEligibilityCheckHandler(mockEligibilityCheckModel);

    const response = await handler(context, aFiscalCode);

    expect(mockFind).toBeCalledWith(aFiscalCode, aFiscalCode);
    expect(mockTerminate).toBeCalledWith(
      makeStartEligibilityCheckOrchestratorId(aFiscalCode),
      "Success"
    );

    expect(response.kind).toBe("IResponseSuccessJson");
  });
  it("should returns ResponseErrorGone if EligibilityCheck exists but it's elapsed", async () => {
    mockGetStatus.mockImplementationOnce(async _ => ({
      customStatus: "COMPLETED"
    }));

    mockFind.mockImplementation((_, __) =>
      taskEither.of(some(aEligibilityCheckSuccessEligible))
    );

    const handler = GetEligibilityCheckHandler(mockEligibilityCheckModel);

    const response = await handler(context, aFiscalCode);

    expect(mockFind).toBeCalledWith(aFiscalCode, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorGone");
  });
  it("should returns ResponseErrorNotFound if EligibilityCheck is missing", async () => {
    mockGetStatus.mockImplementationOnce(async _ => ({
      customStatus: "COMPLETED"
    }));

    mockFind.mockImplementation((_, __) => taskEither.of(none));

    const handler = GetEligibilityCheckHandler(mockEligibilityCheckModel);

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorNotFound");
  });
  it("should returns ResponseErrorInternal if if an error happens quering database", async () => {
    mockGetStatus.mockImplementationOnce(async _ => ({
      customStatus: "COMPLETED"
    }));

    mockFind.mockImplementation((_, __) => fromLeft(new Error("Query Error")));

    const handler = GetEligibilityCheckHandler(mockEligibilityCheckModel);

    const response = await handler(context, aFiscalCode);

    expect(response.kind).toBe("IResponseErrorInternal");
  });
});
