import { toISO } from '@/domain/dates';
import type { ISODate } from '@/data/types';

export interface ProcessedImage {
  data: ArrayBuffer;
  width: number;
  height: number;
  mime: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('This image format could not be read.'));
    img.src = src;
  });
}

/**
 * Downscale and re-encode an image entirely on-device.
 * Modern browsers apply EXIF orientation when drawing an <img>, so photos stay upright.
 */
export async function processImage(file: Blob, maxSize: number, quality = 0.86): Promise<ProcessedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob) throw new Error('The image could not be encoded.');
    return { data: await blob.arrayBuffer(), width, height, mime: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Reads EXIF DateTimeOriginal from a JPEG, if present. */
export async function readPhotoDate(file: File): Promise<ISODate | null> {
  try {
    const buf = await file.slice(0, 128 * 1024).arrayBuffer();
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xffd8) return null;
    let off = 2;
    while (off + 4 < v.byteLength) {
      const marker = v.getUint16(off);
      const size = v.getUint16(off + 2);
      if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) {
        const tiff = off + 10;
        const le = v.getUint16(tiff) === 0x4949;
        const u16 = (o: number) => v.getUint16(o, le);
        const u32 = (o: number) => v.getUint32(o, le);
        const readAscii = (o: number, n: number) => {
          let s = '';
          for (let i = 0; i < n && o + i < v.byteLength; i++) {
            const c = v.getUint8(o + i);
            if (!c) break;
            s += String.fromCharCode(c);
          }
          return s;
        };
        const findTag = (ifd: number, tag: number): number | null => {
          const count = u16(ifd);
          for (let i = 0; i < count; i++) {
            const e = ifd + 2 + i * 12;
            if (u16(e) === tag) return e;
          }
          return null;
        };
        const ifd0 = tiff + u32(tiff + 4);
        let dateStr: string | null = null;
        const exifPtr = findTag(ifd0, 0x8769);
        if (exifPtr !== null) {
          const exifIfd = tiff + u32(exifPtr + 8);
          const e = findTag(exifIfd, 0x9003);
          if (e !== null) dateStr = readAscii(tiff + u32(e + 8), 19);
        }
        if (!dateStr) {
          const e = findTag(ifd0, 0x0132);
          if (e !== null) dateStr = readAscii(tiff + u32(e + 8), 19);
        }
        const m = dateStr?.match(/^(\d{4}):(\d{2}):(\d{2})/);
        return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
      }
      if ((marker & 0xff00) !== 0xff00) break;
      off += 2 + size;
    }
    return null;
  } catch {
    return null;
  }
}

export async function suggestedPhotoDate(file: File): Promise<ISODate> {
  return (await readPhotoDate(file)) ?? toISO(new Date(file.lastModified || Date.now()));
}

const urlCache = new Map<string, string>();

/** Object URL for a stored buffer, cached by key. Revoke with `releaseImageUrl`. */
export function imageUrl(key: string, data: ArrayBuffer, mime = 'image/jpeg'): string {
  let url = urlCache.get(key);
  if (!url) {
    url = URL.createObjectURL(new Blob([data], { type: mime }));
    urlCache.set(key, url);
  }
  return url;
}

export function releaseImageUrl(key: string) {
  const url = urlCache.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
}
