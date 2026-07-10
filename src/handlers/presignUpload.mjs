import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { json } from "../lib/response.mjs";

const s3 = new S3Client({});
const BUCKET = process.env.UPLOAD_BUCKET;

export const handler = async (event) => {
  const toolId = event.pathParameters?.toolId;
  if (!toolId) {
    return json(400, { error: "toolId is required" });
  }

  const key = `tools/${toolId}/${randomSuffix()}.jpg`;
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: "image/jpeg",
  });

  try {
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    return json(200, { uploadUrl, key, expiresIn: 300 });
  } catch (err) {
    console.error("presignUpload failed:", err);
    return json(500, { error: "Failed to create upload URL" });
  }
};

function randomSuffix() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
