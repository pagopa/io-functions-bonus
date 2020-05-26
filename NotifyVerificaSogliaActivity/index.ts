import { AzureFunction, Context } from "@azure/functions";

const NotifyVerificaSogliaActivity: AzureFunction = async (
  context: Context,
  input: unknown
): Promise<unknown> => {
  // TODO: Implementation missing
  context.log.info("SendVerificaSogliaActivity|SUCCESS|%s", input);
  return Promise.resolve("OK");
};

export default NotifyVerificaSogliaActivity;
