// tslint:disable: object-literal-sort-keys

import { FiscalCode } from "italia-ts-commons/lib/strings";
import { context as contextMock } from "../../__mocks__/durable-functions";
import { aFiscalCode } from "../../__mocks__/mocks";
import { ActivityResult as DeleteEligibilityCheckActivityResult } from "../../DeleteEligibilityCheckActivity/handler";
import { ActivityResult } from "../../EligibilityCheckActivity/handler";
import { EsitoEnum } from "../../generated/definitions/ConsultazioneSogliaIndicatoreResponse";
import { SiNoTypeEnum } from "../../generated/definitions/SiNoType";
import { StatusEnum } from "../../generated/models/EligibilityCheckSuccessConflict";
import { toApiEligibilityCheckFromDSU } from "../../utils/conversions";
import { MESSAGES } from "../../utils/messages";
import { handler } from "../index";

const deleteEligibilityCheckActivityResult: DeleteEligibilityCheckActivityResult = {
  kind: "SUCCESS"
};

const eligibilityCheckResponse: ActivityResult = {
  data: {
    Esito: "OK" as EsitoEnum,
    IdRichiesta: 123,
    DatiIndicatore: {
      DataPresentazioneDSU: new Date(),
      PresenzaDifformita: "SI" as SiNoTypeEnum,
      ProtocolloDSU: "123",
      SottoSoglia: "SI" as SiNoTypeEnum,
      TipoIndicatore: "ISEE",
      Componenti: [
        {
          CodiceFiscale: "SPNDNL81R14C523K",
          Cognome: "Rossi",
          Nome: "Mario"
        }
      ]
    }
  },
  fiscalCode: "SPNDNL81R14C523K" as FiscalCode,
  kind: "SUCCESS",
  validBefore: new Date()
};

const eligibilityCheck = toApiEligibilityCheckFromDSU(
  eligibilityCheckResponse.data,
  eligibilityCheckResponse.fiscalCode,
  eligibilityCheckResponse.validBefore
);

const anInput = aFiscalCode;

const mockCallActivityWithRetry = jest.fn();

const contextMockWithDf = {
  ...contextMock,
  df: {
    callActivity: jest.fn(),
    callActivityWithRetry: mockCallActivityWithRetry,
    getInput: jest.fn(() => anInput),
    setCustomStatus: jest.fn(),
    // 4 CreateTimer
    createTimer: jest.fn().mockReturnValueOnce("CreateTimer")
  }
};

const aContextMockWithActiveBonus = {
  ...contextMock,
  df: {
    callActivity: jest.fn(),
    callActivityWithRetry: jest
      .fn()
      // 1 DeleteEligibilityCheckActivity
      .mockReturnValueOnce(deleteEligibilityCheckActivityResult)
      // 2 EligibilityCheckActivity
      .mockReturnValueOnce(eligibilityCheckResponse)
      // 3 ValidateEligibilityCheckActivity
      .mockReturnValueOnce({
        ...eligibilityCheck.value,
        status: StatusEnum.CONFLICT
      })
      // 4 UpsertEligibilityCheckActivity
      .mockReturnValueOnce("UpsertEligibilityCheckActivity")
      // 5 CheckBonusActiveActivity
      .mockReturnValueOnce(true)
      // 6 SendMessageActivity
      .mockReturnValueOnce("SendMessageActivity"),
    getInput: jest.fn(() => anInput),
    setCustomStatus: jest.fn(),
    // 4 CreateTimer
    createTimer: jest.fn().mockReturnValueOnce("CreateTimer")
  }
};

const aContextMockWithProcessingBonus = {
  ...contextMock,
  df: {
    callActivity: jest.fn(),
    callActivityWithRetry: jest
      .fn()
      // 1 DeleteEligibilityCheckActivity
      .mockReturnValueOnce(deleteEligibilityCheckActivityResult)
      // 2 EligibilityCheckActivity
      .mockReturnValueOnce(eligibilityCheckResponse)
      // 3 ValidateEligibilityCheckActivity
      .mockReturnValueOnce({
        ...eligibilityCheck.value,
        status: StatusEnum.CONFLICT
      })
      // 4 UpsertEligibilityCheckActivity
      .mockReturnValueOnce("UpsertEligibilityCheckActivity")
      // 5 CheckBonusActiveActivity
      .mockReturnValueOnce(false)
      // 6 SendMessageActivity
      .mockReturnValueOnce("SendMessageActivity"),
    getInput: jest.fn(() => anInput),
    setCustomStatus: jest.fn(),
    // 4 CreateTimer
    createTimer: jest.fn().mockReturnValueOnce("CreateTimer")
  }
};

