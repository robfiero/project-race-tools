import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import type { SessionData } from '../types.js';

// S3-backed session store for production (App Runner).
// SESSION_BUCKET must be set. Sessions are stored as JSON objects at
// sessions/{sessionId}.json. A 24-hour S3 lifecycle rule on that prefix
// handles expiry — no code-level TTL needed here.

const client = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
const BUCKET = process.env.SESSION_BUCKET as string;

function objectKey(sessionId: string): string {
  return `sessions/${sessionId}.json`;
}

// SessionData contains Date objects which JSON.stringify turns into ISO strings.
// This reviver converts them back to Date on read.
function deserialize(json: string): SessionData {
  const raw = JSON.parse(json) as unknown as SessionData & {
    createdAt: string;
    participants: Array<Record<string, unknown> & { registrationDate: string }>;
  };
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    participants: raw.participants.map(p => ({
      ...(p as unknown as Parameters<typeof Object.assign>[1]),
      registrationDate: new Date(p.registrationDate),
    })),
  } as SessionData;
}

export async function saveSession(data: SessionData): Promise<void> {
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: objectKey(data.sessionId),
    Body: JSON.stringify(data),
    ContentType: 'application/json',
  }));
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  try {
    const response = await client.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: objectKey(sessionId),
    }));
    const body = await response.Body?.transformToString();
    if (!body) return null;
    return deserialize(body);
  } catch (err) {
    // NoSuchKey means the session doesn't exist or has been expired by lifecycle
    if ((err as { name?: string }).name === 'NoSuchKey') return null;
    throw err;
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  await client.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: objectKey(sessionId),
  }));
}
