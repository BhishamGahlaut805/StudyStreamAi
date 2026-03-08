export const toPercentage = (value, precision = 2) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "0%";
  return `${numeric.toFixed(precision)}%`;
};

export const roundTo = (value, precision = 2) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  return Number(numeric.toFixed(precision));
};

export const formatDuration = (minutes) => {
  const totalMinutes = Math.max(0, Math.floor(Number(minutes) || 0));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

export const formatDateTime = (input) => {
  if (!input) return "-";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
