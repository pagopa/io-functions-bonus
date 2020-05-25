import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import * as df from "durable-functions";
import { IHttpResponse } from "durable-functions/lib/src/classes";

const httpStart: AzureFunction = async (
  context: Context,
  req: HttpRequest
): Promise<IHttpResponse> => {
  const instanceId = "FOOBAR";
  const client = df.getClient(context);
  try {
    await client.startNew(req.params.functionName, "FOOBAR", req.body);
    context.log(`Started orchestration with ID = '${instanceId}'.`);
    return client.createCheckStatusResponse(
      context.bindingData.req,
      instanceId
    );
  } catch (e) {
    console.error("ERROR=%s", JSON.stringify(e));
    return client.createCheckStatusResponse(
      context.bindingData.req,
      instanceId
    );
  }
};

export default httpStart;
