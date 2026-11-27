export function fmtDate(value?: string | null): string {
  if (!value) return '-';
  return value.replace('T', ' ').slice(0, 16);
}

export function initials(name?: string): string {
  return (name || 'U').slice(0, 1).toUpperCase();
}

/** 固定汇率：100 积分 = 1 元。仅用于前端展示，接口仍使用积分。 */
export const POINTS_PER_YUAN = 100;

export function pointsToYuan(points?: number | null): number {
  return (points ?? 0) / POINTS_PER_YUAN;
}

export function yuanToPoints(yuan?: number | null): number {
  return Math.round(Number(((yuan ?? 0) * POINTS_PER_YUAN).toFixed(2)));
}

export function formatYuan(points?: number | null): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pointsToYuan(points));
}
