'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { NoteDto } from '@/lib/dto';
import { t } from '@/lib/i18n';

type Props = {
  targetType: 'photo' | 'serialNumber' | 'gauge' | 'site';
  targetId: string | null;
  label: string;
  disabledReason?: string;
};

export function NotesList({ targetType, targetId, label, disabledReason }: Props) {
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');

  const queryKey = ['notes', targetType, targetId];

  const { data: notes = [], isLoading } = useQuery<NoteDto[]>({
    queryKey,
    queryFn: async () => {
      if (!targetId) return [];
      const res = await fetch(`/api/notes?targetType=${targetType}&targetId=${targetId}`);
      if (!res.ok) throw new Error('Failed to fetch notes');
      return res.json();
    },
    enabled: !!targetId,
  });

  const mutation = useMutation({
    mutationFn: async (body: string) => {
      if (!targetId) throw new Error('No target ID');
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, body }),
      });
      if (!res.ok) throw new Error('Failed to save note');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setNewNote('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNote.trim() && targetId) {
      mutation.mutate(newNote.trim());
    }
  };

  return (
    <div className="rounded-lg border bg-slate-50 p-4">
      <h3 className="mb-3 font-semibold text-slate-800">{label}</h3>
      
      {!targetId ? (
        <p className="text-sm text-slate-500 italic">{disabledReason || 'Nicht verfügbar'}</p>
      ) : (
        <div className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-slate-500">Laden...</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-slate-500">{t('manager.emptyNotes')}</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((note) => (
                <li key={note.id} className="rounded border bg-white p-3 text-sm shadow-sm">
                  <p className="mb-1 text-slate-800">{note.body}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(note.createdAt).toLocaleString('de-DE')}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder={t('manager.placeholder')}
              className="flex-1 bg-white"
              disabled={mutation.isPending}
            />
            <Button type="submit" disabled={!newNote.trim() || mutation.isPending}>
              {t('manager.addNote')}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
