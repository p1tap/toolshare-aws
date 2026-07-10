import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TOOLS_TABLE } from "../lib/dynamo.mjs";
import { json } from "../lib/response.mjs";

export const handler = async (event) => {
  const toolId = event.pathParameters?.toolId;
  try {
    const result = await ddb.send(
      new GetCommand({ TableName: TOOLS_TABLE, Key: { toolId } })
    );
    if (!result.Item) {
      return json(404, { error: "Tool not found" });
    }
    return json(200, result.Item);
  } catch (err) {
    console.error("getTool failed:", err);
    return json(500, { error: "Failed to fetch tool" });
  }
};
