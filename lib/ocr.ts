const OCR_URL = process.env.OCR_URL ?? 'http://127.0.0.1:8001';

export type OcrResult = {
  serialNumber: string | null;
  consumedVolume: number | null;
};

export async function ocrPhoto(absolutePath: string): Promise<OcrResult> {
  const res = await fetch(`${OCR_URL}/ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: absolutePath }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OCR sidecar error ${res.status}: ${text}`);
  }
  return res.json() as Promise<OcrResult>;
}
