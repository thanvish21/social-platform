import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { randomUUID } from 'node:crypto';
import { env } from '../lib/env.js';

const s3 = new S3Client({
  region: env.s3.region,
  endpoint: env.s3.endpoint,
  forcePathStyle: env.s3.forcePathStyle,
  credentials: {
    accessKeyId: env.s3.accessKey,
    secretAccessKey: env.s3.secretKey,
  },
});

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export interface PresignedUpload {
  url: string;
  fields: Record<string, string>;
  key: string;
  publicUrl: string;
}

/**
 * Generate a presigned POST so the client uploads directly to MinIO/S3
 * without proxying bytes through the GraphQL server.
 */
export async function presignUpload(
  userId: string,
  contentType: string,
): Promise<PresignedUpload> {
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }

  const ext = contentType.split('/')[1];
  const key = `uploads/${userId}/${randomUUID()}.${ext}`;

  const { url, fields } = await createPresignedPost(s3, {
    Bucket: env.s3.bucket,
    Key: key,
    Conditions: [
      ['content-length-range', 0, MAX_BYTES],
      ['eq', '$Content-Type', contentType],
    ],
    Fields: { 'Content-Type': contentType },
    Expires: 300,
  });

  return {
    url,
    fields,
    key,
    publicUrl: `${env.s3.publicUrl}/${key}`,
  };
}

/** Server-side direct upload (used by the seed script). */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return `${env.s3.publicUrl}/${key}`;
}
