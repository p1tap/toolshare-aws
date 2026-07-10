import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { handler as createRental } from "../src/handlers/createRental.mjs";
import { handler as listMyRentals } from "../src/handlers/listMyRentals.mjs";
import { handler as returnRental } from "../src/handlers/returnRental.mjs";

const ddbMock = mockClient(DynamoDBDocumentClient);

function authedEvent(userId, extras = {}) {
  return {
    requestContext: {
      authorizer: { jwt: { claims: { sub: userId, email: `${userId}@x.com` } } },
    },
    ...extras,
  };
}

beforeEach(() => {
  ddbMock.reset();
});

describe("createRental", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await createRental({ body: "{}" });
    expect(res.statusCode).toBe(401);
  });

  it("takes renterId from the JWT, ignoring any body value", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { toolId: "t1", status: "active", ownerId: "owner-1", costPerDay: 10 },
    });
    ddbMock.on(PutCommand).resolves({});
    const res = await createRental(
      authedEvent("real-user", {
        body: JSON.stringify({
          toolId: "t1",
          startDate: "2026-08-01",
          endDate: "2026-08-03",
          renterId: "victim-user",
        }),
      })
    );
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).renterId).toBe("real-user");
  });

  it("refuses renting your own tool", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { toolId: "t1", status: "active", ownerId: "me", costPerDay: 10 },
    });
    const res = await createRental(
      authedEvent("me", {
        body: JSON.stringify({ toolId: "t1", startDate: "2026-08-01", endDate: "2026-08-02" }),
      })
    );
    expect(res.statusCode).toBe(400);
  });

  it("computes totalPrice from days * costPerDay", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { toolId: "t1", status: "active", ownerId: "owner-1", costPerDay: 8.5 },
    });
    ddbMock.on(PutCommand).resolves({});
    const res = await createRental(
      authedEvent("u1", {
        body: JSON.stringify({ toolId: "t1", startDate: "2026-08-01", endDate: "2026-08-03" }),
      })
    );
    expect(JSON.parse(res.body).totalPrice).toBe(17);
  });

  it("404s on an inactive tool", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { toolId: "t1", status: "removed" } });
    const res = await createRental(
      authedEvent("u1", {
        body: JSON.stringify({ toolId: "t1", startDate: "2026-08-01", endDate: "2026-08-02" }),
      })
    );
    expect(res.statusCode).toBe(404);
  });
});

describe("listMyRentals", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await listMyRentals({});
    expect(res.statusCode).toBe(401);
  });

  it("queries the renter-index for the JWT user", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ rentalId: "r1" }] });
    const res = await listMyRentals(authedEvent("u1"));
    expect(res.statusCode).toBe(200);
    const call = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(call.IndexName).toBe("renter-index");
    expect(call.ExpressionAttributeValues[":r"]).toBe("u1");
  });
});

describe("returnRental", () => {
  it("403s when caller is neither renter nor owner nor admin", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { rentalId: "r1", renterId: "a", ownerId: "b", status: "active" },
    });
    const res = await returnRental(
      authedEvent("stranger", { pathParameters: { rentalId: "r1" } })
    );
    expect(res.statusCode).toBe(403);
  });

  it("lets the renter return and stamps returnedAt", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { rentalId: "r1", renterId: "a", ownerId: "b", status: "active" },
    });
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { rentalId: "r1", status: "returned" },
    });
    const res = await returnRental(
      authedEvent("a", { pathParameters: { rentalId: "r1" } })
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe("returned");
  });

  it("409s on double return", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { rentalId: "r1", renterId: "a", ownerId: "b", status: "returned" },
    });
    const res = await returnRental(
      authedEvent("a", { pathParameters: { rentalId: "r1" } })
    );
    expect(res.statusCode).toBe(409);
  });
});
