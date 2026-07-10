import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/dynamo.mjs";

const RENTALS_TABLE = process.env.RENTALS_TABLE;

// Saga step 1: mark the rental "reserved" before attempting payment.
export const handler = async (event) => {
  const { rentalId } = event;
  if (!rentalId) {
    throw new Error("rentalId is required");
  }

  await ddb.send(
    new UpdateCommand({
      TableName: RENTALS_TABLE,
      Key: { rentalId },
      UpdateExpression: "SET #s = :reserved",
      ConditionExpression: "#s = :requested",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":reserved": "reserved",
        ":requested": "requested",
      },
    })
  );

  return { rentalId };
};
