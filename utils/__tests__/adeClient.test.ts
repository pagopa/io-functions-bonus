// tslint:disable: no-identical-functions no-duplicate-string
import { BonusVacanzaBase } from "../../generated/ade/BonusVacanzaBase";
import { BonusVacanzaError } from "../../generated/ade/BonusVacanzaError";
import { RestResultRichiesta } from "../../generated/ade/RestResultRichiesta";
import {
  ADEClient,
  BonusVacanzaInvalidRequestError,
  BonusVacanzaTransientError
} from "../adeClient";

const aBonusVacanzaBase: BonusVacanzaBase = {
  codiceBuono: "aCodiceBuono",
  codiceFiscaleDichiarante: "aCodiceFiscaleDichiarante",
  dataGenerazione: new Date(),
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

describe("BonusVacanzaTransientError", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const aGenericError = {
    errorCode: "3000",
    errorMessage: "Generic Error"
  };
  const aGenericApplicationError = {
    errorCode: "4000",
    errorMessage: "Generic ApplicationError"
  };

  it.each`
    name                           | returnStatus | payload
    ${"generic error"}             | ${500}       | ${aGenericError}
    ${"generic application error"} | ${400}       | ${aGenericApplicationError}
  `("should decode $name error response", async ({ returnStatus, payload }) => {
    mockFetch.mockImplementationOnce(() => {
      return {
        headers: {},
        json: async () => payload,
        status: returnStatus
      };
    });
    const client = ADEClient("", (mockFetch as unknown) as typeof fetch);
    const response = await client.richiestaBonus({
      bonusVacanzaBase: aBonusVacanzaBase
    });
    response
      .orElse(() => fail("Cannot decode response"))
      .map(result => {
        BonusVacanzaTransientError.decode(result.value)
          .map(value => {
            expect(value).toEqual(payload);
          })
          .orElse(() => fail("Cannot decode payload"));
      });
  });
});

describe("BonusVacanzaInvalidRequestError", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const aBonusVacanzaCodeAlreadyPresentError = {
    errorCode: "1000",
    errorMessage: "Codice presente in banca dati"
  };
  const aBonusVacanzaOtherFamilyMemberError = {
    errorCode: "1005",
    errorMessage:
      "Presente in banca dati una richiesta associata ad un altro componente delnucleo familiare"
  };
  const aBonusVacanzaEmptyFamilyError = {
    errorCode: "900",
    errorMessage: "il nucleo familiare deve contenere almeno un elemento"
  };
  const aBonusVacanzaNoFiscalCodeProvidedProvidedError = {
    errorCode: "907",
    errorMessage: "Codice fiscale richiedente obbligatorio"
  };
  const aBonusVacanzaNoGenerationDateProvidedProvidedError = {
    errorCode: "908",
    errorMessage: "Data Generazione buono, obbligatoria"
  };

  it.each`
    name                                              | returnStatus | payload
    ${"bonus code already present error"}             | ${400}       | ${aBonusVacanzaCodeAlreadyPresentError}
    ${"bonus requested by other family member error"} | ${400}       | ${aBonusVacanzaOtherFamilyMemberError}
    ${"empty family error"}                           | ${400}       | ${aBonusVacanzaEmptyFamilyError}
    ${"no fiscal code provided error"}                | ${400}       | ${aBonusVacanzaNoFiscalCodeProvidedProvidedError}
    ${"no generation date provided error"}            | ${400}       | ${aBonusVacanzaNoGenerationDateProvidedProvidedError}
  `("should decode $name error response", async ({ returnStatus, payload }) => {
    mockFetch.mockImplementationOnce(() => {
      return {
        headers: {},
        json: async () => payload,
        status: returnStatus
      };
    });
    const client = ADEClient("", (mockFetch as unknown) as typeof fetch);
    const response = await client.richiestaBonus({
      bonusVacanzaBase: aBonusVacanzaBase
    });
    response
      .orElse(() => fail("Cannot decode response"))
      .map(result => {
        BonusVacanzaInvalidRequestError.decode(result.value)
          .map(value => {
            expect(value).toEqual(payload);
          })
          .orElse(() => fail("Cannot decode payload"));
      });
  });
});
