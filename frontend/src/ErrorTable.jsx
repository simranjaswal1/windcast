import { useEffect, useState } from "react";
import { getErrors } from "./api.js";
import { mw, stamp } from "./format.js";

const SORTS = [["biggest", "Biggest misses first"], ["over", "Most over-forecast"], ["under", "Most under-forecast"], ["time", "Chronological"]];
const signed = (v) => `${v > 0 ? "+" : ""}${Math.round(v).toLocaleString("en-GB")} MW`;

export default function ErrorTable({ cutoff, onOpenDay }) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [sort, setSort] = useState("biggest");
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { setPage(1); }, [cutoff, size, sort]);
  useEffect(() => {
    let live = true;
    getErrors(cutoff, page, size, sort).then((r) => live && setRes(r)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [cutoff, page, size, sort]);

  if (error) return <p className="error">{error}</p>;
  if (!res) return null;
  return (
    <section className="card">
      <h2 className="h">Every half-hour, in detail</h2>
      <p className="muted small">Miss = forecast minus actual. Plus means less wind arrived than forecast, so you would have under-bought.</p>
      <div className="rail">
        <label>Order<select value={sort} onChange={(e) => setSort(e.target.value)}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Rows per page<select value={size} onChange={(e) => setSize(Number(e.target.value))}>{[10, 25, 50].map((n) => <option key={n}>{n}</option>)}</select></label>
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Half-hour (UK)</th><th>Forecast</th><th>Actual</th><th>Miss</th><th>Lead</th><th /></tr></thead>
          <tbody>
            {res.rows.map((r) => (
              <tr key={r.startTime}>
                <td>{stamp(r.startTime)}</td><td>{mw(r.forecast)}</td><td>{mw(r.actual)}</td>
                <td className={r.error > 0 ? "over" : "under"}>{signed(r.error)}</td>
                <td>{r.horizon_h?.toFixed(1)} h</td>
                <td><button className="tool" onClick={() => onOpenDay(r.day)}>Open day</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav className="pager" aria-label="Pagination">
        <button className="tool" disabled={page <= 1} onClick={() => setPage(1)}>« First</button>
        <button className="tool" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Previous</button>
        <span aria-live="polite">Page {res.page} of {res.pages} · {res.total.toLocaleString("en-GB")} half-hours</span>
        <button className="tool" disabled={page >= res.pages} onClick={() => setPage(page + 1)}>Next ›</button>
        <button className="tool" disabled={page >= res.pages} onClick={() => setPage(res.pages)}>Last »</button>
      </nav>
    </section>
  );
}
