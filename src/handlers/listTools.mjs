import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TOOLS_TABLE } from "../lib/dynamo.mjs";
import { json } from "../lib/response.mjs";

export const handler = async () => {
  try {
    const result = await ddb.send(new ScanCommand({ TableName: TOOLS_TABLE }));
    return json(200, result.Items ?? []);
  } catch (err) {
    console.error("listTools failed:", err);
    return json(500, { error: "Failed to fetch tools" });
  }
};
