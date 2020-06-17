/**
 * Rules for calculating the amount from the number of family members
 *
 * @see https://www.agenziaentrate.gov.it/portale/web/guest/bonus-vacanze1
 */

export interface IMaxBonusAmount {
  kind: "IMaxBonusAmount";
}

export type MaxBonusAmount = number & IMaxBonusAmount;

export interface IMaxTaxBenefitAmount {
  kind: "IMaxTaxBenefitAmount";
}

export type MaxTaxBenefitAmount = number & IMaxTaxBenefitAmount;

export const OneFamilyMemberBonus = {
  kind: "ONE_FAMILY_MEMBER",
  max_amount: 150 as MaxBonusAmount, // 150 EUR
  max_tax_benefit: 30 as MaxTaxBenefitAmount // 20% of 150 EUR = 30 EUR
} as const;

export const TwoFamilyMembersBonus = {
  kind: "TWO_FAMILY_MEMBERS",
  max_amount: 300 as MaxBonusAmount, // 300 EUR
  max_tax_benefit: 60 as MaxTaxBenefitAmount // 20% of 300 EUR = 60 EUR
} as const;

export const ThreeOrMoreFamilyMembersBonus = {
  kind: "THREE_OR_MORE_FAMILY_MEMBERS",
  max_amount: 500 as MaxBonusAmount, // 500 EUR
  max_tax_benefit: 100 as MaxTaxBenefitAmount // 20% of 500 EUR = 100 EUR
} as const;

export type BonusAmount =
  | typeof OneFamilyMemberBonus
  | typeof TwoFamilyMembersBonus
  | typeof ThreeOrMoreFamilyMembersBonus;
