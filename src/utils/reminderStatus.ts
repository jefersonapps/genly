export function getReminderStatus(date: string | null, time: string | null, completed = 0, now = new Date()): { label: string; color: `#${string}`; kind: 'complete' | 'expired' | 'today' | 'tomorrow' | 'upcoming' | 'future' } | null {
  if (completed === 1) return { label: 'Concluído', color: '#10B981', kind: 'complete' as const };
  if (!date) return null;
  const target = new Date(`${date}T${time || '00:00:00'}`);
  if (!Number.isFinite(target.getTime())) return null;
  if (target.getTime() < now.getTime()) return { label: 'Expirado', color: '#EF4444', kind: 'expired' as const };
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((day(target) - day(now)) / 86400000);
  if (days === 0) return { label: 'Hoje', color: '#3B82F6', kind: 'today' as const };
  if (days === 1) return { label: 'Amanhã', color: '#F59E0B', kind: 'tomorrow' as const };
  if (days <= 7) return { label: `Em ${days} dias`, color: '#3B82F6', kind: 'upcoming' as const };
  return { label: target.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), color: '#10B981', kind: 'future' as const };
}
