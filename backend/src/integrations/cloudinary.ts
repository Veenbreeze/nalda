import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { cloudinaryConfigured, env } from '../config/env';

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export async function uploadBuffer(
  buffer: Buffer,
  originalName: string,
  mimetype: string,
): Promise<{ url: string; publicId?: string; provider: 'cloudinary' | 'local' }> {
  if (cloudinaryConfigured) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: env.CLOUDINARY_FOLDER, resource_type: 'image' },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
          resolve({ url: result.secure_url, publicId: result.public_id, provider: 'cloudinary' });
        },
      );
      stream.end(buffer);
    });
  }

  // Local fallback for development
  const dir = path.resolve(process.cwd(), 'uploads');
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(originalName) || `.${mimetype.split('/')[1] || 'bin'}`;
  const fileName = `${crypto.randomUUID()}${ext}`;
  await fs.writeFile(path.join(dir, fileName), buffer);
  return { url: `/uploads/${fileName}`, provider: 'local' };
}

export { cloudinaryConfigured };
