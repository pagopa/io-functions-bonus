import { QueueService } from "azure-storage";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

// Since this service is used from the StartBonusActivation controller
// we don't setup retries here (fail fast approach)

export const queueService = new QueueService(
  getRequiredStringEnv("BONUS_STORAGE_CONNECTION_STRING")
);

export const BONUS_ACTIVATIONS_QUEUE_NAME = "bonusactivations" as NonEmptyString;
