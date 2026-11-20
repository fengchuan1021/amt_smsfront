export function fmtDate(value?: string | null): string {
  if (!value) return '-';
  return value.replace('T', ' ').slice(0, 16);
}

export function initials(name?: string): string {
  return (name || 'U').slice(0, 1).toUpperCase();
}

export function formatPoints(value?: number | null): string {
  return new Intl.NumberFormat('zh-CN').format(value ?? 0);
}
