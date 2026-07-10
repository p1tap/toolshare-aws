import { randomUUID } from "node:crypto";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TOOLS_TABLE } from "../lib/dynamo.mjs";
import { json } from "../lib/response.mjs";

export const handler = async (event) => {
  const chaosRate = parseFloat(process.env.CHAOS_FAIL_RATE ?? "0");
  if (chaosRate > 0 && Math.random() < chaosRate) {
    console.error("chaos knob: injected failure");
    return json(500, { error: "Internal error (chaos injection)" });
  }

  let body;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const { name, type, costPerDay, ownerId } = body;
  if (!name || !costPerDay || !ownerId) {
    return json(400, {
      error: "name, costPerDay, and ownerId are required",
    });
  }
  if (typeof costPerDay !== "number" || costPerDay <= 0) {
    return json(400, { error: "costPerDay must be a positive number" });
  }

  const tool = {
    toolId: randomUUID(),
    name,
    type: type ?? "general",
    costPerDay,
    ownerId,
    status: "active",
    createdAt: new Date().toISOString(),
  };

  try {
    await ddb.send(new PutCommand({ TableName: TOOLS_TABLE, Item: tool }));
    return json(201, tool);
  } catch (err) {
    console.error("createTool failed:", err);
    return json(500, { error: "Failed to create tool" });
  }
};
