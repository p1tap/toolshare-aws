// Second independent subscriber on the same SNS fanout — demonstrates
// fanout (not just point-to-point) by consuming the identical event
// stream as notifyOwnerWorker for a different purpose.
export const handler = async (event) => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    console.log("audit-log:", JSON.stringify(body));
  }
};
