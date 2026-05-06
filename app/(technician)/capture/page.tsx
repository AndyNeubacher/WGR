import { CaptureForm } from '@/components/CaptureForm';
import { t } from '@/lib/i18n';

export default function CapturePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t('capture.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('capture.instructions')}</p>
      </div>
      <CaptureForm />
    </div>
  );
}