describe("EligibilityCheckOrchestrator", () => {
  it("should send the right message", async () => {
    mockCallActivityWithRetry
      // 1 DeleteEligibilityCheckActivity
      .mockReturnValueOnce(deleteEligibilityCheckActivityResult)
      // 2 EligibilityCheckActivity
      .mockReturnValueOnce(eligibilityCheckResponse)
      // 3 ValidateEligibilityCheckActivity
      .mockReturnValueOnce(eligibilityCheck.value)
      // 4 UpsertEligibilityCheckActivity
      .mockReturnValueOnce("UpsertEligibilityCheckActivity")
      // 5 SendMessageActivity
      .mockReturnValueOnce("SendMessageActivity");
    // tslint:disable-next-line: no-any no-useless-cast
    const orchestrator = handler(contextMockWithDf as any);

    // 1 DeleteEligibilityCheckActivity
    const res1 = orchestrator.next();
    expect(res1.value).toEqual({
      kind: "SUCCESS"
    });

    // 2 EligibilityCheckActivity
    const res2 = orchestrator.next(res1.value);
    expect(res2.value).toEqual(eligibilityCheckResponse);

    // 3 ValidateEligibilityCheckActivity
    const res3 = orchestrator.next(res2.value);
    expect(res3.value).toEqual(eligibilityCheck.value);

    // 4 UpsertEligibilityCheckActivity
    const res4 = orchestrator.next(res3.value);
    expect(res4.value).toEqual("UpsertEligibilityCheckActivity");

    // 5 CreateTimer
    const res5 = orchestrator.next(res4.value);
    expect(res5.value).toEqual("CreateTimer");

    // 6 SendMessageActivity
    const res6 = orchestrator.next(res5.value);
    expect(res6.value).toEqual("SendMessageActivity");

    expect(contextMockWithDf.df.createTimer).toHaveBeenCalledTimes(1);
    expect(contextMockWithDf.df.setCustomStatus).toHaveBeenNthCalledWith(
      1,
      "RUNNING"
    );
    expect(contextMockWithDf.df.setCustomStatus).toHaveBeenNthCalledWith(
      2,
      "COMPLETED"
    );
  });

  it("should send the right message on EligibilityCheckConflict when a Bonus Processing is running", async () => {
    // tslint:disable-next-line: no-any no-useless-cast
    const orchestrator = handler(aContextMockWithActiveBonus as any);

    // 1 DeleteEligibilityCheckActivity
    const res1 = orchestrator.next();
    expect(res1.value).toEqual({
      kind: "SUCCESS"
    });

    // 2 EligibilityCheckActivity
    const res2 = orchestrator.next(res1.value);
    expect(res2.value).toEqual(eligibilityCheckResponse);

    // 3 ValidateEligibilityCheckActivity
    const res3 = orchestrator.next(res2.value);
    expect(res3.value).toEqual({
      ...eligibilityCheck.value,
      status: StatusEnum.CONFLICT
    });

    // 4 UpsertEligibilityCheckActivity
    const res4 = orchestrator.next(res3.value);
    expect(res4.value).toEqual("UpsertEligibilityCheckActivity");

    // 5 CreateTimer
    const res5 = orchestrator.next(res4.value);
    expect(res5.value).toEqual("CreateTimer");

    // 6 CheckBonusActiveActivity
    const res6 = orchestrator.next(res5.value);
    expect(res6.value).toEqual(true);

    // 7 SendMessageActivity
    const res7 = orchestrator.next(res6.value);
    expect(res7.value).toEqual("SendMessageActivity");

    expect(
      aContextMockWithActiveBonus.df.callActivityWithRetry.mock.calls[5][2]
        .content
    ).toEqual(MESSAGES.EligibilityCheckConflictWithBonusActivated());

    expect(aContextMockWithActiveBonus.df.createTimer).toHaveBeenCalledTimes(1);
    expect(
      aContextMockWithActiveBonus.df.setCustomStatus
    ).toHaveBeenNthCalledWith(1, "RUNNING");
    expect(
      aContextMockWithActiveBonus.df.setCustomStatus
    ).toHaveBeenNthCalledWith(2, "COMPLETED");
  });

  it("should send the right message on EligibilityCheckConflict when a Bonus Processing is not running", async () => {
    const orchestrator = handler(
      // tslint:disable-next-line: no-any no-useless-cast
      aContextMockWithProcessingBonus as any
    );

    // 1 DeleteEligibilityCheckActivity
    const res1 = orchestrator.next();
    expect(res1.value).toEqual({
      kind: "SUCCESS"
    });

    // 2 EligibilityCheckActivity
    const res2 = orchestrator.next(res1.value);
    expect(res2.value).toEqual(eligibilityCheckResponse);

    // 3 ValidateEligibilityCheckActivity
    const res3 = orchestrator.next(res2.value);
    expect(res3.value).toEqual({
      ...eligibilityCheck.value,
      status: StatusEnum.CONFLICT
    });

    // 4 UpsertEligibilityCheckActivity
    const res4 = orchestrator.next(res3.value);
    expect(res4.value).toEqual("UpsertEligibilityCheckActivity");

    // 5 CreateTimer
    const res5 = orchestrator.next(res4.value);
    expect(res5.value).toEqual("CreateTimer");

    // 6 CheckBonusActiveActivity
    const res6 = orchestrator.next(res5.value);
    expect(res6.value).toEqual(false);

    // 7 SendMessageActivity
    const res7 = orchestrator.next(res6.value);
    expect(res7.value).toEqual("SendMessageActivity");

    expect(
      aContextMockWithProcessingBonus.df.callActivityWithRetry.mock.calls[5][2]
        .content
    ).toEqual(MESSAGES.EligibilityCheckConflict());

    expect(
      aContextMockWithProcessingBonus.df.createTimer
    ).toHaveBeenCalledTimes(1);
    expect(
      aContextMockWithProcessingBonus.df.setCustomStatus
    ).toHaveBeenNthCalledWith(1, "RUNNING");
    expect(
      aContextMockWithProcessingBonus.df.setCustomStatus
    ).toHaveBeenNthCalledWith(2, "COMPLETED");
  });
});
