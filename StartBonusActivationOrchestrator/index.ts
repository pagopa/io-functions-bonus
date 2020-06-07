import * as df from "durable-functions";
import { handler } from "./handler";

const StartBonusActivationOrchestrator = df.orchestrator(handler);

export default StartBonusActivationOrchestrator;
