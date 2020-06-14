import { isLeft, isRight } from "fp-ts/lib/Either";
import { parseSoapResponse } from "../inpsSoapClient";

const anOKResponse = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
	<s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
		<ConsultazioneSogliaIndicatoreResponse xmlns="http://inps.it/ConsultazioneISEE">
			<ConsultazioneSogliaIndicatoreResult>
				<IdRichiesta>1</IdRichiesta>
				<Esito>OK</Esito>
				<DatiIndicatore TipoIndicatore="ISEE Ordinario" SottoSoglia="SI" ProtocolloDSU="INPS-ISEE-2020-00000025W-00" DataPresentazioneDSU="2020-01-24" PresenzaDifformita="NO">
					<Componente CodiceFiscale="MXABKP55H18F205I" Cognome="MXA" Nome="BKP"/>
					<Componente CodiceFiscale="HHZPLL55T10H501B" Cognome="HHZ" Nome="PLL"/>
				</DatiIndicatore>
			</ConsultazioneSogliaIndicatoreResult>
		</ConsultazioneSogliaIndicatoreResponse>
	</s:Body>
</s:Envelope>`;

const aKOResponse = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
	<s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
		<ConsultazioneSogliaIndicatoreResponse xmlns="http://inps.it/ConsultazioneISEE">
			<ConsultazioneSogliaIndicatoreResult>
				<IdRichiesta>2</IdRichiesta>
				<Esito>OK</Esito>
				<DatiIndicatore TipoIndicatore="ISEE Ordinario" SottoSoglia="NO" ProtocolloDSU="INPS-ISEE-2020-00000095F-00" DataPresentazioneDSU="2020-05-29" PresenzaDifformita="NO">
					<Componente CodiceFiscale="RSSMRA70A01H501S" Cognome="ROSSI" Nome="MARIO"/>
				</DatiIndicatore>
			</ConsultazioneSogliaIndicatoreResult>
		</ConsultazioneSogliaIndicatoreResponse>
	</s:Body>
</s:Envelope>`;

const aTemporaryErrorResponse = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
	<s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
		<ConsultazioneSogliaIndicatoreResponse xmlns="http://inps.it/ConsultazioneISEE">
			<ConsultazioneSogliaIndicatoreResult>
				<IdRichiesta>0</IdRichiesta>
				<Esito>ERRORE_INTERNO</Esito>
				<DescrizioneErrore>ERROR ESC</DescrizioneErrore>
			</ConsultazioneSogliaIndicatoreResult>
		</ConsultazioneSogliaIndicatoreResponse>
	</s:Body>
</s:Envelope>`;

const aPermanentErrorResponse = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
	<s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
		<ConsultazioneSogliaIndicatoreResponse xmlns="http://inps.it/ConsultazioneISEE">
			<ConsultazioneSogliaIndicatoreResult>
				<IdRichiesta>3</IdRichiesta>
				<Esito>DATI_NON_TROVATI</Esito>
			</ConsultazioneSogliaIndicatoreResult>
		</ConsultazioneSogliaIndicatoreResponse>
	</s:Body>
</s:Envelope>`;

const anotherTemporaryErrorResponse = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
	<s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
		<ConsultazioneSogliaIndicatoreResponse xmlns="http://inps.it/ConsultazioneISEE">
			<ConsultazioneSogliaIndicatoreResult>
				<IdRichiesta>0</IdRichiesta>
				<Esito>DATABASE_OFFLINE</Esito>
				<DescrizioneErrore>Applicazione non disponibile</DescrizioneErrore>
			</ConsultazioneSogliaIndicatoreResult>
		</ConsultazioneSogliaIndicatoreResponse>
	</s:Body>
</s:Envelope>`;

describe("InpsSoapClient", () => {
  it("should parse OK response", () => {
    const res = parseSoapResponse(anOKResponse);
    expect(isRight(res)).toBeTruthy();
    if (isRight(res)) {
      expect(res.value.DatiIndicatore?.SottoSoglia).toEqual("SI");
    }
  });
  it("should parse KO response", () => {
    const res = parseSoapResponse(aKOResponse);
    expect(isRight(res)).toBeTruthy();
    if (isRight(res)) {
      expect(res.value.DatiIndicatore?.SottoSoglia).toEqual("NO");
    }
  });

  it("should parse TEMPORARY ERROR response", () => {
    const res = parseSoapResponse(aTemporaryErrorResponse);
    expect(isLeft(res)).toBeTruthy();
    if (isLeft(res)) {
      expect(res.value.message).toContain("ERRORE_INTERNO");
    }
  });

  it("should parse TEMPORARY ERROR response", () => {
    const res = parseSoapResponse(anotherTemporaryErrorResponse);
    expect(isLeft(res)).toBeTruthy();
    if (isLeft(res)) {
      expect(res.value.message).toContain("DATABASE_OFFLINE");
    }
  });

  it("should parse PERMANENT ERROR response", () => {
    const res = parseSoapResponse(aPermanentErrorResponse);
    expect(isRight(res)).toBeTruthy();
    if (isRight(res)) {
      expect(res.value.Esito).toContain("DATI_NON_TROVATI");
    }
  });
});
