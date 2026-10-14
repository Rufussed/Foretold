// SQLite's CURRENT_TIMESTAMP is UTC written as "YYYY-MM-DD HH:MM:SS" with no
// zone, which Date would read as local time, so it is marked as UTC first.
export function formatDateTime(timestamp: string): string {
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(timestamp)
    ? timestamp
    : `${timestamp.replace(" ", "T")}Z`;
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
