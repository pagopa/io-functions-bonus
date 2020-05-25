/*
 * This function is not intended to be invoked directly. Instead it will be
 * triggered by an orchestrator function.
 *
 * Before running this sample, please:
 * - create a Durable orchestration function
 * - create a Durable HTTP starter function
 * - run 'yarn add durable-functions' from the wwwroot folder of your
 *   function app in Kudu
 */

import nodeFetch from "node-fetch";

import { AzureFunction, Context } from "@azure/functions";

const activityFunction: AzureFunction = async (
  context: Context
): Promise<string> => {
  const res = await nodeFetch(
    "https://webhook.site/2d3e1c11-14e6-47e3-8acf-4e0e260ddd55"
  );
  if (res.status !== 200) {
    throw new Error(`STATUS=${res.status}`);
  }
  return res.json();
};

export default activityFunction;
