// Second, independent consumer of the same S3 upload — this one arrives
// via EventBridge (S3 -> EventBridge -> rule -> Lambda) rather than a
// direct S3 notification, demonstrating the event-bus fan-out path
// alongside the tight direct-Lambda path used by thumbnail.mjs.
export const handler = async (event) => {
  console.log("analytics-event:", JSON.stringify(event.detail));
};
