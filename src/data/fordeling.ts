/**
 * Fordelingen i klassekartet og gruppegeneratoren (SPEC §4.11).
 *
 * Ren funksjon: elever, plasser (eller antall grupper), låser, regler,
 * innsats, kjønn, historikk, modus og frø inn — plassering og regler som
 * ikke kunne holdes ut. Ingen database og ingen klokke, så samme frø gir
 * alltid samme svar, og testene er deterministiske.
 *
 * Algoritmen: mange tilfeldige forsøk med straffepoeng for brudd på
 * ønskene, og så små bytter på det beste forsøket så lenge det blir bedre.
 * Låser og «hold fra hverandre» holdes alltid når det går — låser ved at
 * de aldri flyttes, og reglene ved en straff så stor at ingen ønsker veier
 * opp. Resten er ønsker med vekt.
 */

export type Fordelingselev = {
  id: string;
  kjonn: "j" | "g" | null;
  /** 0 (rødt) til 1 (grønt); 0,5 uten skår */
  innsats: number;
};

export type Fordelingsplass = {
  nr: number;
  x: number;
  y: number;
  /** pulten plassen hører til; samme pult = sitter sammen */
  pult: string;
};

export type Modus = "tilfeldig" | "spre" | "samle";

type Felles = {
  elever: Fordelingselev[];
  /** par som aldri skal dele pult eller gruppe */
  holdFra: [string, string][];
  /** «a|b» (sortert) → vekt fra tidligere oppsett; se `sammenFor` */
  historikk: Map<string, number>;
  modus: Modus;
  bland: boolean;
  unnga: boolean;
  frø: number;
  /** antall tilfeldige forsøk; 400 som standard */
  forsok?: number;
};

export type Brudd = {
  regel: "hold" | "bland" | "unnga" | "plass";
  tekst: string;
};

// ------------------------------------------------------------- tilfeldighet

