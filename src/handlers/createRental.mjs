import { randomUUID } from "node:crypto";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { ddb, TOOLS_TABLE } from "../lib/dynamo.mjs";
import { getIdentity } from "../lib/auth.mjs";
import { json } from "../lib/response.mjs";

const sns = new SNSClient({});
const eventBridge = new EventBridgeClient({});

const RENTALS_TABLE = process.env.RENTALS_TABLE;

export const handler = async (event) => {
  const identity = getIdentity(event);
  if (!identity) {
    return json(401, { error: "Unauthorized" });
  }

  let body;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const { toolId, startDate, endDate } = body;
  if (!toolId || !startDate || !endDate) {
    return json(400, { error: "toolId, startDate, and endDate are required" });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start) || isNaN(end)) {
    return json(400, { error: "startDate and endDate must be valid dates" });
  }
  if (end <= start) {
    return json(400, { error: "endDate must be after startDate" });
  }

  try {
    const toolResult = await ddb.send(
      new GetCommand({ TableName: TOOLS_TABLE, Key: { toolId } })
    );
    const tool = toolResult.Item;
    if (!tool || tool.status !== "active") {
      return json(404, { error: "Tool not found or inactive" });
    }
    if (tool.ownerId === identity.userId) {
      return json(400, { error: "Cannot rent your own tool" });
    }

    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const rental = {
      rentalId: randomUUID(),
      toolId,
      // renterId comes from the verified JWT, not the request body —
      // you cannot create a rental as someone else.
      renterId: identity.userId,
      ownerId: tool.ownerId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalPrice: days * tool.costPerDay,
      status: "requested",
      createdAt: new Date().toISOString(),
    };

    await ddb.send(new PutCommand({ TableName: RENTALS_TABLE, Item: rental }));

    // Fire-and-forget: a notification failure should never fail the
    // booking itself. Group by toolId so per-tool events stay ordered.
    if (process.env.RENTAL_EVENTS_TOPIC_ARN) {
      try {
        await sns.send(
          new PublishCommand({
            TopicArn: process.env.RENTAL_EVENTS_TOPIC_ARN,
            Message: JSON.stringify({ type: "RentalCreated", ...rental }),
            MessageGroupId: rental.toolId,
            MessageDeduplicationId: rental.rentalId,
          })
        );
      } catch (err) {
        console.error("rental-events publish failed (non-fatal):", err);
      }
    }

    // Second, decoupled consumer path: EventBridge fans this out to
    // whatever else wants to react (analytics today, more rules later)
    // without coupling createRental to those consumers.
    try {
      await eventBridge.send(
        new PutEventsCommand({
          Entries: [
            {
              Source: "toolshare.rentals",
              DetailType: "RentalCreated",
              Detail: JSON.stringify(rental),
            },
          ],
        })
      );
    } catch (err) {
      console.error("eventbridge publish failed (non-fatal):", err);
    }

    return json(201, rental);
  } catch (err) {
    console.error("createRental failed:", err);
    return json(500, { error: "Failed to create rental" });
  }
};
