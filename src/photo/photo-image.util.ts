import sharp from 'sharp';

export const PHOTO_ALLOWED_MIME = Object.freeze(['image/jpeg', 'image/webp'] as const);
export type PhotoMime = (typeof PHOTO_ALLOWED_MIME)[number];

export const PHOTO_MAX_PIXELS = 25_000_000;

const FORMAT_TO_MIME: Readonly<Record<string, PhotoMime>> = Object.freeze({
  jpeg: 'image/jpeg',
  webp: 'image/webp',
});

const QUALITY_STEPS = Object.freeze([85, 75, 65]);

export interface SanitizedPhoto {
  readonly buffer: Buffer;
  readonly mime: PhotoMime;
  readonly width: number;
  readonly height: number;
}

export type PhotoImageFailureCode = 'PHOTO_FORMAT_INVALID' | 'PHOTO_DIMENSIONS_INVALID' | 'PHOTO_TOO_LARGE';

export type PhotoImageResult =
  | { readonly ok: true; readonly photo: SanitizedPhoto }
  | { readonly ok: false; readonly code: PhotoImageFailureCode; readonly detail: string };

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : 'tidak dapat dibaca';

const createPipeline = (input: Buffer) =>
  sharp(input, { limitInputPixels: PHOTO_MAX_PIXELS, failOn: 'error' }).rotate();

const encodeAs = async (input: Buffer, mime: PhotoMime, quality: number): Promise<Buffer> => {
  const pipeline = createPipeline(input);
  return mime === 'image/webp'
    ? pipeline.webp({ quality }).toBuffer()
    : pipeline.jpeg({ quality, chromaSubsampling: '4:2:0' }).toBuffer();
};

const classifyFailure = (error: unknown): PhotoImageFailureCode =>
  /pixel limit|exceeds pixel/i.test(describeError(error)) ? 'PHOTO_DIMENSIONS_INVALID' : 'PHOTO_FORMAT_INVALID';

export const sanitizePhoto = async (input: Buffer, maxBytes: number): Promise<PhotoImageResult> => {
  let format: string | undefined;
  let width: number | undefined;
  let height: number | undefined;
  let orientation: number | undefined;

  try {
    const metadata = await sharp(input, { limitInputPixels: PHOTO_MAX_PIXELS, failOn: 'error' }).metadata();
    format = metadata.format;
    width = metadata.width;
    height = metadata.height;
    orientation = metadata.orientation;
  } catch (error) {
    return { ok: false, code: classifyFailure(error), detail: describeError(error) };
  }

  const mime = format === undefined ? null : (FORMAT_TO_MIME[format] ?? null);
  if (mime === null || width === undefined || height === undefined) {
    return {
      ok: false,
      code: 'PHOTO_FORMAT_INVALID',
      detail: `format ${format ?? 'tidak dikenal'} tidak didukung`,
    };
  }
  if (width * height > PHOTO_MAX_PIXELS) {
    return {
      ok: false,
      code: 'PHOTO_DIMENSIONS_INVALID',
      detail: `dimensi ${width}x${height} melebihi batas piksel`,
    };
  }

  const swap = orientation !== undefined && orientation >= 5;
  const outputWidth = swap ? height : width;
  const outputHeight = swap ? width : height;

  for (const quality of QUALITY_STEPS) {
    let encoded: Buffer;
    try {
      encoded = await encodeAs(input, mime, quality);
    } catch (error) {
      return { ok: false, code: classifyFailure(error), detail: describeError(error) };
    }
    if (encoded.length <= maxBytes) {
      return {
        ok: true,
        photo: Object.freeze({ buffer: encoded, mime, width: outputWidth, height: outputHeight }),
      };
    }
  }

  return {
    ok: false,
    code: 'PHOTO_TOO_LARGE',
    detail: `hasil kompresi melebihi ${maxBytes} byte`,
  };
};