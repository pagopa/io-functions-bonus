// tslint:disable: no-duplicate-string object-literal-sort-keys

import { MessageContent } from "io-functions-commons/dist/generated/definitions/MessageContent";

export const MESSAGES = {
  EligibilityCheckSuccessEligible: () =>
    ({
      subject: "Abbiamo completato le verifiche sul tuo ISEE",
      markdown: `INPS ha completato le verifiche sull’ISEE del tuo nucleo familiare,
e risulta che il tuo nucleo familiare ha diritto al Bonus Vacanze.  

Clicca il pulsante qui sotto per proseguire con la richiesta del bonus.
`
    } as MessageContent),

  EligibilityCheckSuccessIneligible: () =>
    ({
      subject: "Abbiamo completato le verifiche sul tuo ISEE",
      markdown: `INPS ha completato le verifiche e risulta che l’ISEE del tuo nucleo familiare supera la soglia di 40.000€.
    Di conseguenza non potete accedere al Bonus Vacanze.  

Se non ti risulta corretto, oppure se il tuo reddito familiare è cambiato dall’ultimo ISEE creato,
puoi aggiornarlo effettuando una nuova Dichiarazione Sostituiva Unica (DSU) sul sito di INPS.
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
      markdown: `INPS ha completato le verifiche sull’ISEE del tuo nucleo familiare, e sembra che qualcuno del tuo nucleo familiare abbia già richiesto il Bonus Vacanze.  

Se la richiesta è andata a buon fine, puoi trovare il Bonus Vacanze nella sezione Pagamenti.
`
    } as MessageContent),

  EligibilityCheckSuccessEligibleWithDiscrepancies: () =>
    ({
      subject: "Abbiamo completato le verifiche sul tuo ISEE",
      markdown: `INPS ha completato le verifiche sull’ISEE del tuo nucleo familiare, e risulta che il tuo nucleo familiare ha diritto al Bonus Vacanze.  

Ti avvisiamo, però, che INPS ha riscontrato alcune omissioni o difformità nel tuo ISEE, per cui ora puoi continuare con la richiesta del bonus,
ma potrai essere chiamato in futuro a colmare eventuali lacune nella documeazione presentata.

Clicca il pulsante qui sotto per proseguire con la richiesta del bonus.
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

Dovrai iniziare una nuova domanda.
Clicca il pulsante qui sotto per procedere.`
    } as MessageContent)
};
