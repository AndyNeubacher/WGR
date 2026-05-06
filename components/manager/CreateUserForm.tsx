'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createUserSchema, type CreateUserInput } from '@/lib/validation';
import { t } from '@/lib/i18n';

export function CreateUserForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
  });

  const onSubmit = async (data: CreateUserInput) => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || t('errors.saveFailed'));
        return;
      }

      router.push('/manager/users');
      router.refresh();
    } catch (err) {
      setError(t('errors.saveFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t('users.name')}</Label>
        <Input id="name" {...register('name')} disabled={isLoading} />
        {errors.name && <p className="text-xs text-red-600">{String(errors.name.message)}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t('users.email')}</Label>
        <Input id="email" type="email" {...register('email')} disabled={isLoading} />
        {errors.email && <p className="text-xs text-red-600">{String(errors.email.message)}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t('users.password')}</Label>
        <Input id="password" type="password" {...register('password')} disabled={isLoading} />
        {errors.password && <p className="text-xs text-red-600">{String(errors.password.message)}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">{t('users.role')}</Label>
        <select
          id="role"
          {...register('role')}
          className="w-full rounded border px-3 py-2 text-sm"
          disabled={isLoading}
        >
          <option value="technician">{t('users.roleTechnician')}</option>
          <option value="manager">{t('users.roleManager')}</option>
        </select>
        {errors.role && <p className="text-xs text-red-600">{String(errors.role.message)}</p>}
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? t('capture.uploading') : t('users.create')}
        </Button>
      </div>
    </form>
  );
}