/** Mulberry32: liten, rask og god nok, og helt bestemt av frøet. */
export function lagTilfeldig(frø: number): () => number {
  let a = frø >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stokk<T>(liste: T[], tilf: () => number): T[] {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(tilf() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const nokkel = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

// Vektene. «Hold fra hverandre» er så tung at ingen ønsker kan veie den opp.
const V_HOLD = 1000;
const V_BLAND = 2;
const V_UNNGA = 1.5;
const V_MODUS = 3;

// ------------------------------------------------------------------ plasser

/**
 * Plasser som regnes som «ved siden av» hverandre: samme pult, eller to
 * enkeltpulter rett ved siden av hverandre på samme rad.
 */
export function naboer(plasser: Fordelingsplass[]): [number, number][] {
  const ut: [number, number][] = [];
  for (let a = 0; a < plasser.length; a++)
    for (let b = a + 1; b < plasser.length; b++) {
      const p = plasser[a];
      const q = plasser[b];
      const sammePult = p.pult === q.pult;
      const inntil = Math.abs(p.y - q.y) <= 10 && Math.abs(p.x - q.x) <= 110;
      // Ved et gruppebord sitter alle sammen, men bare de nærmeste regnes
      // som naboer — ellers blir et bord på seks femten par.
      if (sammePult ? Math.hypot(p.x - q.x, p.y - q.y) <= 120 : inntil)
        ut.push([p.nr, q.nr]);
    }
  return ut;
}

export type Plassresultat = {
  /** elev → plassnummer */
  plass: Map<string, number>;
  /** elever som ikke fikk plass fordi rommet er for lite */
  utenPlass: string[];
  brudd: Brudd[];
  poeng: number;
};

export function fordelPlasser(
  inn: Felles & {
    plasser: Fordelingsplass[];
    /** elev → plassnummer; blir sittende */
    laste: Map<string, number>;
  },
): Plassresultat {
  const tilf = lagTilfeldig(inn.frø);
  const forsok = inn.forsok ?? 400;
  const plasser = [...inn.plasser].sort((a, b) => a.nr - b.nr);
  const n = plasser.length;
  const indeks = new Map(plasser.map((p, i) => [p.nr, i]));
  const elev = new Map(inn.elever.map((e) => [e.id, e]));

  // Låste elever på sine plasser — bare de som finnes og har en gyldig plass.
  const fast = new Array<string | null>(n).fill(null);
  for (const [id, nr] of inn.laste) {
    const i = indeks.get(nr);
    if (i !== undefined && elev.has(id) && fast[i] === null) fast[i] = id;
  }
  const lasteIder = new Set(fast.filter((x): x is string => x !== null));
  const frie = inn.elever.filter((e) => !lasteIder.has(e.id)).map((e) => e.id);
  const ledige = plasser.map((_, i) => i).filter((i) => fast[i] === null);

  const nabopar = naboer(plasser).map(
    ([a, b]) => [indeks.get(a)!, indeks.get(b)!] as const,
  );
  const hold = new Set(inn.holdFra.map(([a, b]) => nokkel(a, b)));

  function poeng(sete: (string | null)[]): number {
    let p = 0;
    for (const [a, b] of nabopar) {
      const x = sete[a];
      const y = sete[b];
      if (!x || !y) continue;
      const k = nokkel(x, y);
      if (hold.has(k)) p += V_HOLD;
      const ex = elev.get(x)!;
      const ey = elev.get(y)!;
      if (inn.bland && ex.kjonn && ex.kjonn === ey.kjonn) p += V_BLAND;
      if (inn.unnga) p += V_UNNGA * (inn.historikk.get(k) ?? 0);
      if (inn.modus === "spre")
        p += V_MODUS * (1 - Math.abs(ex.innsats - ey.innsats));
    }
    if (inn.modus === "samle" && n > 1) {
      // Lav innsats foran: straff lav innsats langt bak.
      for (let i = 0; i < n; i++) {
        const x = sete[i];
        if (!x) continue;
        p += V_MODUS * (1 - elev.get(x)!.innsats) * (i / (n - 1));
      }
    }
    return p;
  }

  function forsokEtt(): (string | null)[] {
    const sete = [...fast];
    const rekke = stokk(frie, tilf);
    const steder = stokk(ledige, tilf);
    rekke.forEach((id, i) => {
      if (i < steder.length) sete[steder[i]] = id;
    });
    return sete;
  }

  // Små bytter mellom to ulåste plasser så lenge det blir bedre.
  function klatre(sete: (string | null)[]): number {
    let p0 = poeng(sete);
    for (let runde = 0; runde < 30; runde++) {
      let bedre = false;
      for (let a = 0; a < ledige.length; a++)
        for (let b = a + 1; b < ledige.length; b++) {
          const i = ledige[a];
          const j = ledige[b];
          if (sete[i] === sete[j]) continue;
          [sete[i], sete[j]] = [sete[j], sete[i]];
          const p = poeng(sete);
          if (p < p0 - 1e-9) {
            p0 = p;
            bedre = true;
          } else [sete[i], sete[j]] = [sete[j], sete[i]];
        }
      if (!bedre) break;
    }
    return p0;
  }

  // Tilfeldige forsøk; hvert tjuende får klatre, så søket ikke blir sittende
  // fast i den første gode løsningen det finner.
  let best = forsokEtt();
  let bestP = klatre(best);
  for (let f = 1; f < forsok && bestP > 0; f++) {
    const s = forsokEtt();
    const p = f % 20 === 0 ? klatre(s) : poeng(s);
    if (p < bestP) {
      best = s;
      bestP = p;
    }
  }

  const plass = new Map<string, number>();
  best.forEach((id, i) => id && plass.set(id, plasser[i].nr));
  const utenPlass = inn.elever.map((e) => e.id).filter((id) => !plass.has(id));

  const brudd: Brudd[] = [];
  if (utenPlass.length > 0)
    brudd.push({
      regel: "plass",
      tekst: `${utenPlass.length} ${utenPlass.length === 1 ? "elev" : "elever"} fikk ikke plass. Rommet har ${n} plasser.`,
    });
  for (const [a, b] of nabopar) {
    const x = best[a];
    const y = best[b];
    if (x && y && hold.has(nokkel(x, y)))
      brudd.push({ regel: "hold", tekst: `${x}|${y}` });
  }
  if (inn.bland) {
    const n = nabopar.filter(([a, b]) => {
      const x = best[a] && elev.get(best[a]!);
      const y = best[b] && elev.get(best[b]!);
      return x && y && x.kjonn && x.kjonn === y.kjonn;
    }).length;
    if (n > 0)
      brudd.push({
        regel: "bland",
        tekst: `${n} par av samme kjønn sitter sammen.`,
      });
  }
  if (inn.unnga) {
    const n = nabopar.filter(([a, b]) => {
      const x = best[a];
      const y = best[b];
      return x && y && (inn.historikk.get(nokkel(x, y)) ?? 0) > 0;
    }).length;
    if (n > 0)
      brudd.push({
        regel: "unnga",
        tekst: `${n} par har sittet sammen før.`,
      });
  }
  return { plass, utenPlass, brudd, poeng: bestP };
}

// ------------------------------------------------------------------ grupper

/**
 * Størrelsene på gruppene: så like som mulig, og går det ikke opp, blir
 * noen én større. Ingen står alene — blir grupper på én, slås de sammen.
 */
export function gruppestorrelser(elever: number, antall: number): number[] {
  if (elever === 0) return [];
  let g = Math.max(1, Math.min(antall, elever));
  while (g > 1 && Math.floor(elever / g) < 2) g--;
  const base = Math.floor(elever / g);
  const ekstra = elever % g;
  return Array.from({ length: g }, (_, i) => base + (i < ekstra ? 1 : 0));
}

export type Gruppresultat = {
  /** elev-id-ene i hver gruppe */
  grupper: string[][];
  brudd: Brudd[];
  poeng: number;
};

export function fordelGrupper(
  inn: Felles & {
    antall: number;
    /** elev → gruppeindeks (0 …); blir i gruppa */
    laste: Map<string, number>;
  },
): Gruppresultat {
  const tilf = lagTilfeldig(inn.frø);
  const forsok = inn.forsok ?? 400;
  const storrelser = gruppestorrelser(inn.elever.length, inn.antall);
  const g = storrelser.length;
  const elev = new Map(inn.elever.map((e) => [e.id, e]));
  const hold = new Set(inn.holdFra.map(([a, b]) => nokkel(a, b)));

  // Låste først, i sin gruppe — så lenge det er plass i den.
  const fast: string[][] = storrelser.map(() => []);
  const lasteIder = new Set<string>();
  for (const [id, gi] of inn.laste)
    if (elev.has(id) && gi >= 0 && gi < g && fast[gi].length < storrelser[gi]) {
      fast[gi].push(id);
      lasteIder.add(id);
    }
  const frie = inn.elever.filter((e) => !lasteIder.has(e.id)).map((e) => e.id);

  function poeng(gr: string[][]): number {
    let p = 0;
    for (const gruppe of gr) {
      const es = gruppe.map((id) => elev.get(id)!);
      for (let a = 0; a < gruppe.length; a++)
        for (let b = a + 1; b < gruppe.length; b++) {
          const k = nokkel(gruppe[a], gruppe[b]);
          if (hold.has(k)) p += V_HOLD;
          if (inn.unnga) p += V_UNNGA * (inn.historikk.get(k) ?? 0);
        }
      if (inn.bland) {
        const j = es.filter((e) => e.kjonn === "j").length;
        const gu = es.filter((e) => e.kjonn === "g").length;
        // Alene av sitt kjønn i gruppa, eller en gruppe av bare ett kjønn.
        if ((j === 1 && gu >= 2) || (gu === 1 && j >= 2)) p += V_BLAND;
        if (j + gu >= 2 && (j === 0 || gu === 0)) p += V_BLAND;
      }
      if (es.length > 1 && inn.modus !== "tilfeldig") {
        const v = es.map((e) => e.innsats);
        if (inn.modus === "spre") {
          // Spre: både lav og høy i hver gruppe.
          p += V_MODUS * (1 - (Math.max(...v) - Math.min(...v)));
        } else {
          // Samle: likt nivå sammen. Summen av forskjellene mellom alle
          // par, så hvert bytte som hjelper, også synes.
          for (let a = 0; a < v.length; a++)
            for (let b = a + 1; b < v.length; b++)
              p += V_MODUS * Math.abs(v[a] - v[b]);
        }
      }
    }
    if (inn.modus === "spre" && gr.length > 1) {
      // Spre: gruppene skal også være like sterke.
      const snitt = gr.map(
        (x) =>
          x.reduce((s, id) => s + elev.get(id)!.innsats, 0) / (x.length || 1),
      );
      p += V_MODUS * (Math.max(...snitt) - Math.min(...snitt));
    }
    return p;
  }

  function forsokEtt(): string[][] {
    const gr = fast.map((x) => [...x]);
    let i = 0;
    for (const id of stokk(frie, tilf)) {
      while (gr[i].length >= storrelser[i]) i++;
      gr[i].push(id);
    }
    return gr;
  }

  // Bytt to ulåste elever i ulike grupper så lenge det blir bedre.
  function klatre(gr: string[][]): number {
    let p0 = poeng(gr);
    for (let runde = 0; runde < 30; runde++) {
      let bedre = false;
      for (let a = 0; a < g; a++)
        for (let b = a + 1; b < g; b++)
          for (let i = 0; i < gr[a].length; i++)
            for (let j = 0; j < gr[b].length; j++) {
              if (lasteIder.has(gr[a][i]) || lasteIder.has(gr[b][j])) continue;
              [gr[a][i], gr[b][j]] = [gr[b][j], gr[a][i]];
              const p = poeng(gr);
              if (p < p0 - 1e-9) {
                p0 = p;
                bedre = true;
              } else [gr[a][i], gr[b][j]] = [gr[b][j], gr[a][i]];
            }
      if (!bedre) break;
    }
    return p0;
  }

  let best = forsokEtt();
  let bestP = klatre(best);
  for (let f = 1; f < forsok && bestP > 0; f++) {
    const s = forsokEtt();
    const p = f % 20 === 0 ? klatre(s) : poeng(s);
    if (p < bestP) {
      best = s;
      bestP = p;
    }
  }

  const brudd: Brudd[] = [];
  for (const gruppe of best)
    for (let a = 0; a < gruppe.length; a++)
      for (let b = a + 1; b < gruppe.length; b++)
        if (hold.has(nokkel(gruppe[a], gruppe[b])))
          brudd.push({ regel: "hold", tekst: `${gruppe[a]}|${gruppe[b]}` });
  if (inn.unnga) {
    let n = 0;
    for (const gruppe of best)
      for (let a = 0; a < gruppe.length; a++)
        for (let b = a + 1; b < gruppe.length; b++)
          if ((inn.historikk.get(nokkel(gruppe[a], gruppe[b])) ?? 0) > 0) n++;
    if (n > 0)
      brudd.push({
        regel: "unnga",
        tekst: `${n} par har vært i gruppe sammen før.`,
      });
  }
  return { grupper: best, brudd, poeng: bestP };
}
