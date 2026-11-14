export function formatRelativeTime(iso, now) {
  if (!iso || !now) return "—";
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return "—";

  const deltaSeconds = Math.max(0, Math.round((now - timestamp) / 1000));

  if (deltaSeconds < 10) return "just now";
  if (deltaSeconds < 60) return `${deltaSeconds} s ago`;

  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;

  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
