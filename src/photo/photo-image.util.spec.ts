import sharp from 'sharp';
import { PHOTO_MAX_PIXELS, sanitizePhoto } from './photo-image.util.js';
import { describe, expect, it } from '@jest/globals';


const createJpeg = async (width: number, height: number): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: { r: 120, g: 90, b: 60 } } })
    .jpeg({ quality: 80 })
    .toBuffer();

const createWebp = async (width: number, height: number): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: { r: 60, g: 120, b: 90 } } })
    .webp({ quality: 80 })
    .toBuffer();

describe('sanitizePhoto', () => {
  it('menerima JPEG dan mengembalikan dimensi yang benar', async () => {
    const jpeg = await createJpeg(640, 480);
    const result = await sanitizePhoto(jpeg, 1048576);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.photo.mime).toBe('image/jpeg');
    expect(result.photo.width).toBe(640);
    expect(result.photo.height).toBe(480);
    expect(result.photo.buffer.length).toBeGreaterThan(0);
  });

  it('menerima WebP dan mempertahankan format WebP', async () => {
    const webp = await createWebp(320, 200);
    const result = await sanitizePhoto(webp, 1048576);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.photo.mime).toBe('image/webp');
  });

  it('menolak buffer yang bukan gambar', async () => {
    const result = await sanitizePhoto(Buffer.from('bukan gambar sama sekali'), 1048576);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('PHOTO_FORMAT_INVALID');
  });

  it('menolak format gambar yang tidak diizinkan', async () => {
    const png = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } } })
      .png()
      .toBuffer();
    const result = await sanitizePhoto(png, 1048576);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('PHOTO_FORMAT_INVALID');
    expect(result.detail).toContain('png');
  });

  it('membuang EXIF dari foto keluaran', async () => {
    const withExif = await sharp({ create: { width: 50, height: 50, channels: 3, background: 'white' } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'ARGUS' } } })
      .toBuffer();
    const inputMeta = await sharp(withExif).metadata();
    expect(inputMeta.exif).toBeDefined();

    const result = await sanitizePhoto(withExif, 1048576);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const outputMeta = await sharp(result.photo.buffer).metadata();
    expect(outputMeta.exif).toBeUndefined();
  });

  it('memangkas ukuran keluaran sampai di bawah batas byte', async () => {
    const { randomBytes } = await import('node:crypto');
    const width = 400;
    const height = 300;
    const raw = randomBytes(width * height * 3);
    const source = await sharp(raw, { raw: { width, height, channels: 3 } })
      .jpeg({ quality: 100 })
      .toBuffer();
    const ceiling = (await sharp(source).jpeg({ quality: 65, chromaSubsampling: '4:2:0' }).toBuffer()).length + 10;

    const result = await sanitizePhoto(source, ceiling);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.photo.buffer.length).toBeLessThanOrEqual(ceiling);
    expect(result.photo.buffer.length).toBeLessThan(source.length);
  });

  it('gagal dengan PHOTO_TOO_LARGE bila batas byte tidak mungkin dipenuhi', async () => {
    const source = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 100, b: 50 } },
    })
      .jpeg({ quality: 100 })
      .toBuffer();
    const result = await sanitizePhoto(source, 50);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('PHOTO_TOO_LARGE');
  });

  it('menolak gambar yang melewati batas piksel', async () => {
    expect(PHOTO_MAX_PIXELS).toBe(25_000_000);
    const small = await createJpeg(10, 10);
    const okResult = await sanitizePhoto(small, 1048576);
    expect(okResult.ok).toBe(true);
  });
});