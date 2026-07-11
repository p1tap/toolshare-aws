import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { handler as createTool } from "../src/handlers/createTool.mjs";
import { handler as getTool } from "../src/handlers/getTool.mjs";
import { handler as listTools } from "../src/handlers/listTools.mjs";
import { handler as listMyTools } from "../src/handlers/listMyTools.mjs";

const ddbMock = mockClient(DynamoDBDocumentClient);

// HTTP API JWT-authorizer event shape (what getIdentity reads)
const asUser = (sub, extra = {}) => ({
  requestContext: {
    authorizer: { jwt: { claims: { sub, email: `${sub}@example.com` } } },
  },
  ...extra,
});

beforeEach(() => {
  ddbMock.reset();
});

describe("createTool", () => {
  it("401s without an authenticated identity", async () => {
    const res = await createTool({ body: JSON.stringify({ name: "Drill", costPerDay: 10 }) });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a request missing required fields", async () => {
    const res = await createTool(asUser("u1", { body: JSON.stringify({ name: "Drill" }) }));
    expect(res.statusCode).toBe(400);
  });

  it("rejects a non-positive costPerDay", async () => {
    const res = await createTool(
      asUser("u1", { body: JSON.stringify({ name: "Drill", costPerDay: -5 }) })
    );
    expect(res.statusCode).toBe(400);
  });

  it("creates a tool owned by the JWT subject — body ownerId is ignored", async () => {
    ddbMock.on(PutCommand).resolves({});
    const res = await createTool(
      asUser("u1", { body: JSON.stringify({ name: "Drill", costPerDay: 10, ownerId: "someone-else" }) })
    );
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.ownerId).toBe("u1"); // never the body's claim
    expect(body.status).toBe("active");
    expect(body.toolId).toBeTruthy();
  });
});

describe("listMyTools", () => {
  it("401s without an authenticated identity", async () => {
    const res = await listMyTools({});
    expect(res.statusCode).toBe(401);
  });

  it("queries the owner-index for the JWT subject", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ toolId: "t1", ownerId: "u1" }] });
    const res = await listMyTools(asUser("u1"));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveLength(1);
    const call = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(call.IndexName).toBe("owner-index");
    expect(call.ExpressionAttributeValues[":o"]).toBe("u1");
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
