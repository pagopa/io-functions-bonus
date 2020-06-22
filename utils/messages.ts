// tslint:disable: no-duplicate-string object-literal-sort-keys

import { format } from "date-fns";
import { MessageContent } from "io-functions-commons/dist/generated/definitions/MessageContent";

export const MESSAGES = {
  EligibilityCheckSuccessEligible: (validBefore: Date) =>
    ({
      subject: "Abbiamo completato le verifiche sul tuo ISEE",
      markdown: `INPS ha completato le verifiche sull’ISEE del tuo nucleo familiare,
e risulta che il tuo nucleo familiare ha diritto al Bonus Vacanze.  

Prosegui con la richiesta **entro le ${format(
        validBefore,
        "HH:mm"
      )} del ${format(
        validBefore,
        "dd-MM"
      )}**, per ricominciare da dove hai lasciato. 
Oltre questa scadenza, dovrai iniziare una nuova domanda.
Clicca il pulsante qui sotto per procedere.
`
    } as MessageContent),

  EligibilityCheckSuccessIneligible: () =>
    ({
      subject: "Abbiamo completato le verifiche sul tuo ISEE",
      markdown: `INPS ha completato le verifiche e risulta che l’ISEE del tuo nucleo familiare supera la soglia di 40.000€.
      Di conseguenza non è possibile accedere al Bonus Vacanze.  

Se qualcosa è cambiato dall’ultimo ISEE creato, puoi richiederne uno nuovo, 
presentando una nuova Dichiarazione Sostituiva Unica (DSU) nei canali previsti da INPS.
`
    } as MessageContent),

  EligibilityCheckFailure: () =>
    ({
      subject: "Abbiamo completato le verifiche sul tuo ISEE",
      markdown: `INPS ha completato le verifiche e risulta che il tuo nucleo familiare non ha un ISEE valido.  

E’ necessario presentare una Dichiarazione Sostitutiva Unica (DSU) per il calcolo dell’ISEE per ottenere il Bonus Vacanze.  
Se vuoi, puoi fare subito una simulazione o la richiesta online sul sito di INPS.
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
      markdown: `INPS ha completato le verifiche sull’ISEE del tuo nucleo familiare, e risulta che il tuo nucleo familiare ha diritto al Bonus Vacanze.  

Ti avvisiamo, però, che INPS ha riscontrato alcune omissioni o difformità nel tuo ISEE, per cui ora puoi continuare con la richiesta del bonus, 
ma potrai essere chiamato in futuro a colmare eventuali lacune nella documentazione presentata.

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

  BonusActivationSuccess: () =>
    ({
      subject: "Il tuo Bonus Vacanze è attivo!",
      markdown: `Buone notizie! Il Bonus Vacanze per il tuo nucleo familiare è attivo e lo potrai trovare all’interno della sezione pagamenti.  

Ti ricordiamo che chiunque della tua famiglia potrà spenderlo presso le strutture ricettive aderenti dal 1 luglio al 31 dicembre 2020.`
    } as MessageContent),

  BonusActivationFailure: () =>
    ({
      subject: "Abbiamo riscontrato dei problemi",
      markdown: `Si è verificato un errore nel processare la tua richiesta di Bonus.  

Clicca il pulsante qui sotto per procedere.`
    } as MessageContent)
};
