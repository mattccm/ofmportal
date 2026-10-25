"use client";

import * as React from "react";
import { formatDay } from "@/components/title-wall";

export interface OnTimePoint {
  id: string;
  title: string;
  due: string;
  delivered?: string;
  /** Positive: days early. Negative: days late. */
  daysEarly: number;
  onTime: boolean;
}

/** Also accepted: `{ id, title, due, days }` with days early (+) or late (-). */
type PointInput = OnTimePoint | { id: string; title: string; due: string; days: number };

function normalise(p: PointInput): OnTimePoint {
  if ("daysEarly" in p) return p;
  return { id: p.id, title: p.title, due: p.due, daysEarly: p.days, onTime: p.days >= 0 };
}

/**
 * How early or late each finished request came in, oldest on the left.
 * Diverging columns on one zero line: early above in the neutral approved
 * grey, late below in the late red (state colours, no green). Columns are
 * square at the baseline with a small rounded data end. A crosshair-free
 * per-column tooltip names the request; a hidden table carries the same data.
 */
export function OnTimeChart({ points: input, name = "this creator" }: { points: PointInput[]; name?: string }) {
  const points = input.map(normalise);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const [hover, setHover] = React.useState<number | null>(null);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shown = points.slice(-12);
  const max = Math.max(1, ...shown.map((p) => Math.abs(p.daysEarly)));
  // Round, even steps with the top tick above the largest value
  const step = max <= 2 ? 1 : max <= 6 ? 2 : max <= 15 ? 5 : 10;
  const top = Math.ceil((max + 0.01) / step) * step;
  const ticks: number[] = [];
  for (let v = top; v >= -top; v -= step) ticks.push(v);

  const H = 176;
  const padL = 30;
  const padR = 4;
  const padT = 8;
  const padB = 24;
  const plotH = H - padT - padB;
  const plotW = Math.max(0, width - padL - padR);
  const y = (v: number) => padT + ((top - v) / (2 * top)) * plotH;
  const slot = shown.length ? plotW / shown.length : 0;
  const barW = Math.max(6, Math.min(28, slot * 0.5));
  const labelEvery = slot < 44 ? Math.ceil(44 / Math.max(1, slot)) : 1;

  const fmtDays = (d: number) =>
    d === 0 ? "On the day" : d > 0 ? `${d} ${d === 1 ? "day" : "days"} early` : `${-d} ${d === -1 ? "day" : "days"} late`;

  const active = hover != null ? shown[hover] : null;

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        How early or late each of {name}&rsquo;s last {shown.length} finished requests came in.
      </figcaption>
      <div className="mb-2 flex items-center gap-4 text-[13px] text-ink-2" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-success" />
          Early
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-late" />
          Late
        </span>
      </div>
      <div ref={wrapRef} className="relative" style={{ height: H }}>
        {width > 0 && (
          <svg width={width} height={H} role="img" aria-label={`Days early or late for ${shown.length} finished requests`}>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={padL}
                  x2={width - padR}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="var(--tw-line)"
                  strokeWidth={t === 0 ? 0 : 1}
                />
                <text
                  x={padL - 8}
                  y={y(t)}
                  dy="0.35em"
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--tw-ink-2)"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {t > 0 ? `+${t}` : t < 0 ? `−${-t}` : "0"}
                </text>
              </g>
            ))}
            {shown.map((p, i) => {
              const cx = padL + slot * i + slot / 2;
              const v = p.daysEarly;
              const y0 = y(0);
              const y1 = y(v);
              const h = Math.abs(y1 - y0);
              const r = Math.min(3, h / 2, barW / 2);
              const x = cx - barW / 2;
              // Square at the baseline, a small radius on the data end
              const d =
                v > 0
                  ? `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + barW - r} Q${x + barW},${y1} ${x + barW},${y1 + r} V${y0} Z`
                  : `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + barW - r} Q${x + barW},${y1} ${x + barW},${y1 - r} V${y0} Z`;
              return (
                <g key={p.id}>
                  {v !== 0 && (
                    <path d={d} fill={v > 0 ? "var(--tw-confirm)" : "var(--tw-late)"} opacity={hover == null || hover === i ? 1 : 0.55} />
                  )}
                  {i % labelEvery === 0 && (
                    <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--tw-ink-2)">
                      {formatDay(p.due).slice(4)}
                    </text>
                  )}
                  {/* hit target bigger than the mark */}
                  <rect
                    x={padL + slot * i}
                    y={padT}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                    onPointerEnter={() => setHover(i)}
                    onPointerLeave={() => setHover((h) => (h === i ? null : h))}
                  />
                </g>
              );
            })}
            <line x1={padL} x2={width - padR} y1={y(0)} y2={y(0)} stroke="var(--tw-ctl-hi)" strokeWidth={1.5} />
          </svg>
        )}
        {active && hover != null && width > 0 && (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-[220px] rounded-md bg-raised px-2.5 py-1.5 text-[12.5px] leading-snug text-ink shadow-lg"
            style={{
              left: Math.min(Math.max(0, padL + slot * hover + slot / 2 - 90), Math.max(0, width - 200)),
              top: 0,
            }}
          >
            <span className="font-semibold">{active.title}</span>
            <br />
            <span className="text-ink-2">Due {formatDay(active.due)} · </span>
            <span className={active.onTime ? "text-ink" : "text-late"}>{fmtDays(active.daysEarly)}</span>
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>Finished requests, oldest first</caption>
        <thead>
          <tr>
            <th scope="col">Request</th>
            <th scope="col">Due</th>
            <th scope="col">Came in</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((p) => (
            <tr key={p.id}>
              <td>{p.title}</td>
              <td>{formatDay(p.due)}</td>
              <td>{fmtDays(p.daysEarly)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
