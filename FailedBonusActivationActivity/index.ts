import { Context } from "@azure/functions";

const FailerBonusActivation = async (
  context: Context,
  input: unknown
): Promise<unknown> => {
  context.log.info(`FailerBonusActivationActivity|INFO|Input: ${input}`);
  return true;
};

export default FailerBonusActivation;
