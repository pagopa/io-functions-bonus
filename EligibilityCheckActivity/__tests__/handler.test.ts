import { right } from "fp-ts/lib/Either";
import { fromEither } from "fp-ts/lib/TaskEither";
import { FiscalCode } from "italia-ts-commons/lib/strings";
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

const mockConsultazioneSogliaIndicatore = jest.fn();
const mockINPSSoapClient = ({
  ConsultazioneSogliaIndicatore: mockConsultazioneSogliaIndicatore
} as unknown) as ISoapClientAsync;
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

describe("EligibilityCheckActivity", () => {
  it("should retrieve a DSU from INPS SOAP web service", async () => {
    mockConsultazioneSogliaIndicatore.mockImplementationOnce(() =>
      fromEither(right(aINPSDsu))
    );
    const handler = getEligibilityCheckActivityHandler(mockINPSSoapClient);

    const response = await handler(context, aFiscalCode);

    expect(mockConsultazioneSogliaIndicatore).toBeCalledWith({
      CodiceFiscale: aFiscalCode,
      CodiceSoglia: "BVAC01",
      FornituraNucleo: SiNoTypeEnum.SI
    });

    const decodedReponse = ActivityResultSuccess.decode(response);

    expect(decodedReponse.isRight()).toBeTruthy();
  });
});
