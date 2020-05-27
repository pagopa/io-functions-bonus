import { AzureFunction, Context } from "@azure/functions";

const NotifyEligibilityCheck: AzureFunction = async (
  context: Context,
  input: unknown
): Promise<unknown> => {
  // TODO: Implementation missing
  context.log.info("NotifyEligibilityCheck|SUCCESS|%s", JSON.stringify(input));
  return Promise.resolve("OK");
};

export default NotifyEligibilityCheck;
