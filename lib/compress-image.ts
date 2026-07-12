// Compresión de imágenes en el navegador (canvas) antes de subirlas.
// Objetivo: JPEG con calidad 0.7 y un tope de 800 KB, sin perder legibilidad
// del comprobante. Si algo falla, devuelve el archivo original.

const MAX_BYTES = 800 * 1024;
const PRIMARY_QUALITY = 0.7;
const MAX_DIM = 1600;

/** Intentos progresivos: primero calidad 0.7; si pesa de más, baja gradual. */
const ATTEMPTS: Array<{ maxDim: number; quality: number }> = [
  { maxDim: MAX_DIM, quality: PRIMARY_QUALITY },
  { maxDim: MAX_DIM, quality: 0.55 },
  { maxDim: 1280, quality: 0.6 },
  { maxDim: 1280, quality: 0.45 },
  { maxDim: 1024, quality: 0.5 },
  { maxDim: 800, quality: 0.5 },
];

export async function compressImage(file: File): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  let best: Blob | null = null;
  for (const a of ATTEMPTS) {
    const blob = await renderBlob(bitmap, a.maxDim, a.quality);
    if (!blob) continue;
    best = blob;
    if (blob.size <= MAX_BYTES) break;
  }
  if (typeof bitmap.close === "function") bitmap.close();

  if (!best || best.size >= file.size) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([best], name, { type: "image/jpeg" });
}

async function renderBlob(
  bitmap: ImageBitmap,
  maxDim: number,
  quality: number,
): Promise<Blob | null> {
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
  });
}
