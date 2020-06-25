// tslint:disable: no-duplicate-string object-literal-sort-keys

import { format } from "date-fns";
import { MessageContent } from "io-functions-commons/dist/generated/definitions/MessageContent";
import { assertNever } from "./types";

export const MESSAGES = {
  EligibilityCheckSuccessEligible: (validBefore: Date) =>
    ({
      subject: "Abbiamo completato le verifiche sul tuo ISEE",
      markdown: `---
it:
    cta_1: 
        text: "Continua"
        action: "ioit://BONUS_CTA_ELIGILITY_START"
en:
    cta_1: 
        text: "Continue"
        action: "ioit://BONUS_CTA_ELIGILITY_START"
---
INPS ha completato le verifiche sull’ultimo ISEE presentato: il tuo nucleo familiare ha diritto al Bonus Vacanze!

Prosegui con la richiesta **entro le ${format(
        validBefore,
        "HH:mm"
      )} del ${format(
        validBefore,
        "dd-MM"
      )}**, per ricominciare da dove hai lasciato. Oltre questa scadenza, dovrai iniziare una nuova domanda.

Clicca il pulsante qui sotto per procedere.
`
    } as MessageContent),

  EligibilityCheckSuccessIneligible: () =>
    ({
      subject: "Abbiamo completato le verifiche sul tuo ISEE",
      markdown: `---
it:
    cta_1: 
        text: "Richiedi nuovo ISEE"
        action: "iohandledlink://https://www.inps.it/nuovoportaleinps/default.aspx?itemdir=50088"
en:
    cta_1: 
        text: "Request a new ISEE"
        action: "iohandledlink://https://www.inps.it/nuovoportaleinps/default.aspx?itemdir=50088"
---
INPS ha completato le verifiche e risulta che l’ultimo ISEE del tuo nucleo familiare supera la soglia di 40.000€.
Di conseguenza non hai diritto al Bonus Vacanze.  

Se la situazione patrimoniale del tuo nucleo familiare è cambiata rispetto all'ultima Dichiarazioni Sostitutiva Unica (DSU) presentata,
puoi presentarne una nuova attraverso i canali previsti da INPS.
`
    } as MessageContent),

  EligibilityCheckFailure: () =>
    ({
      subject: "Abbiamo completato le verifiche sul tuo ISEE",
      markdown: `---
it:
    cta_1: 
        text: "Richiedi ISEE"
        action: "iohandledlink://https://www.inps.it/nuovoportaleinps/default.aspx?itemdir=50088"
en:
    cta_1: 
        text: "Request ISEE"
        action: "iohandledlink://https://www.inps.it/nuovoportaleinps/default.aspx?itemdir=50088"
---
INPS ha completato le verifiche e risulta che il tuo nucleo familiare non ha un ISEE valido.  

E’ necessario presentare una Dichiarazione Sostitutiva Unica (DSU) per il calcolo dell’ISEE, prima di richiedere nuovamente il Bonus Vacanze.

Puoi fare subito una [simulazione online](https://www.inps.it/nuovoportaleinps/default.aspx?itemdir=50088#h3heading4) sul sito dell'INPS 
per verificare la tua idoneità, oppure richiedere l'ISEE sui canali previsti da INPS.

Attenzione:il calcolo effettuato con la simulazione non ha valore certificativo e l’esito non sostituisce in alcun modo l’attestazione ISEE rilasciata dall’Inps
`
    } as MessageContent),

  EligibilityCheckConflict: () =>
    ({
      subject: "Abbiamo completato le verifiche sul tuo ISEE",
      markdown: `INPS ha completato le verifiche sull’ISEE e risulta che qualcuno del tuo nucleo familiare abbia già richiesto il Bonus Vacanze.  

Il Bonus è in fase di attivazione. Ti manderemo un messaggio quando sarà attivo.
`
    } as MessageContent),

  EligibilityCheckSuccessEligibleWithDiscrepancies: (validBefore: Date) =>
    ({
      subject: "Abbiamo completato le verifiche sul tuo ISEE",
      markdown: `---
it:
    cta_1: 
        text: "Continua"
        action: "ioit://BONUS_CTA_ELIGILITY_START"
en:
    cta_1: 
        text: "Continue"
        action: "ioit://BONUS_CTA_ELIGILITY_START"
---
INPS ha completato le verifiche sull’ultimo ISEE presentato: il tuo nucleo familiare ha diritto al Bonus Vacanze!  

Ti avvisiamo, però, che risultano alcune omissioni o difformità nella relativa DSU (Dichiarazione Sostitutiva Unica).

Puoi interrompere la richiesta del Bonus e presentare una nuova DSU completa per aggiornare il tuo ISEE, oppure puoi continuare con la richiesta attuale, 
ma in futuro potrai essere chiamato a fornire la documentazione per provare la completezza e la veridicità dei dati indicati.

Se decidi di proseguire con la richiesta, fallo **entro le ${format(
        validBefore,
        "HH:mm"
      )} del ${format(
        validBefore,
        "dd-MM"
      )}**, per ricominciare da dove hai lasciato. Oltre questa scadenza, dovrai iniziare una nuova domanda.

Clicca il pulsante qui sotto per procedere.
`
    } as MessageContent),

  BonusActivationSuccess: () =>
    ({
      subject: "Il tuo Bonus Vacanze è attivo!",
      markdown: `---
it:
    cta_1: 
        text: "Visualizza il Bonus Vacanze"
        action: "ioit://WALLET_HOME"
en:
    cta_1: 
        text: "Check Bonus Vacanze"
        action: "ioit://WALLET_HOME"
---
Buone notizie! Il Bonus Vacanze per il tuo nucleo familiare è attivo e lo potrai trovare all’interno della sezione pagamenti.  

Ti ricordiamo che chiunque della tua famiglia potrà spenderlo presso le strutture ricettive aderenti dal 1 luglio al 31 dicembre 2020.`
    } as MessageContent),

  BonusActivationFailure: (validBefore: Date) =>
    ({
      subject: "Abbiamo riscontrato dei problemi",
      markdown: `---
it:
    cta_1: 
        text: "Continua"
        action: "ioit://BONUS_CTA_ELIGILITY_START"
en:
    cta_1: 
        text: "Continue"
        action: "ioit://BONUS_CTA_ELIGILITY_START"
---
Si è verificato un errore nel processare la tua richiesta di Bonus.  
Ti chiediamo di confermare di nuovo la tua richiesta **entro le ${format(
        validBefore,
        "HH:mm"
      )} del ${format(
        validBefore,
        "dd-MM"
      )}**, per ricominciare da dove hai lasciato. Oltre questa scadenza, dovrai iniziare una nuova domanda.

Clicca il pulsante qui sotto per procedere.`
    } as MessageContent)
};

export const getMessage = (
  messageType: keyof typeof MESSAGES,
  validBefore: Date
): MessageContent => {
  switch (messageType) {
    case "EligibilityCheckSuccessEligible":
    case "EligibilityCheckSuccessEligibleWithDiscrepancies":
    case "BonusActivationFailure":
      return MESSAGES[messageType](validBefore);
    case "EligibilityCheckSuccessIneligible":
    case "EligibilityCheckFailure":
    case "EligibilityCheckConflict":
    case "BonusActivationSuccess":
      return MESSAGES[messageType]();
    default:
      return assertNever(messageType);
  }
};
