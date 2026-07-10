import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/dynamo.mjs";

const RENTALS_TABLE = process.env.RENTALS_TABLE;

// Saga step 3 (happy path): payment succeeded, rental goes active.
export const handler = async (event) => {
  const { rentalId } = event;

  await ddb.send(
    new UpdateCommand({
      TableName: RENTALS_TABLE,
      Key: { rentalId },
      UpdateExpression: "SET #s = :active, confirmedAt = :now",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":active": "active",
        ":now": new Date().toISOString(),
      },
    })
  );

  return { status: "active" };
};
