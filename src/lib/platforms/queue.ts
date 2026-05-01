// SQS Queue — pushes platform messages for Lambda processing
// Used by Vercel API routes when SQS is configured
// Falls back to direct handler call when SQS is not configured (local dev)

import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const QUEUE_URL = process.env.CODETEEL_SQS_QUEUE_URL;

let sqsClient: SQSClient | null = null;

function getClient(): SQSClient {
  if (!sqsClient) {
    sqsClient = new SQSClient({
      region: process.env.AWS_REGION || "ap-south-1",
    });
  }
  return sqsClient;
}

export function isSQSConfigured(): boolean {
  return !!QUEUE_URL;
}

export interface QueueMessagePayload {
  operation: "event" | "interactive";
  platform: "slack" | "telegram" | "discord";
  userId: string;
  channelId: string;
  teamId?: string;
  threadId?: string;
  text: string;
  interactionData?: string;
  // NOTE: botToken is NOT passed in the queue for security.
  // Lambda looks it up from DB using teamId.
  action?: {
    actionId: string;
    value: string;
    messageTs: string;
  };
}

export async function pushToQueue(payload: QueueMessagePayload): Promise<void> {
  if (!QUEUE_URL) {
    throw new Error("CODETEEL_SQS_QUEUE_URL not configured");
  }

  const client = getClient();
  await client.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(payload),
    }),
  );
}
