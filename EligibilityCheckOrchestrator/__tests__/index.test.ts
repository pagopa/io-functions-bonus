// tslint:disable: object-literal-sort-keys

import { FiscalCode } from "italia-ts-commons/lib/strings";
import { context as contextMock } from "../../__mocks__/durable-functions";
import { ActivityResult as DeleteEligibilityCheckActivityResult } from "../../DeleteEligibilityCheckActivity/handler";
import { ActivityResult } from "../../EligibilityCheckActivity/handler";
import { EsitoEnum } from "../../generated/definitions/ConsultazioneSogliaIndicatoreResponse";
import { SiNoTypeEnum } from "../../generated/definitions/SiNoType";
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

const anInput = "foobar";

const contextMockWithDf = {
  ...contextMock,
  df: {
    callActivity: jest
      .fn()
      // 1 DeleteEligibilityCheckActivity
      .mockReturnValueOnce(deleteEligibilityCheckActivityResult),
    callActivityWithRetry: jest
      .fn()
      // 2 EligibilityCheckActivity
      .mockReturnValueOnce(eligibilityCheckResponse)
      // 3 UpsertEligibilityCheckActivity
      .mockReturnValueOnce("UpsertEligibilityCheckActivity")
      // 5 SendMessageActivity
      .mockReturnValueOnce("SendMessageActivity"),
    getInput: jest.fn(() => anInput),
    setCustomStatus: jest.fn(),
    // 4 CreateTimer
    createTimer: jest.fn().mockReturnValueOnce("CreateTimer")
  }
};

describe("EligibilityCheckOrchestrator", () => {
  it("should send the right message", async () => {
    // tslint:disable-next-line: no-any
    const orchestrator = handler(contextMockWithDf as any);

    // 1 DeleteEligibilityCheckActivity
    const res1 = orchestrator.next();
    expect(res1.value).toEqual({
      kind: "SUCCESS"
    });

    // 2 EligibilityCheckActivity
    const res2 = orchestrator.next(res1.value);
    expect(res2.value).toEqual(eligibilityCheckResponse);

    // 3 UpsertEligibilityCheckActivity
    const res3 = orchestrator.next(res2.value);
    expect(res3.value).toEqual("UpsertEligibilityCheckActivity");

    // 4 CreateTimer
    const res4 = orchestrator.next(res3.value);
    expect(res4.value).toEqual("CreateTimer");

    // 5 SendMessageActivity
    const res5 = orchestrator.next(res4.value);
    expect(res5.value).toEqual("SendMessageActivity");

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
});