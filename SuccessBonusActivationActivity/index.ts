import { Context } from "@azure/functions";

const SuccessBonusActivationActivity = async (
  context: Context,
  input: unknown
): Promise<unknown> => {
  context.log.info(`SuccessBonusActivationActivity|INFO|Input: ${input}`);
  return true;
};

export default SuccessBonusActivationActivity;
