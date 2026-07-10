import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({});

// Direct S3 event notification -> Lambda. Real image resizing needs a
// sharp/canvas layer; this records what a resize pipeline would act on
// (key, size, content-type) without adding that dependency weight.
export const handler = async (event) => {
  for (const record of event.Records ?? []) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    console.log("thumbnail: would resize", {
      key,
      size: head.ContentLength,
      contentType: head.ContentType,
    });
  }
};
