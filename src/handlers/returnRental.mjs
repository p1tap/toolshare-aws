import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/dynamo.mjs";
import { getIdentity } from "../lib/auth.mjs";
import { json } from "../lib/response.mjs";

const RENTALS_TABLE = process.env.RENTALS_TABLE;

export const handler = async (event) => {
  const identity = getIdentity(event);
  if (!identity) {
    return json(401, { error: "Unauthorized" });
  }

  const rentalId = event.pathParameters?.rentalId;
  if (!rentalId) {
    return json(400, { error: "rentalId is required" });
  }

  try {
    const result = await ddb.send(
      new GetCommand({ TableName: RENTALS_TABLE, Key: { rentalId } })
    );
    const rental = result.Item;
    if (!rental) {
      return json(404, { error: "Rental not found" });
    }
    // Only the renter or the tool's owner may close a rental; admins pass too.
    const allowed =
      rental.renterId === identity.userId ||
      rental.ownerId === identity.userId ||
      identity.groups.includes("admin");
    if (!allowed) {
      return json(403, { error: "Not your rental" });
    }
    if (rental.status !== "active") {
      return json(409, { error: `Cannot return a rental in status "${rental.status}"` });
    }

    const updated = await ddb.send(
      new UpdateCommand({
        TableName: RENTALS_TABLE,
        Key: { rentalId },
        UpdateExpression: "SET #s = :returned, returnedAt = :now",
        ConditionExpression: "#s = :active",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":returned": "returned",
          ":active": "active",
          ":now": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
    );
    return json(200, updated.Attributes);
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return json(409, { error: "Rental is no longer active" });
    }
    console.error("returnRental failed:", err);
    return json(500, { error: "Failed to return rental" });
  }
};
