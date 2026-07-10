import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { handler as reserveTool } from "../src/handlers/reserveTool.mjs";
import { handler as confirmRental } from "../src/handlers/confirmRental.mjs";
import { handler as compensateReservation } from "../src/handlers/compensateReservation.mjs";
import { handler as chargePayment } from "../src/handlers/chargePayment.mjs";

const ddbMock = mockClient(DynamoDBDocumentClient);
const secretsMock = mockClient(SecretsManagerClient);

beforeEach(() => {
  ddbMock.reset();
  secretsMock.reset();
  secretsMock.on(GetSecretValueCommand).resolves({ SecretString: '{"apiKey":"mock"}' });
});

describe("reserveTool", () => {
  it("moves a requested rental to reserved", async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const result = await reserveTool({ rentalId: "r1" });
    expect(result.rentalId).toBe("r1");
    const call = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(call.ExpressionAttributeValues[":reserved"]).toBe("reserved");
  });

  it("throws without a rentalId", async () => {
    await expect(reserveTool({})).rejects.toThrow();
  });
});

describe("chargePayment", () => {
  it("succeeds and returns a chargeId when chaos rate is 0", async () => {
    const result = await chargePayment({ rentalId: "r1" });
    expect(result.chargeId).toBeTruthy();
  });

  it("throws when the chaos knob forces a failure", async () => {
    process.env.PAYMENT_CHAOS_FAIL_RATE = "1";
    await expect(chargePayment({ rentalId: "r1" })).rejects.toThrow(/chaos knob/);
    delete process.env.PAYMENT_CHAOS_FAIL_RATE;
  });
});

describe("confirmRental", () => {
  it("sets status to active", async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const result = await confirmRental({ rentalId: "r1" });
    expect(result.status).toBe("active");
  });
});

describe("compensateReservation", () => {
  it("releases the reservation back to requested", async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const result = await compensateReservation({ rentalId: "r1" });
    expect(result.status).toBe("payment_failed");
    const call = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(call.ExpressionAttributeValues[":requested"]).toBe("requested");
  });

  it("reads rentalId from the ASL error path shape too", async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const result = await compensateReservation({ reservation: { rentalId: "r2" } });
    expect(result.status).toBe("payment_failed");
    const call = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(call.Key.rentalId).toBe("r2");
  });
});
