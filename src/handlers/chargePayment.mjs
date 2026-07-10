import { randomUUID } from "node:crypto";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const secretsClient = new SecretsManagerClient({});

// Saga step 2: mock-charge a third-party payment gateway. The API key
// lives in Secrets Manager (never in env plaintext); CHAOS knob lets the
// saga-compensation demo force a failure on demand.
export const handler = async (event) => {
  const { rentalId } = event;
  if (!rentalId) {
    throw new Error("rentalId is required");
  }

  // Demonstrates reading a secret at call time; the mock gateway doesn't
  // actually need the key, but a real integration would pass it here.
  await secretsClient.send(
    new GetSecretValueCommand({ SecretId: process.env.PAYMENT_SECRET_ARN })
  );

  const chaosRate = parseFloat(process.env.PAYMENT_CHAOS_FAIL_RATE ?? "0");
  if (chaosRate > 0 && Math.random() < chaosRate) {
    throw new Error("chaos knob: mock payment gateway declined the charge");
  }

  return { chargeId: randomUUID() };
};
