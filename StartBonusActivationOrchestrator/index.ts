import * as df from "durable-functions";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { getStartBonusActivationOrchestratorHandler } from "./handler";

const ADE_HMAC_SECRET = Buffer.from(
  getRequiredStringEnv("ADE_HMAC_SECRET"),
  "base64"
);

const StartBonusActivationOrchestrator = df.orchestrator(
  getStartBonusActivationOrchestratorHandler(ADE_HMAC_SECRET)
);

export default StartBonusActivationOrchestrator;
