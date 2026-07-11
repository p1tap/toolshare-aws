import { describe, it, expect, vi, beforeEach } from "vitest";

// The event-driven half of the stack: SQS workers whose THROW semantics
// are load-bearing (a thrown handler is what makes SQS redeliver and
// eventually park a poison message in the DLQ), and the presign endpoint
// that gates what clients may upload.

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://mock-bucket.s3.amazonaws.com/signed"),
}));

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { handler as notifyOwnerWorker } from "../src/handlers/notifyOwnerWorker.mjs";
import { handler as auditLogWorker } from "../src/handlers/auditLogWorker.mjs";
import { handler as analyticsEvent } from "../src/handlers/analyticsEvent.mjs";
import { handler as presignUpload } from "../src/handlers/presignUpload.mjs";

const ddbMock = mockClient(DynamoDBDocumentClient);

function authedEvent(userId, extras = {}) {
  return {
    requestContext: {
      authorizer: { jwt: { claims: { sub: userId, email: `${userId}@x.com` } } },
    },
    ...extras,
  };
}

const sqsEvent = (...bodies) => ({
  Records: bodies.map((b) => ({ body: typeof b === "string" ? b : JSON.stringify(b) })),
});

beforeEach(() => {
  vi.clearAllMocks();
  ddbMock.reset();
});

describe("notifyOwnerWorker (SQS consumer feeding the DLQ demo)", () => {
  it("processes normal rental events without throwing", async () => {
    await expect(
      notifyOwnerWorker(sqsEvent({ rentalId: "r1", toolId: "t1", ownerId: "o1" }))
    ).resolves.toBeUndefined();
  });

  it("THROWS on the chaos-poison message — SQS redelivery/DLQ depends on this", async () => {
    await expect(
      notifyOwnerWorker(sqsEvent({ rentalId: "r-bad", toolId: "chaos-poison" }))
    ).rejects.toThrow(/poison/);
  });

  it("still throws when the poison message sits behind valid ones in the batch", async () => {
    await expect(
      notifyOwnerWorker(sqsEvent({ toolId: "t1" }, { toolId: "chaos-poison" }))
    ).rejects.toThrow(/poison/);
  });
});

describe("auditLogWorker (second fanout subscriber)", () => {
  it("consumes the same event shape without throwing", async () => {
    await expect(auditLogWorker(sqsEvent({ rentalId: "r1", toolId: "t1" }))).resolves.toBeUndefined();
  });

  it("throws on a malformed body so the message redelivers instead of being lost", async () => {
    await expect(auditLogWorker(sqsEvent("not-json{{{"))).rejects.toThrow();
  });
});

describe("analyticsEvent (EventBridge consumer)", () => {
  it("accepts an EventBridge-shaped event (detail, not Records)", async () => {
    await expect(
      analyticsEvent({ "detail-type": "RentalCreated", detail: { rentalId: "r1" } })
    ).resolves.toBeUndefined();
  });
});

describe("presignUpload", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await presignUpload({ pathParameters: { toolId: "t42" } });
    expect(res.statusCode).toBe(401);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("400s without a toolId", async () => {
    const res = await presignUpload(authedEvent("owner-1", { pathParameters: {} }));
    expect(res.statusCode).toBe(400);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("404s for a tool that doesn't exist", async () => {
    ddbMock.on(GetCommand).resolves({});
    const res = await presignUpload(
      authedEvent("owner-1", { pathParameters: { toolId: "ghost" } })
    );
    expect(res.statusCode).toBe(404);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("403s when the caller does not own the tool", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { toolId: "t42", ownerId: "owner-1" } });
    const res = await presignUpload(
      authedEvent("other-user", { pathParameters: { toolId: "t42" } })
    );
    expect(res.statusCode).toBe(403);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("returns a short-lived URL and links the key to the tool record", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { toolId: "t42", ownerId: "owner-1" } });
    ddbMock.on(UpdateCommand).resolves({});
    const res = await presignUpload(
      authedEvent("owner-1", { pathParameters: { toolId: "t42" } })
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.uploadUrl).toContain("https://");
    expect(body.key).toMatch(/^tools\/t42\/[a-z0-9]+\.jpg$/);
    expect(body.expiresIn).toBe(300); // presigned URLs must stay short-lived
    // the imageKey persisted must be exactly the key handed to the client
    const update = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(update.ExpressionAttributeValues[":k"]).toBe(body.key);
    expect(update.ExpressionAttributeValues[":owner"]).toBe("owner-1");
  });

  it("pins the upload content type to image/jpeg", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { toolId: "t42", ownerId: "owner-1" } });
    ddbMock.on(UpdateCommand).resolves({});
    await presignUpload(authedEvent("owner-1", { pathParameters: { toolId: "t42" } }));
    const command = getSignedUrl.mock.calls[0][1];
    expect(command.input.ContentType).toBe("image/jpeg");
  });

  it("500s (not crash) when presigning fails", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { toolId: "t42", ownerId: "owner-1" } });
    getSignedUrl.mockRejectedValueOnce(new Error("kms down"));
    const res = await presignUpload(
      authedEvent("owner-1", { pathParameters: { toolId: "t42" } })
    );
    expect(res.statusCode).toBe(500);
  });
});
