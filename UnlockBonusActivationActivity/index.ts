import { Context } from "@azure/functions";

const UnlockBonusActivationActivity = async (
  context: Context,
  input: unknown
): Promise<unknown> => {
  context.log.info(`UnlockBonusActivationActivity|INFO|Input: ${input}`);
  return true;
};

export default UnlockBonusActivationActivity;
