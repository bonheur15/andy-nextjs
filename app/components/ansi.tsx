import { memo } from "react";

type Style = {
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  strike?: boolean;
  fg?: number;
  bg?: number;
  fg256?: number;
  bg256?: number;
  trueFg?: [number, number, number];
  trueBg?: [number, number, number];
};

const BASE: Record<number, [number, number, number]> = {
  30: [72, 78, 89],
  31: [248, 81, 73],
  32: [63, 185, 80],
  33: [210, 153, 34],
  34: [88, 166, 255],
  35: [188, 140, 255],
  36: [57, 197, 207],
  37: [230, 237, 243],
};

const BRIGHT: Record<number, [number, number, number]> = {
  90: [110, 118, 129],
  91: [255, 123, 114],
  92: [86, 211, 100],
  93: [227, 179, 65],
  94: [121, 192, 255],
  95: [210, 168, 255],
  96: [86, 212, 221],
  97: [255, 255, 255],
};

const CUBE_STEPS = [0, 95, 135, 175, 215, 255];

function c256(n: number): [number, number, number] {
  if (n < 16) return BASE[n] ?? BRIGHT[n - 90] ?? [230, 237, 243];
  if (n < 232) {
    const i = n - 16;
    const r = Math.floor(i / 36);
    const g = Math.floor((i % 36) / 6);
    const b = i % 6;
    return [CUBE_STEPS[r], CUBE_STEPS[g], CUBE_STEPS[b]];
  }
  const v = 8 + (n - 232) * 10;
  return [v, v, v];
}

function baseColor(v: number): string {
  const c = BASE[v] ?? BRIGHT[v] ?? [230, 237, 243];
  return `rgb(${c.join(",")})`;
}

function color256(n: number): string {
  return `rgb(${c256(n).join(",")})`;
}

function applyCodes(style: Style, s: string): Style {
  const codes = s === "" ? [0] : s.split(";").map((c) => parseInt(c, 10));
  const next: Style = { ...style };
  let i = 0;
  while (i < codes.length) {
    const c = codes[i];
    if (c === 0) {
      Object.keys(next).forEach((k) => delete (next as Record<string, unknown>)[k]);
    } else if (c === 1) next.bold = true;
    else if (c === 2) next.dim = true;
    else if (c === 3) next.italic = true;
    else if (c === 4) next.underline = true;
    else if (c === 7) next.inverse = true;
    else if (c === 9) next.strike = true;
    else if (c === 22) {
      next.bold = false;
      next.dim = false;
    } else if (c === 23) next.italic = false;
    else if (c === 24) next.underline = false;
    else if (c === 27) next.inverse = false;
    else if (c === 39) next.fg = next.fg256 = next.trueFg = undefined;
    else if (c === 49) next.bg = next.bg256 = next.trueBg = undefined;
    else if (c >= 30 && c <= 37) next.fg = c;
    else if (c >= 40 && c <= 47) next.bg = c - 10;
    else if (c >= 90 && c <= 97) next.fg = c;
    else if (c >= 100 && c <= 107) next.bg = c - 10;
    else if (c === 38 || c === 48) {
      const t = c === 38 ? "fg" : "bg";
      if (codes[i + 1] === 5) {
        const n = codes[i + 2];
        if (t === "fg") next.fg256 = n;
        else next.bg256 = n;
        i += 2;
      } else if (codes[i + 1] === 2) {
        const [r, g, b] = codes.slice(i + 2, i + 5);
        if (t === "fg") next.trueFg = [r, g, b];
        else next.trueBg = [r, g, b];
        i += 4;
      }
    }
    i += 1;
  }
  return next;
}

type Tok =
  | { kind: "csi"; codes: string }
  | { kind: "text"; text: string };

const CSI_RE = /\x1b\[([0-9;:?]*)([A-Za-z])/g;

function tokenize(text: string): Tok[] {
  const toks: Tok[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  CSI_RE.lastIndex = 0;
  while ((m = CSI_RE.exec(text))) {
    if (m.index > last) toks.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[2] === "m") toks.push({ kind: "csi", codes: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) toks.push({ kind: "text", text: text.slice(last) });
  return toks;
}

type Run = { style: Style; text: string };

function buildLines(text: string): Run[][] {
  const lines: Run[][] = [];
  let cur: Run[] = [];
  let style: Style = {};
  for (const tok of tokenize(text)) {
    if (tok.kind === "csi") {
      style = applyCodes(style, tok.codes);
      continue;
    }
    const parts = tok.text.split("\n");
    parts.forEach((p, idx) => {
      if (idx > 0) {
        if (cur.length > 0) lines.push(cur);
        cur = [];
      }
      if (p.length > 0) cur.push({ style: { ...style }, text: p });
    });
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}

function styleToInline(s: Style): React.CSSProperties {
  const style: React.CSSProperties = {};
  const fg = s.trueFg
    ? `rgb(${s.trueFg.join(",")})`
    : s.fg256 !== undefined
      ? color256(s.fg256)
      : s.fg !== undefined
        ? baseColor(s.fg)
        : undefined;
  const bg = s.trueBg
    ? `rgb(${s.trueBg.join(",")})`
    : s.bg256 !== undefined
      ? color256(s.bg256)
      : s.bg !== undefined
        ? baseColor(s.bg)
        : undefined;
  if (fg) style.color = fg;
  if (bg) style.backgroundColor = bg;
  if (s.bold) style.fontWeight = 600;
  if (s.dim) style.opacity = 0.62;
  if (s.italic) style.fontStyle = "italic";
  if (s.underline) style.textDecoration = "underline";
  if (s.strike) style.textDecoration = "line-through";
  if (s.inverse) {
    style.backgroundColor = fg ?? "rgb(230,237,243)";
    style.color = bg ?? "rgb(13,17,23)";
    style.opacity = 1;
  }
  return style;
}

export const AnsiText = memo(function AnsiText({ text }: { text: string }) {
  const lines = buildLines(text);
  if (lines.length === 0) return null;
  return (
    <span className="ansi-block">
      {lines.map((runs, i) => (
        <span className="ansi-line" key={i}>
          {runs.map((r, j) => (
            <span key={j} style={styleToInline(r.style)}>
              {r.text}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
});
