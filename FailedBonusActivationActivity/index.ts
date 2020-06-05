import { Context } from "@azure/functions";

const FailerBonusActivation = async (
  context: Context,
  input: unknown
): Promise<unknown> => {
  return true;
};

export default FailerBonusActivation;
