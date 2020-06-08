import { BonusVacanzaBase } from "../../generated/ade/BonusVacanzaBase";
import { BonusVacanzaError } from "../../generated/ade/BonusVacanzaError";
import { RestResultRichiesta } from "../../generated/ade/RestResultRichiesta";
import { ADEClient } from "../adeClient";

const aBonusVacanzaBase: BonusVacanzaBase = {
  codiceBuono: "aCodiceBuono",
  codiceFiscaleDichiarante: "aCodiceFiscaleDichiarante",
  dataGenerazione: "aDataGenerazione",
  flagDifformitaIsee: 0,
  nucleoFamiliare: [{ codiceFiscale: "aCodiceFiscale" }]
};

const aRestResultRichiesta: RestResultRichiesta = {
  result: aBonusVacanzaBase
};

const aBonusVacanzaError: BonusVacanzaError = {
  errorCode: "aErrorCode",
  errorMessage: "lorem ipsum"
};

const mockFetch = jest.fn();

describe("ADEClient#richiestaBonus", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should call fetch with correct parameters", async () => {
    mockFetch.mockImplementationOnce(() => {
      return {
        headers: {},
        json: async () => aBonusVacanzaBase,
        status: 200
      };
    });
    const client = ADEClient("", (mockFetch as unknown) as typeof fetch);
    const _ = await client.richiestaBonus({
      bonusVacanzaBase: aBonusVacanzaBase
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/BonusVacanzeWeb/rest/richiestaBonus",
      {
        body: JSON.stringify(aBonusVacanzaBase),
        headers: { "Content-Type": "application/json" },
        method: "post"
      }
    );
  });

  it("should decode success response", async () => {
    mockFetch.mockImplementationOnce(() => {
      return {
        headers: {},
        json: async () => aRestResultRichiesta,
        status: 200
      };
    });
    const client = ADEClient("", (mockFetch as unknown) as typeof fetch);
    const response = await client.richiestaBonus({
      bonusVacanzaBase: aBonusVacanzaBase
    });
    response.fold(
      () => fail("Cannot decode response"),
      result => {
        expect(result.value).toEqual(aRestResultRichiesta);
      }
    );
  });

  it.each`
    name                 | returnStatus
    ${"invalid request"} | ${400}
    ${"data not found"}  | ${404}
    ${"system error"}    | ${500}
  `("should decode $name response", async ({ returnStatus }) => {
    mockFetch.mockImplementationOnce(() => {
      return {
        headers: {},
        json: async () => aBonusVacanzaError,
        status: returnStatus
      };
    });
    const client = ADEClient("", (mockFetch as unknown) as typeof fetch);
    const response = await client.richiestaBonus({
      bonusVacanzaBase: aBonusVacanzaBase
    });
    response.fold(
      () => fail("Cannot decode response"),
      result => {
        expect(result.value).toEqual(aBonusVacanzaError);
      }
    );
  });
});
