// tslint:disable: no-identical-functions

import { right } from "fp-ts/lib/Either";
import { fromEither } from "fp-ts/lib/TaskEither";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { Hour, Millisecond } from "italia-ts-commons/lib/units";
import { context } from "../../__mocks__/durable-functions";
import {
  ConsultazioneSogliaIndicatoreResponse,
  EsitoEnum
} from "../../generated/definitions/ConsultazioneSogliaIndicatoreResponse";
import { SiNoTypeEnum } from "../../generated/definitions/SiNoType";
import { ISoapClientAsync } from "../../utils/inpsSoapClient";
import {
  ActivityResultSuccess,
  getEligibilityCheckActivityHandler
} from "../handler";

const aFiscalCode = "AAABBB80A01C123D" as FiscalCode;

const aINPSDsu: ConsultazioneSogliaIndicatoreResponse = {
  Esito: EsitoEnum.OK,
  IdRichiesta: 1,

  DatiIndicatore: {
    DataPresentazioneDSU: new Date(),
    PresenzaDifformita: SiNoTypeEnum.NO,
    ProtocolloDSU: "PROTOCOLLO-DSU",
    SottoSoglia: SiNoTypeEnum.SI,
    TipoIndicatore: "ISEE Semplice",

    Componenti: [{ CodiceFiscale: aFiscalCode, Cognome: "AAA", Nome: "BBB" }]
  }
};

const mockConsultazioneSogliaIndicatore = jest.fn(() =>
  fromEither(right(aINPSDsu))
);
const mockINPSSoapClient = ({
  ConsultazioneSogliaIndicatore: mockConsultazioneSogliaIndicatore
} as unknown) as ISoapClientAsync;

const aDsuDuration = 24 as Hour;

describe("EligibilityCheckActivity", () => {
  it("should retrieve a DSU from INPS SOAP web service", async () => {
    const handler = getEligibilityCheckActivityHandler(
      mockINPSSoapClient,
      aDsuDuration
    );

    const response = await handler(context, aFiscalCode);

    expect(mockConsultazioneSogliaIndicatore).toBeCalledWith({
      CodiceFiscale: aFiscalCode,
      CodiceSoglia: "BVAC01",
      FornituraNucleo: SiNoTypeEnum.SI
    });

    const decodedReponse = ActivityResultSuccess.decode(response);

    expect(decodedReponse.isRight()).toBeTruthy();
  });

  it("should calculate dsu duration from the provided value", async () => {
    const dsuDuration = 24 as Hour;

    const handler = getEligibilityCheckActivityHandler(
      mockINPSSoapClient,
      dsuDuration
    );

    const testExecutionTime = Date.now();
    const response = await handler(context, aFiscalCode);

    expect(mockConsultazioneSogliaIndicatore).toBeCalledWith({
      CodiceFiscale: aFiscalCode,
      CodiceSoglia: "BVAC01",
      FornituraNucleo: SiNoTypeEnum.SI
    });

    ActivityResultSuccess.decode(response).fold(
      _ => fail("should be a successful output"),
      value => {
        // consider some discrepancy when comparing dates as validBefore is calculated based on a timestamp captured slightly after testExecutionTime
        const timeDelta = 50 as Millisecond;

        // it must be a future date
        expect(value.validBefore.getTime()).toBeGreaterThanOrEqual(
          testExecutionTime
        );
        // it must correctly calculate validBefore
        expect(value.validBefore.getTime()).toBeLessThanOrEqual(
          // tslint:disable-next-line: restrict-plus-operands
          testExecutionTime + dsuDuration * 60 * 60 * 1000 + timeDelta
        );
      }
    );
  });
  it("should calculate dsu duration from the provided value with fractions of hour", async () => {
    const dsuDuration = (1 / 3600) as Hour;

    const handler = getEligibilityCheckActivityHandler(
      mockINPSSoapClient,
      dsuDuration
    );

    const testExecutionTime = Date.now();
    const response = await handler(context, aFiscalCode);

    expect(mockConsultazioneSogliaIndicatore).toBeCalledWith({
      CodiceFiscale: aFiscalCode,
      CodiceSoglia: "BVAC01",
      FornituraNucleo: SiNoTypeEnum.SI
    });

    ActivityResultSuccess.decode(response).fold(
      _ => fail("should be a successful output"),
      value => {
        // consider some discrepancy when comparing dates as validBefore is calculated based on a timestamp captured slightly after testExecutionTime
        const timeDelta = 50 as Millisecond;

        // it must be a future date
        expect(value.validBefore.getTime()).toBeGreaterThanOrEqual(
          testExecutionTime
        );
        // it must correctly calculate validBefore
        expect(value.validBefore.getTime()).toBeLessThanOrEqual(
          // tslint:disable-next-line: restrict-plus-operands
          testExecutionTime + dsuDuration * 60 * 60 * 1000 + timeDelta
        );
      }
    );
  });
});
