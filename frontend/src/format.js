const TZ = "Europe/London";
const f = (opts) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...opts });

export const mw = (v) => (v == null ? "–" : `${Math.round(v).toLocaleString("en-GB")} MW`);
export const num = (v) => (v == null ? "–" : Math.round(v).toLocaleString("en-GB"));
export const clock = (iso) => f({ hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
export const dayLabel = (iso) =>
  f({ weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
export const stamp = (iso) => `${dayLabel(iso)}, ${clock(iso)}`;
export const longDay = (isoDay) =>
  f({ weekday: "long", day: "numeric", month: "long" }).format(new Date(`${isoDay}T12:00:00Z`));
