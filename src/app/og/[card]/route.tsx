import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";
import { getAppUrl } from "@/lib/app-url";
import { LINK_CARDS, type LinkCardKey } from "@/lib/link-cards";

/**
 * The picture chat apps show when someone pastes a portal link (Open Graph
 * image, 1200×630). The Title Wall in one frame: the night ground, the CCM
 * wordmark, a cover tile with the heading in Onest 800, one yellow action.
 * Built once at deploy; generic on purpose (no names, nothing from the link).
 */

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return (Object.keys(LINK_CARDS) as LinkCardKey[]).map((k) => ({ card: `${k}.png` }));
}

const C = {
  ground: BRAND.groundColor,
  tile: "#1b1d22",
  line: "#2a2d34",
  ink: BRAND.inkColor,
  ink2: "#a6aab3",
  acc: BRAND.primaryColor,
  accInk: BRAND.primaryInk,
};

const font = (w: number) => readFile(join(process.cwd(), "src/assets/fonts", `Onest-${w}.ttf`));

export async function GET(_req: Request, { params }: { params: Promise<{ card: string }> }) {
  const { card } = await params;
  const key = card.replace(/\.png$/, "") as LinkCardKey;
  const c = LINK_CARDS[key] ?? LINK_CARDS.default;
  const [w400, w600, w800] = await Promise.all([font(400), font(600), font(800)]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.ground, padding: "56px 64px", fontFamily: "Onest" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.035em", color: C.ink }}>{BRAND.name}</div>
          <div style={{ fontSize: 24, fontWeight: 400, color: C.ink2 }}>{new URL(getAppUrl()).host}</div>
        </div>
        <div
          style={{
            marginTop: 40,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: C.tile,
            borderRadius: 22,
            padding: "52px 56px 48px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* Word by word: the renderer widens a space after some letters in Onest */}
            <div style={{ display: "flex", flexWrap: "wrap", fontSize: c.heading.length > 26 ? 72 : 84, fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.035em", color: C.ink, maxWidth: 960 }}>
              {c.heading.split(" ").map((word, i) => (
                <span key={i} style={{ marginRight: "0.24em" }}>
                  {word}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 22, fontSize: 32, fontWeight: 400, lineHeight: 1.35, color: C.ink2, maxWidth: 900 }}>{c.line}</div>
          </div>
          <div style={{ display: "flex", marginTop: 28 }}>
            <div style={{ display: "flex", background: C.acc, color: C.accInk, borderRadius: 14, padding: "18px 30px", fontSize: 30, fontWeight: 600 }}>
              {c.action}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Onest", data: w400, weight: 400, style: "normal" },
        { name: "Onest", data: w600, weight: 600, style: "normal" },
        { name: "Onest", data: w800, weight: 800, style: "normal" },
      ],
    }
  );
}
