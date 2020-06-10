import { Context } from "@azure/functions";
import { rights } from "fp-ts/lib/Array";
import { isLeft } from "fp-ts/lib/Either";
import { fromEither, tryCatch } from "fp-ts/lib/TaskEither";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { ActivityResultSuccess } from "../EligibilityCheckActivity/handler";
import { EsitoEnum } from "../generated/definitions/ConsultazioneSogliaIndicatoreResponse";
import { EligibilityCheck } from "../generated/definitions/EligibilityCheck";
import {
  EligibilityCheckFailure,
  ErrorEnum
} from "../generated/definitions/EligibilityCheckFailure";
import {
  EligibilityCheckSuccessEligible,
  StatusEnum as EligibleStatus
} from "../generated/definitions/EligibilityCheckSuccessEligible";
import {
  EligibilityCheckSuccessIneligible,
  StatusEnum as IneligibleStatus
} from "../generated/definitions/EligibilityCheckSuccessIneligible";
import { FamilyMember } from "../generated/definitions/FamilyMember";
import { FamilyMembers } from "../generated/definitions/FamilyMembers";
import { MaxBonusAmount } from "../generated/definitions/MaxBonusAmount";
import { MaxBonusTaxBenefit } from "../generated/definitions/MaxBonusTaxBenefit";
import { SiNoTypeEnum } from "../generated/definitions/SiNoType";
import {
  ELIGIBILITY_CHECK_MODEL_PK_FIELD,
  EligibilityCheckModel
} from "../models/eligibility_check";
import { toModelEligibilityCheck } from "../utils/conversions";

function calculateMaxBonusAmount(
  numberOfFamilyMembers: number
): MaxBonusAmount {
  return (numberOfFamilyMembers > 2
    ? 500
    : numberOfFamilyMembers === 2
    ? 250
    : numberOfFamilyMembers === 1
    ? 150
    : 0) as MaxBonusAmount;
}

function calculateMaxBonusTaxBenefit(
  maxBonusAmount: MaxBonusAmount
): MaxBonusTaxBenefit {
  return (maxBonusAmount / 5) as MaxBonusTaxBenefit;
}

type ISaveEligibilityCheckHandler = (
  context: Context,
  input: unknown
) => Promise<unknown>;

// tslint:disable-next-line: cognitive-complexity
export function getUpsertEligibilityCheckActivityHandler(
  eligibilityCheckModel: EligibilityCheckModel
): ISaveEligibilityCheckHandler {
  return async (context: Context, input: unknown) => {
    return fromEither(
      ActivityResultSuccess.decode(input).mapLeft(
        _ => new Error(`Error decoding ActivityInput: [${readableReport(_)}]`)
      )
    )
      .map<EligibilityCheck>(({ data, fiscalCode, validBefore }) => {
        const bonusValue = calculateMaxBonusAmount(
          data.DatiIndicatore?.Componenti
            ? data.DatiIndicatore.Componenti.length
            : 0
        );

        const familyMembers: FamilyMembers = data.DatiIndicatore?.Componenti
          ? rights(
              data.DatiIndicatore.Componenti.map(c =>
                FamilyMember.decode({
                  fiscal_code: c.CodiceFiscale,
                  name: c.Nome,
                  surname: c.Cognome
                })
              )
            )
          : [];

        if (data.Esito !== EsitoEnum.OK) {
          return EligibilityCheckFailure.encode({
            error:
              data.Esito === EsitoEnum.DATI_NON_TROVATI
                ? ErrorEnum.DATA_NOT_FOUND
                : data.Esito === EsitoEnum.RICHIESTA_INVALIDA
                ? ErrorEnum.INVALID_REQUEST
                : ErrorEnum.INTERNAL_ERROR,
            error_description:
              data.DescrizioneErrore || "Esito value is not OK",
            id: (fiscalCode as unknown) as NonEmptyString
          });
        }

        if (data.DatiIndicatore?.SottoSoglia === SiNoTypeEnum.SI) {
          return (EligibilityCheckSuccessEligible.encode({
            dsu_created_at: data.DatiIndicatore.DataPresentazioneDSU,
            dsu_protocol_id: (data.DatiIndicatore.ProtocolloDSU ||
              "") as NonEmptyString,
            family_members: familyMembers,
            has_discrepancies:
              data.DatiIndicatore.PresenzaDifformita === SiNoTypeEnum.SI,
            id: (fiscalCode as unknown) as NonEmptyString,
            isee_type: data.DatiIndicatore.TipoIndicatore,
            max_amount: bonusValue,
            max_tax_benefit: calculateMaxBonusTaxBenefit(bonusValue),
            request_id: data.IdRichiesta.toString() as NonEmptyString,
            status: EligibleStatus.ELIGIBLE,
            valid_before: validBefore
          }) as unknown) as EligibilityCheckSuccessEligible;
        } else {
          return EligibilityCheckSuccessIneligible.encode({
            id: (fiscalCode as unknown) as NonEmptyString,
            status: IneligibleStatus.INELIGIBLE
          });
        }
      })
      .chain(_ =>
        tryCatch(
          () => {
            const errorOrData = toModelEligibilityCheck(_);
            if (isLeft(errorOrData)) {
              throw new Error(
                `Eligibility check Conversion error: [${readableReport(
                  errorOrData.value
                )}]`
              );
            }
            return eligibilityCheckModel.createOrUpdate(
              { ...errorOrData.value, kind: "INewEligibilityCheck" },
              ELIGIBILITY_CHECK_MODEL_PK_FIELD
            );
          },
          err => new Error(`Error upserting EligibilityCheck [${err}]`)
        )
      )
      .mapLeft(_ => {
        context.log.error(`UpsertEligibilityCheckActivity|ERROR|${_.message}`);
      })
      .run();
  };
}
