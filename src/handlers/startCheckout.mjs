import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { SFNClient, StartSyncExecutionCommand } from "@aws-sdk/client-sfn";
import { ddb } from "../lib/dynamo.mjs";
import { getIdentity } from "../lib/auth.mjs";
import { json } from "../lib/response.mjs";

const sfn = new SFNClient({});
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

  const result = await ddb.send(
    new GetCommand({ TableName: RENTALS_TABLE, Key: { rentalId } })
  );
  const rental = result.Item;
  if (!rental) {
    return json(404, { error: "Rental not found" });
  }
  if (rental.renterId !== identity.userId) {
    return json(403, { error: "Not your rental" });
  }
  if (rental.status !== "requested") {
    return json(409, { error: `Cannot checkout a rental in status "${rental.status}"` });
  }

  const execution = await sfn.send(
    new StartSyncExecutionCommand({
      stateMachineArn: process.env.CHECKOUT_STATE_MACHINE_ARN,
      input: JSON.stringify({ rentalId }),
    })
  );

  if (execution.status === "FAILED") {
    return json(402, {
      error: "Payment failed; reservation released",
      cause: execution.cause,
    });
  }

  const output = JSON.parse(execution.output ?? "{}");
  return json(200, { rentalId, status: output.confirmation?.status ?? "active" });
};
