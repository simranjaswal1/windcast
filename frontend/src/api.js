async function get(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/${path}${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export const getMeta = () => get("meta");
export const getDecision = (day, cutoff) => get("decision", { day, cutoff });
export const getAccuracy = (cutoff) => get("accuracy", { cutoff });
export const getSensitivity = () => get("sensitivity");
export const getErrors = (cutoff, page, pageSize, sort) => get("errors", { cutoff, page, page_size: pageSize, sort });
