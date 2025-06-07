import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: 'auto',
  endpoint: 'https://441234d01e9c8c50883706e46f66e804.r2.cloudflarestorage.com',
  forcePathStyle: true,
  credentials: {
    accessKeyId: '48dea0cd29086b4ee8aebbe9c2d7c433',
    secretAccessKey:
      '3449eccccfa9f950d6f3b407a7b3cc27f60fd2a1d96d8a4f97c590f3b2e14558',
  },
});

export async function generatePresignedUrl(
  fileName: string,
  contentType: string = 'image/jpeg',
) {
  try {
    console.log('🔧 Generating presigned URL for:', fileName);

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: fileName,
      ContentType: contentType,
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    console.log('✅ Signed URL created');
    return signedUrl;
  } catch (err) {
    console.error('❌ Error in generatePresignedUrl:', err);
    throw err;
  }
}
