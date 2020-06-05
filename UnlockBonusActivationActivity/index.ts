import { Context } from "@azure/functions";

const UnlockBonusActivation = async (
  context: Context,
  input: unknown
): Promise<unknown> => {
  return true;
};

export default UnlockBonusActivation;
