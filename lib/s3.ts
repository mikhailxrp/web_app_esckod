import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

function getEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function createS3Client(): S3Client {
  return new S3Client({
    endpoint: getEnv('S3_ENDPOINT'),
    region: getEnv('S3_REGION'),
    credentials: {
      accessKeyId: getEnv('S3_ACCESS_KEY_ID'),
      secretAccessKey: getEnv('S3_SECRET_ACCESS_KEY'),
    },
    forcePathStyle: true,
  });
}

let s3ClientInstance: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    s3ClientInstance = createS3Client();
  }

  return s3ClientInstance;
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const client = getS3Client();
  const bucket = getEnv('S3_BUCKET');

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  const client = getS3Client();
  const bucket = getEnv('S3_BUCKET');

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}

export function buildPublicUrl(key: string): string {
  const endpoint = getEnv('S3_ENDPOINT');
  const bucket = getEnv('S3_BUCKET');

  return `${endpoint}/${bucket}/${key}`;
}

export function extractKeyFromUrl(url: string): string {
  const endpoint = getEnv('S3_ENDPOINT');
  const bucket = getEnv('S3_BUCKET');
  const prefix = `${endpoint}/${bucket}/`;

  if (!url.startsWith(prefix)) {
    return url;
  }

  return url.slice(prefix.length);
}
