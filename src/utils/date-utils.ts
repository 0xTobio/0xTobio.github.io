export function formatDateToYYYYMMDD(date: Date): string {
	return date.toISOString().substring(0, 10);
}

export function formatDateVN(date: Date | string): string {
  return new Date(date).toLocaleDateString('vi-VN');
}