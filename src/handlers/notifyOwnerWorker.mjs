// Consumes the SNS fanout: "notify the tool owner a rental happened."
// A rental with toolId "chaos-poison" deliberately throws every time, so
// SQS redelivers it until maxReceiveCount is exhausted and it lands in
// the DLQ — the demo for "a bad message doesn't jam the queue forever."
export const handler = async (event) => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    if (body.toolId === "chaos-poison") {
      throw new Error("chaos knob: poison message, forcing DLQ redelivery");
    }
    console.log("notify-owner:", JSON.stringify(body));
  }
};
