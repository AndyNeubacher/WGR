'use client';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

type Props = {
  name: string;
  role: 'technician' | 'manager';
};

export function UserMenu({ name, role }: Props) {
  const roleLabel = role === 'manager' ? t('users.roleManager') : t('users.roleTechnician');

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="hidden text-right sm:block">
        <p className="font-medium text-slate-900">{name}</p>
        <p className="text-xs text-slate-500">{roleLabel}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => signOut({ callbackUrl: '/login' })}
      >
        {t('common.logout')}
      </Button>
    </div>
  );
}
