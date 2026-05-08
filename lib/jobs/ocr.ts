import { prisma } from '@/lib/db';
import { ocrPhoto } from '@/lib/ocr';
import { resolvePhotoPath } from '@/lib/storage';

export async function processOcrJob(payload: { readingId: string }): Promise<void> {
  const reading = await prisma.reading.findUnique({
    where: { id: payload.readingId },
    include: { primaryPhoto: true },
  });
  if (!reading || !reading.primaryPhoto) {
    throw new Error(`Reading ${payload.readingId} or primary photo missing`);
  }
  const abs = resolvePhotoPath(reading.primaryPhoto.path);
  try {
    const result = await ocrPhoto(abs);
    await prisma.reading.update({
      where: { id: reading.id },
      data: {
        ocrStatus: 'done',
        serialNumber: result.serialNumber ?? null,
        consumedVolume: result.consumedVolume ?? null,
      },
    });
  } catch (e) {
    await prisma.reading.update({
      where: { id: reading.id },
      data: { ocrStatus: 'failed' },
    });
    throw e;
  }
}
