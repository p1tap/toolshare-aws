import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/dynamo.mjs";
import { getIdentity } from "../lib/auth.mjs";
import { json } from "../lib/response.mjs";

const RENTALS_TABLE = process.env.RENTALS_TABLE;

export const handler = async (event) => {
  const identity = getIdentity(event);
  if (!identity) {
    return json(401, { error: "Unauthorized" });
  }

  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: RENTALS_TABLE,
        IndexName: "renter-index",
        KeyConditionExpression: "renterId = :r",
        ExpressionAttributeValues: { ":r": identity.userId },
      })
    );
    return json(200, result.Items ?? []);
  } catch (err) {
    console.error("listMyRentals failed:", err);
    return json(500, { error: "Failed to fetch rentals" });
  }
};
