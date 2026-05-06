import { LoginForm } from '@/components/LoginForm';
import { t } from '@/lib/i18n';

export default function LoginPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('login.title')}</h1>
      </div>
      <LoginForm />
    </div>
  );
}
