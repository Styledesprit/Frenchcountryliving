import { putAsset } from './store';

/** Shrink very large photos so the PDF stays a sensible size for Flipsnack (max ~2400px, JPEG). */
async function downscale(file: File, max = 2400): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5e6) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const keepPng = file.type === 'image/png' && file.size < 1e6;
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b || file), keepPng ? 'image/png' : 'image/jpeg', 0.85));
  } catch {
    return file;
  }
}

export function pickFiles(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files || []));
    input.click();
  });
}

/** Ask for one or more photos, store them in the browser and return their "asset:" sources */
export async function pickImages(multiple = false): Promise<string[]> {
  const files = await pickFiles('image/*', multiple);
  const out: string[] = [];
  for (const f of files) out.push(await putAsset(await downscale(f)));
  return out;
}
