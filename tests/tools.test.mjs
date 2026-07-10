import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { handler as createTool } from "../src/handlers/createTool.mjs";
import { handler as getTool } from "../src/handlers/getTool.mjs";
import { handler as listTools } from "../src/handlers/listTools.mjs";

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
});

describe("createTool", () => {
  it("rejects a request missing required fields", async () => {
    const res = await createTool({ body: JSON.stringify({ name: "Drill" }) });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a non-positive costPerDay", async () => {
    const res = await createTool({
      body: JSON.stringify({ name: "Drill", costPerDay: -5, ownerId: "u1" }),
    });
    expect(res.statusCode).toBe(400);
  });

  it("creates a tool with valid input", async () => {
    ddbMock.on(PutCommand).resolves({});
    const res = await createTool({
      body: JSON.stringify({ name: "Drill", costPerDay: 10, ownerId: "u1" }),
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.name).toBe("Drill");
    expect(body.status).toBe("active");
    expect(body.toolId).toBeTruthy();
  });
});

describe("getTool", () => {
  it("returns 404 for a missing tool", async () => {
    ddbMock.on(GetCommand).resolves({});
    const res = await getTool({ pathParameters: { toolId: "missing" } });
    expect(res.statusCode).toBe(404);
  });

  it("returns 200 with the item when found", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { toolId: "abc", name: "Saw" } });
    const res = await getTool({ pathParameters: { toolId: "abc" } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).name).toBe("Saw");
  });
});

describe("listTools", () => {
  it("returns an empty array when the table is empty", async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [] });
    const res = await listTools();
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });
});
