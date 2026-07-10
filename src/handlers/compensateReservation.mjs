import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/dynamo.mjs";

const RENTALS_TABLE = process.env.RENTALS_TABLE;

// Compensation step: payment failed after the tool was reserved. Release
// the reservation back to "requested" so the renter can retry — the
// saga's whole point is that a mid-flow failure never leaves a tool
// stuck reserved with no charge behind it.
export const handler = async (event) => {
  const rentalId = event.rentalId ?? event.reservation?.rentalId;

  await ddb.send(
    new UpdateCommand({
      TableName: RENTALS_TABLE,
      Key: { rentalId },
      UpdateExpression: "SET #s = :requested, lastFailureAt = :now",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":requested": "requested",
        ":now": new Date().toISOString(),
      },
    })
  );

  return { status: "payment_failed" };
};
