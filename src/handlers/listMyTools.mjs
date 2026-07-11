import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TOOLS_TABLE } from "../lib/dynamo.mjs";
import { getIdentity } from "../lib/auth.mjs";
import { json } from "../lib/response.mjs";

export const handler = async (event) => {
  const identity = getIdentity(event);
  if (!identity) {
    return json(401, { error: "Unauthorized" });
  }

  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TOOLS_TABLE,
        IndexName: "owner-index",
        KeyConditionExpression: "ownerId = :o",
        ExpressionAttributeValues: { ":o": identity.userId },
      })
    );
    return json(200, result.Items ?? []);
  } catch (err) {
    console.error("listMyTools failed:", err);
    return json(500, { error: "Failed to fetch tools" });
  }
};
