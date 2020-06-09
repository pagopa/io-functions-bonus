import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { agent } from "italia-ts-commons";
import { ADEClient } from "../utils/adeClient";
import SendBonusActivationHandler from "./handler";
const httpApiFetch = agent.getHttpFetch(process.env);

const adeClient = ADEClient(
  getRequiredStringEnv("ADE_SERVICE_HOST"),
  httpApiFetch
);

const SendBonusActivationActivity = SendBonusActivationHandler(adeClient);

export default SendBonusActivationActivity;
