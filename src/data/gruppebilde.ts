/**
 * Gruppene til elevene: bilde (PNG, ARBEIDSLISTE 25.9) og tabell til Teams
 * (25.10). Alt her får bare `{ overskrift, grupper: [{ nr, farge, navn[] }] }`
 * — navnene som ferdige strenger, aldri elevobjekter. Slik kan innsats,
 * fravær, notater eller hvordan gruppene ble laget (Spre/Samle) ikke lekke
 * inn ved et uhell: de finnes ikke i det funksjonene ser.
 */

export type Gruppeut = { nr: number; farge: string; navn: string[] };
export type Gruppesett = {
  overskrift: string;
  grupper: Gruppeut[];
  /** «MFL2 · 6 grupper»; valgfritt */
  undertittel?: string;
  /** «21. oktober» i hjørnet; valgfritt */
  dato?: string;
};

export type Navnevalg = "fullt" | "fe" | "f";

/**
 * Navnene slik de skal stå: Fullt («Aksel Solberg»), Fornavn + E. («Aksel
 * S.», standard), eller Fornavn («Aksel», men «Aksel S.» når to i settet
 * heter det samme).
 */
export function navnelister(
  grupper: { fornavn: string; etternavn: string }[][],
  valg: Navnevalg,
): string[][] {
  const antall = new Map<string, number>();
  for (const g of grupper)
    for (const e of g) antall.set(e.fornavn, (antall.get(e.fornavn) ?? 0) + 1);
  const kort = (e: { fornavn: string; etternavn: string }) =>
    e.etternavn.trim() ? `${e.fornavn} ${e.etternavn.trim()[0]}.` : e.fornavn;
  return grupper.map((g) =>
    g.map((e) =>
      valg === "fullt"
        ? `${e.fornavn} ${e.etternavn}`.trim()
        : valg === "fe"
          ? kort(e)
          : (antall.get(e.fornavn) ?? 0) > 1
            ? kort(e)
            : e.fornavn,
    ),
  );
}

const hex = /^#[0-9a-f]{6}$/i;
const trygg = (f: string) => (hex.test(f) ? f : "#8a82a3");

/** Det tegnefunksjonen trenger av et lerret; i testene et opptak. */
export type Tegneflate = Pick<
  CanvasRenderingContext2D,
  | "fillStyle"
  | "font"
  | "textAlign"
  | "textBaseline"
  | "fillRect"
  | "fillText"
  | "measureText"
  | "beginPath"
  | "moveTo"
  | "arcTo"
  | "closePath"
  | "fill"
  | "save"
  | "restore"
  | "clip"
>;

export const BILDE_B = 1920;
export const BILDE_H = 1080;

/** Tegner gruppene på et 1920 × 1080-lerret, som eksempelet i lerretet. */
export function tegnGruppebilde(x: Tegneflate, sett: Gruppesett): void {
  const W = BILDE_B;
  const H = BILDE_H;
  const F = '"Geist", -apple-system, "Helvetica Neue", Arial, sans-serif';
  const gr = sett.grupper;
  const n = gr.length;
  x.fillStyle = "#ffffff";
  x.fillRect(0, 0, W, H);
  x.textBaseline = "alphabetic";
  x.textAlign = "left";
  x.fillStyle = "#241f33";
  x.font = `300 64px ${F}`;
  x.fillText(sett.overskrift || "Grupper", 96, 150);
  x.font = `400 30px ${F}`;
  x.fillStyle = "#8a82a3";
  if (sett.undertittel) x.fillText(sett.undertittel, 96, 200);
  if (sett.dato) {
    x.textAlign = "right";
    x.fillText(sett.dato, W - 96, 150);
    x.textAlign = "left";
  }
  if (n === 0) return;
  const kol = n <= 3 ? n : n <= 4 ? 2 : n <= 6 ? 3 : n <= 8 ? 4 : 5;
  const rader = Math.ceil(n / kol);
  const gap = 32;
  const top = 250;
  const bw = (W - 192 - gap * (kol - 1)) / kol;
  const bh = (H - top - 80 - gap * (rader - 1)) / rader;
  const rr = (px: number, py: number, w: number, h: number, r: number) => {
    x.beginPath();
    x.moveTo(px + r, py);
    x.arcTo(px + w, py, px + w, py + h, r);
    x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r);
    x.arcTo(px, py, px + w, py, r);
    x.closePath();
  };
  gr.forEach((g, i) => {
    const px = 96 + (i % kol) * (bw + gap);
    const py = top + Math.floor(i / kol) * (bh + gap);
    const f = trygg(g.farge);
    rr(px, py, bw, bh, 28);
    x.fillStyle = `${f}1f`;
    x.fill();
    x.save();
    rr(px, py, bw, bh, 28);
    x.clip();
    x.fillStyle = f;
    x.fillRect(px, py, bw, 78);
    x.restore();
    x.fillStyle = "#ffffff";
    x.font = `600 36px ${F}`;
    x.fillText(`Gruppe ${g.nr}`, px + 30, py + 52);
    const lh = Math.min(54, (bh - 110) / Math.max(4, g.navn.length));
    const fs = Math.min(36, lh * 0.7);
    x.fillStyle = "#241f33";
    x.font = `400 ${fs}px ${F}`;
    g.navn.forEach((t, j) => {
      let s = t;
      while (x.measureText(s).width > bw - 60 && s.length > 3)
        s = `${s.slice(0, -2)}…`;
      x.fillText(s, px + 30, py + 100 + lh * (j + 0.75));
    });
  });
}

const esc = (t: string) =>
  t.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );

/**
 * Til Teams (25.10): overskrift i fet, så tabell «Gruppe | Elever» med et
 * fargekvadrat foran «Gruppe n». Samme mønster som tidsplanen i Samtaler.
 */
export function gruppeTeams(sett: Gruppesett): { html: string; tekst: string } {
  const tittel = sett.overskrift || "Grupper";
  const html =
    `<meta charset="utf-8"><p><strong>${esc(tittel)}</strong></p>` +
    `<table><thead><tr><th>Gruppe</th><th>Elever</th></tr></thead><tbody>` +
    sett.grupper
      .map(
        (g) =>
          `<tr><td><span style="color:${trygg(g.farge)}">■</span> Gruppe ${g.nr}</td>` +
          `<td>${g.navn.map(esc).join(", ")}</td></tr>`,
      )
      .join("") +
    `</tbody></table>`;
  const tekst =
    `${tittel}\n\n` +
    sett.grupper.map((g) => `Gruppe ${g.nr}: ${g.navn.join(", ")}`).join("\n");
  return { html, tekst };
}
