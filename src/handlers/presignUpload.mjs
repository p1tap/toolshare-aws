import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TOOLS_TABLE } from "../lib/dynamo.mjs";
import { getIdentity } from "../lib/auth.mjs";
import { json } from "../lib/response.mjs";

const s3 = new S3Client({});
const BUCKET = process.env.UPLOAD_BUCKET;

export const handler = async (event) => {
  const identity = getIdentity(event);
  if (!identity) {
    return json(401, { error: "Unauthorized" });
  }

  const toolId = event.pathParameters?.toolId;
  if (!toolId) {
    return json(400, { error: "toolId is required" });
  }

  try {
    const existing = await ddb.send(
      new GetCommand({ TableName: TOOLS_TABLE, Key: { toolId } })
    );
    if (!existing.Item) {
      return json(404, { error: "Tool not found" });
    }
    if (existing.Item.ownerId !== identity.userId) {
      return json(403, { error: "Not your tool" });
    }

    const key = `tools/${toolId}/${randomSuffix()}.jpg`;
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: "image/jpeg",
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    // Link the image to the tool so list/get responses can render it —
    // last presign wins, which is fine for a single-photo-per-tool UX.
    await ddb.send(
      new UpdateCommand({
        TableName: TOOLS_TABLE,
        Key: { toolId },
        UpdateExpression: "SET imageKey = :k",
        ConditionExpression: "ownerId = :owner",
        ExpressionAttributeValues: { ":k": key, ":owner": identity.userId },
      })
    );

    return json(200, { uploadUrl, key, expiresIn: 300 });
  } catch (err) {
    console.error("presignUpload failed:", err);
    return json(500, { error: "Failed to create upload URL" });
  }
};

function randomSuffix() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
