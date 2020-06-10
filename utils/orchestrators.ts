import { FiscalCode } from "italia-ts-commons/lib/strings";

/**
 * The identifier for StartBonusActivationOrchestrator
 * @param fiscalCode the id of the requesting user
 */
export const makeStartBonusActivationOrchestratorId = (
  fiscalCode: FiscalCode
) => `${fiscalCode}-BV01ACTIVATION`;

/**
 * The identifier for StartEligibilityCheckOrchestrator
 * @param fiscalCode the id of the requesting user
 */
export const makeStartEligibilityCheckOrchestratorId = (
  fiscalCode: FiscalCode
) => `${fiscalCode}-BV01DSU`;
