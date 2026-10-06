import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useArk } from "../ui/Arkstabel";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import type { Skolear } from "../data/skolear";
import { hentInnstilling, settInnstilling } from "../data/skolear";
import type { FagIAr } from "../data/fag";
import { hentElever, type ElevRad } from "../data/elever";
import {
  hentOktvalg,
  hentVurderinger,
  type Oktvalg,
  type Vurdering,
} from "../data/vurderinger";
import {
  antallEnheter,
  delIGrupper,
  delPaDager,
  endreSamtaledag,
  enhetId,
  flyttTilEnhet,
  medlemmerAv,
  samlePaTid,
  finnLunsj,
  fjernDagFraOkt,
  leggDagIOkt,
  settTrekningensVurdering,
  slettTrekning,
  settMotte,
  flyttInnenDagen,
  flyttMellomDager,
  somMarkdown,
  somTeamsHtml,
  hentHistorikk,
  hentSamtaledager,
  hentSamtaler,
  kapasitet,
  lagreTrekning,
  leggUtDagen,
  merknad,
  opprettSamtaledag,
  slettSamtaledag,
  stokk,
  tildelTema,
  trekkOmRekkefolge,
  trekkOmTema,
  tilKlokke,
  tilMin,
  timerPaDagen,
  vektetRekkefolge,
  type Eksportdag,
  type Plassering,
  type Samtaledag,
} from "../data/samtale";
import { invoke } from "@tauri-apps/api/core";
import { mentorStatus, publiserMentor } from "../data/caldav";
import { hentNotatPerElev, type Elevnotat } from "../data/elevnotat";
import { Bryter, Fagfirkant, Ikon, Kappet, Tomtilstand } from "../ui/felles";
import { blokkering, rodekart, type Fridag } from "../data/kalender";
import { hentFridager } from "../data/skolear";
import { IVerktoylinja } from "../ui/Verktoylinje";
import { Utfold } from "../ui/Utfold";
import { useApen } from "../ui/Sammenleggbar";
import { Samtalenotat } from "./Samtalenotat";
import { TEMATEKST, temafarge } from "../ui/farger";

/**
 * Samtaletrekkeren, SPEC §4.10.
 *
 * Én sammenhengende kolonne til venstre og resultatet til høyre. Ingen faner,
 * ingen steg, ingen veiviser — alt som styrer trekningen er synlig samtidig.
 */

export type Modus = "fag" | "mentor";

/** Datatypen når et navn dras ut av en gruppe (ikke hele raden). */
const ELEVDRAG = "application/x-okta-elev";
type Visning = "timeplan" | "fordeling" | "alfabetisk";

/** En dag slik den vises i timeplanen. */
type Dagplan = {
  dag: Samtaledag;
  /** Utledes av hullet mellom to samtaler — lagres ikke som egen rad. */
  lunsj: { fra: string; til: string } | null;
  rader: {
    /** raden i basen, når trekningen er lagret */
    samtaleId: string | null;
    /** eleven — eller gruppa, som én enhet (se `enhetId`) */
    elevId: string;
    /** navnene, kommaseparert når det er en gruppe */
    navn: string;
    /** elevene på plassen: én, eller flere i en gruppesamtale */
    medlemmer: { id: string; navn: string }[];
    tema: string | null;
    fra: string;
    til: string;
    motte: boolean;
  }[];
};

/** Standardverdier for en ny dag (§4.10). */
const NY_DAG = { fra: "08:30", til: "15:00", lunsjFra: "11:45", lunsjMin: 30 };

/**
 * Temalista har ingen egen tabell — `samtale.tema` lagrer resultatet, ikke
 * oppsettet. Den ligger derfor i `innstilling`, per fag, som kolonnevalgene.
 */
const temanokkel = (fagId: string) => `samtale_temaer_${fagId}`;

export function Samtaler({
  skolear,
  fag,
  startFagId,
  onEndret,
}: {
  skolear: Skolear;
  fag: FagIAr[];
  /**
   * Trekningen som åpnes: et fag (fra sidemenyen eller en muntlig
   * vurdering), eller «mentor» for mentorsamtalene.
   */
  startFagId?: string;
  /** samtaledagene er endret — sidemenyens liste skal oppdateres */
  onEndret?: () => void;
}) {
  const [modus, setModus] = useState<Modus>(
    startFagId === "mentor" ? "mentor" : "fag",
  );
  const [fagId, setFagId] = useState(
    startFagId && startFagId !== "mentor" && startFagId !== "ny"
      ? startFagId
      : (fag[0]?.id ?? ""),
  );
  // «+ Ny trekning» i sidemenyen: start på det første faget som ikke har
  // samtaledager ennå.
  useEffect(() => {
    if (startFagId !== "ny") return;
    void hentSamtaledager(skolear.id).then((alle) => {
      const ledig = fag.find((f) => !alle.some((d) => d.skolearFagId === f.id));
      if (ledig) setFagId(ledig.id);
    });
  }, []);
  const [samtaletid, setSamtaletid] = useState("20");
  const [pause, setPause] = useState("5");
  const [temaer, setTemaer] = useState<string[]>([]);
  const [dager, setDager] = useState<Samtaledag[]>([]);
  const [elever, setElever] = useState<ElevRad[]>([]);
  const [egenListe, setEgenListe] = useState("");
  const [brukEgen, setBrukEgen] = useState(false);
  const [historikk, setHistorikk] = useState<Map<string, Plassering[]>>(
    new Map(),
  );
  // Vektingen er av som standard. Ren tilfeldighet er normaltilstanden (§4.10).
  const [vekting, setVekting] = useState(false);
  const [trekning, setTrekning] = useState<Dagplan[] | null>(null);
  const [lagret, setLagret] = useState(true);
  // De to hovedlåsene overlever en ny generering — de er en arbeidsmåte man
  // har valgt. Elevlåsene nullstilles, siden en ny trekning er en ny start
  // for enkeltvalgene (§4.10).
  const [lastTema, setLastTema] = useState(false);
  const [lastRekkefolge, setLastRekkefolge] = useState(false);
  const [lasteElever, setLasteElever] = useState<Set<string>>(new Set());
  const [dragmelding, setDragmelding] = useState<string | null>(null);
  const [visning, setVisning] = useState<Visning>("timeplan");
  const [kopiert, setKopiert] = useState<"teams" | "md" | null>(null);
  const [notater, setNotater] = useState<Map<string, Elevnotat>>(new Map());
  // Samtalen som har notatvinduet åpent (et klikk på navnet i timeplanen).
  // Oppsettkolonnen: framme mens trekningen settes opp, skjult når den er
  // trukket — til «Rediger» (7.4). null = ikke lastet ennå.
  const [redigerer, setRedigerer] = useState<boolean | null>(null);
  const [notatFor, setNotatFor] = useState<{
    rad: Dagplan["rader"][number];
    dag: Samtaledag;
  } | null>(null);
  const [kalender, setKalender] = useState<Awaited<
    ReturnType<typeof mentorStatus>
  > | null>(null);
  const [publiserer, setPubliserer] = useState(false);
  const [vurderinger, setVurderinger] = useState<Vurdering[]>([]);
  // Hvor mange som har samtale sammen: 1 = enkeltvis, 2 = par, osv.
  // Huskes per fag, og for mentorsamtalene for seg.
  const [storrelse, setStorrelse] = useState(1);
  const storrelseNokkel =
    modus === "mentor"
      ? "samtale_storrelse_mentor"
      : `samtale_storrelse_${fagId}`;
  // Fagets økter, til avkrysningen. Samtalene legges i øktene (§4.10).
  const [oktvalg, setOktvalg] = useState<Oktvalg[]>([]);
  // Vurderingen trekningen hører til. Står på dagene i basen, men må kunne
  // velges før noen dag finnes — da øktene krysses av etterpå.
  const [valgtVurdering, setValgtVurdering] = useState("");
  // Vurderingen som ble valgt sammen med et nytt fag. Faget lastes først,
  // og da skal vurderingen stå valgt — ikke nullstilles av at faget ennå
  // ikke har noen samtaledager.
  const venterVurdering = useRef<string | null>(null);
  // Fridager og røde dager, så en økt som kolliderer med noe står i rødt.
  const [fridager, setFridager] = useState<Fridag[]>([]);
  const rode = useMemo(
    () => rodekart(skolear.start, skolear.slutt),
    [skolear.start, skolear.slutt],
  );

  const minutter = Number(samtaletid) || 20;
  const pausen = Number(pause) || 0;

  /**
   * Temaene som faktisk gjelder.
   *
   * Mentorsamtalen har ikke oppgavenummer (§4.10). Lista over temaer lastes
   * bare i fagmodus, så den blir stående med forrige fags verdier når man
   * bytter — og da delte trekningen dem ut i mentormodus også. Modus leses
   * derfor ut her, ett sted, så de to trekningsveiene ikke kan komme i utakt.
   */
  const aktiveTemaer =
    modus === "fag" ? temaer.filter((t) => t.trim() !== "") : [];

  async function last() {
    setElever(await hentElever(skolear.id));
    setFridager(await hentFridager(skolear.id));
    setHistorikk(await hentHistorikk(skolear.id));

    const alle = await hentSamtaledager(skolear.id);
    const mine = alle.filter((d) =>
      modus === "mentor" ? d.skolearFagId === null : d.skolearFagId === fagId,
    );
    setDager(mine);

    // Er det allerede trukket på disse dagene, vises det som står i basen.
    const lagrede: Dagplan[] = [];
    for (const dag of mine) {
      const samtaler = await hentSamtaler(dag.id);
      if (samtaler.length === 0) continue;
      const tider = samtaler.map((s) => ({
        fra: s.klokkeslett,
        til: tilKlokke(tilMin(s.klokkeslett) + s.varighetMin),
      }));
      // Elever på samme klokkeslett er én gruppesamtale. De samles igjen til
      // én plass, slik de ble trukket.
      lagrede.push({
        dag,
        lunsj: finnLunsj(tider, dag),
        rader: samlePaTid(samtaler).map((gr) => {
          const s = gr[0];
          const medlemmer = gr.map((x) => ({
            id: x.elevId,
            navn: `${x.fornavn} ${x.etternavn}`,
          }));
          return {
            samtaleId: s.id,
            elevId: enhetId(gr.map((x) => x.elevId)),
            navn: medlemmer.map((m) => m.navn).join(", "),
            medlemmer,
            // En dag uten fag har ingen oppgave. Sto det likevel noe der fra
            // før, er det spor etter feilen over, og det skal ikke vises.
            tema: dag.skolearFagId === null ? null : s.tema,
            fra: s.klokkeslett,
            til: tilKlokke(tilMin(s.klokkeslett) + s.varighetMin),
            motte: gr.every((x) => x.motte),
          };
        }),
      });
    }
    setTrekning(lagrede.length > 0 ? lagrede : null);
    // Første gang trekningen lastes: oppsettet framme bare hvis den ikke er
    // trukket. Etterpå står valget — Generer skal ikke skjule oppsettet.
    setRedigerer((r) => r ?? lagrede.length === 0);
    setNotater(await notaterFor(lagrede));
    setKalender(await mentorStatus(skolear));
    setVurderinger(await hentVurderinger(skolear.id));
    setLagret(true);

    if (modus === "fag") {
      setOktvalg(await hentOktvalg(fagId));
      setValgtVurdering(
        mine.find((d) => d.vurderingId)?.vurderingId ??
          venterVurdering.current ??
          "",
      );
      venterVurdering.current = null;
    }

    // I mentormodus ligger én dag klar med én gang, så datofeltet er fremme
    // og ikke gjemt bak en «legg til»-lenke. I fagmodus velges øktene.
    if (mine.length === 0 && modus === "mentor") {
      await opprettSamtaledag(skolear.id, {
        skolearFagId: modus === "mentor" ? null : fagId,
        dato: "",
        ...NY_DAG,
      });
      const etter = await hentSamtaledager(skolear.id);
      setDager(
        etter.filter((d) =>
          modus === "mentor"
            ? d.skolearFagId === null
            : d.skolearFagId === fagId,
        ),
      );
    }
    onEndret?.();
  }

  useEffect(() => {
    void last();
  }, [skolear.id, modus, fagId]);

  useEffect(() => {
    void hentInnstilling(storrelseNokkel).then((v) =>
      setStorrelse(v ? Math.max(1, Number(v) || 1) : 1),
    );
  }, [storrelseNokkel]);

  useEffect(() => {
    if (modus !== "fag" || !fagId) return;
    void hentInnstilling(temanokkel(fagId)).then((v) =>
      setTemaer(v ? (JSON.parse(v) as string[]) : []),
    );
  }, [modus, fagId]);

  function lagreTemaer(nye: string[]) {
    setTemaer(nye);
    if (modus === "fag" && fagId) {
      void settInnstilling(temanokkel(fagId), JSON.stringify(nye));
    }
  }

  /** Elevene trekningen gjelder — fra appen, eller fra lista du limte inn. */
  // Elevene som er tatt ut av samtalene (DESIGN §10: alle eller noen
  // utvalgte). Lagret per fag, og for mentorsamtalene for seg. Lista er de
  // som er tatt UT, så en ny elev i faget kommer med av seg selv.
  const [utelatt, setUtelatt] = useState<Set<string>>(new Set());
  const [velgElever, setVelgElever] = useState(false);
  const utvalgNokkel = `samtale_utelatt_${modus === "mentor" ? "mentor" : fagId}`;
  useEffect(() => {
    void hentInnstilling(utvalgNokkel).then((v) =>
      setUtelatt(new Set(v ? (JSON.parse(v) as string[]) : [])),
    );
  }, [utvalgNokkel]);
  function settUtelatt(ny: Set<string>) {
    setUtelatt(ny);
    void settInnstilling(utvalgNokkel, JSON.stringify([...ny]));
  }

  const alleDeltakere = useMemo(() => {
    if (brukEgen) {
      return egenListe
        .split("\n")
        .map((n) => n.trim())
        .filter((n) => n !== "")
        .map((navn, i) => ({ id: `limt-${i}`, navn }));
    }
    const passer =
      modus === "mentor"
        ? (e: ElevRad) => e.mentor
        : (e: ElevRad) => e.fagIder.includes(fagId);
    return elever
      .filter(passer)
      .map((e) => ({ id: e.id, navn: `${e.fornavn} ${e.etternavn}` }));
  }, [brukEgen, egenListe, elever, modus, fagId]);

  const deltakere = useMemo(
    () =>
      brukEgen
        ? alleDeltakere
        : alleDeltakere.filter((d) => !utelatt.has(d.id)),
    [alleDeltakere, utelatt, brukEgen],
  );

  /** Legger ut dagene og bygger radene som vises. */
  function byggPlan(
    perDag: string[][],
    temakart: Map<string, string>,
  ): Dagplan[] {
    const navn = new Map(deltakere.map((d) => [d.id, d.navn]));
    const plan: Dagplan[] = [];

    dager.forEach((dag, i) => {
      const paDagen = perDag[i] ?? [];
      if (paDagen.length === 0) return;

      const alle = leggUtDagen(dag, paDagen.length, minutter, pausen);
      const lunsjslot = alle.find((s) => s.type === "lunsj");
      const slots = alle.filter((s) => s.type === "samtale");
      plan.push({
        dag,
        lunsj: lunsjslot
          ? { fra: tilKlokke(lunsjslot.fra), til: tilKlokke(lunsjslot.til) }
          : null,
        rader: slots.map((s, j) => {
          const medlemmer = medlemmerAv(paDagen[j]).map((id) => ({
            id,
            navn: navn.get(id) ?? "",
          }));
          return {
            samtaleId: null,
            elevId: paDagen[j],
            navn: medlemmer.map((m) => m.navn).join(", "),
            medlemmer,
            tema: temakart.get(paDagen[j]) ?? null,
            fra: tilKlokke(s.fra),
            til: tilKlokke(s.til),
            motte: true,
          };
        }),
      });
    });
    return plan;
  }

  /**
   * Skriver trekningen.
   *
   * Innlimte elever finnes ikke i basen, og samtale.elev_id har fremmednøkkel
   * til elev — da vises trekningen uten å lagres, tydelig merket. Å gjøre
   * innlimingen ubrukelig ville vært verre.
   */
  async function skriv(plan: Dagplan[]) {
    setTrekning(plan);

    if (brukEgen) {
      setLagret(false);
      return;
    }

    for (const d of plan) {
      // En gruppe pakkes ut: hver elev får sin rad, på samme klokkeslett.
      await lagreTrekning(
        d.dag.id,
        d.rader.flatMap((r) =>
          medlemmerAv(r.elevId).map((elevId) => ({
            elevId,
            klokkeslett: r.fra,
            varighetMin: minutter,
            tema: r.tema,
          })),
        ),
      );
    }
    setLagret(true);
    // Les tilbake fra basen: da får radene sine ekte id-er, og oversikten
    // over planlagte samtaler får riktig antall. Uten dette sto den igjen
    // med «ikke trukket» etter en trekning.
    await last();
  }

  /**
   * Flytter en rad, innen dagen eller til en annen dag.
   *
   * Klokkeslettene står der de står — det er elevene som flyttes mellom dem.
   * `fra` og `til` er plasser i den viste timeplanen, som hopper over dager
   * uten elever; de oversettes her til dagslista, som `byggPlan` leser.
   */
  async function flytt(
    fra: { dag: number; rad: number },
    til: { dag: number; rad: number; etter: boolean },
  ) {
    if (!trekning) return;

    const perDag = dager.map(
      (d) =>
        trekning.find((p) => p.dag.id === d.id)?.rader.map((r) => r.elevId) ??
        [],
    );
    const idx = (planIdx: number) =>
      dager.findIndex((d) => d.id === trekning[planIdx]?.dag.id);
    const fraDag = idx(fra.dag);
    const tilDag = idx(til.dag);
    if (fraDag < 0 || tilDag < 0) return;

    let nye = perDag;
    if (fraDag === tilDag) {
      nye[fraDag] = flyttInnenDagen(perDag[fraDag], fra.rad, til.rad);
    } else {
      const svar = flyttMellomDager(
        perDag,
        kapasiteter,
        { dag: fraDag, rad: fra.rad },
        { dag: tilDag, rad: til.rad, etter: til.etter },
      );
      nye = svar.perDag;
      if (svar.byttet) {
        const navn = new Map(deltakere.map((d) => [d.id, d.navn]));
        const flyttet = perDag[fraDag][fra.rad];
        setDragmelding(
          `Dagen var full, så ${navn.get(flyttet) ?? "eleven"} og ${navn.get(svar.byttet) ?? "eleven"} byttet plass.`,
        );
        setTimeout(() => setDragmelding(null), 6000);
      }
    }

    const na = new Map<string, string>();
    for (const d of trekning) {
      for (const r of d.rader) if (r.tema) na.set(r.elevId, r.tema);
    }
    await skriv(byggPlan(nye, na));
  }

  /**
   * Flytter én elev fra sin gruppe over i en annen — den manuelle justeringen
   * av gruppene. Temaet og låsen følger plassen, ikke eleven.
   */
  async function flyttElev(elevId: string, dagIdx: number, radIdx: number) {
    if (!trekning) return;
    const perDag = dager.map(
      (d) =>
        trekning.find((p) => p.dag.id === d.id)?.rader.map((r) => r.elevId) ??
        [],
    );
    const tilDag = dager.findIndex((d) => d.id === trekning[dagIdx]?.dag.id);
    if (tilDag < 0) return;

    const { perDag: nye, nyId } = flyttTilEnhet(perDag, elevId, {
      dag: tilDag,
      rad: radIdx,
    });
    if (nyId.size === 0) return;

    const tema = new Map<string, string>();
    for (const d of trekning)
      for (const r of d.rader)
        if (r.tema) tema.set(nyId.get(r.elevId) ?? r.elevId, r.tema);
    setLasteElever((l) => new Set([...l].map((id) => nyId.get(id) ?? id)));
    await skriv(byggPlan(nye, tema));
  }

  /**
   * Notatene for en trekning, slått opp på elev per dag.
   *
   * Nøkkelen er `elevId` fordi en elev bare har én rad per dag i praksis, og
   * fordi oppslaget da også finner notater skrevet på elevsiden.
   */
  async function notaterFor(plan: Dagplan[]): Promise<Map<string, Elevnotat>> {
    const ut = new Map<string, Elevnotat>();
    for (const d of plan) {
      const funnet = await hentNotatPerElev(
        d.rader.map((r) => r.elevId),
        d.dag.dato,
      );
      for (const [elevId, notat] of funnet) ut.set(elevId, notat);
    }
    return ut;
  }

  async function publiser() {
    setPubliserer(true);
    try {
      await publiserMentor(skolear);
      setKalender(await mentorStatus(skolear));
      setVurderinger(await hentVurderinger(skolear.id));
    } catch (feil) {
      setDragmelding(`Publiseringen feilet: ${String(feil)}`);
    } finally {
      setPubliserer(false);
    }
  }

  /** Formen eksportene arbeider på. */
  function tilEksport(): Eksportdag[] {
    return (trekning ?? []).map((d) => ({
      dato: d.dag.dato,
      lunsj: d.lunsj,
      rader: d.rader.map((r) => ({
        navn: r.navn,
        tema: r.tema,
        fra: r.fra,
        til: r.til,
        motte: r.motte,
      })),
    }));
  }

  async function tilMarkdown() {
    await navigator.clipboard.writeText(
      somMarkdown(tilEksport(), modus === "fag"),
    );
    setKopiert("md");
    setTimeout(() => setKopiert(null), 1500);
  }

  async function tilTeams() {
    const html = somTeamsHtml(tilEksport(), modus === "fag");
    // Teams tar imot formatert tabell når den limes som text/html.
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([somMarkdown(tilEksport(), modus === "fag")], {
          type: "text/plain",
        }),
      }),
    ]);
    setKopiert("teams");
    setTimeout(() => setKopiert(null), 1500);
  }

  /**
   * Sletter en planlagt trekning — alle dagene og samtalene. Spør først, og
   * sier hva som forsvinner.
   */
  async function slettPlan(dagene: Samtaledag[], navn: string) {
    const antall = dagene.reduce((n, d) => n + d.antall, 0);
    const iOkter = dagene.some((d) => d.oktId);
    if (
      !(await bekreft(
        `Slette de planlagte samtalene i ${navn}?\n\n` +
          `${dagene.length} ${dagene.length === 1 ? "dag" : "dager"}` +
          (antall > 0 ? ` og ${antall} samtaler` : "") +
          " forsvinner." +
          (iOkter ? " Vurderingen løses fra øktene samtalene lå i." : "") +
          "\n\nSikkerhetskopien fra i dag er veien tilbake.",
      ))
    )
      return;
    await slettTrekning(dagene);
    setTrekning(null);
    await last();
  }

  /** Helt ny trekning. Fordeler på nytt over dagene, og løser opp elevlåsene. */
  async function generer() {
    if (
      trekning &&
      !(await bekreft(
        "Generer ny trekning?\n\nDen som ligger nå blir erstattet, og låsene på enkeltelever løses opp.",
      ))
    )
      return;

    const ider = deltakere.map((d) => d.id);
    const ordnet = vekting ? vektetRekkefolge(ider, historikk) : stokk(ider);
    // Gruppene settes sammen av den trukne rekkefølgen, så de er tilfeldige
    // de også. Hver gruppe er én plass i timeplanen.
    const enheter = delIGrupper(ordnet, storrelse).map(enhetId);

    setLasteElever(new Set());
    await skriv(
      byggPlan(
        delPaDager(enheter, kapasiteter),
        tildelTema(enheter, aktiveTemaer),
      ),
    );
  }

  /**
   * Trekker om innenfor den fordelingen som allerede er gjort.
   *
   * Låsene bestemmer hva som faktisk endres. Er begge på, skjer ingenting —
   * og da sier hjelpeteksten det, framfor at knappen ser ut til å virke.
   */
  async function trekkPaNytt() {
    if (!trekning) return generer();
    if (lastTema && lastRekkefolge) return;

    const perDag = trekning.map((d) => d.rader.map((r) => r.elevId));
    const na = new Map<string, string>();
    for (const d of trekning) {
      for (const r of d.rader) if (r.tema) na.set(r.elevId, r.tema);
    }

    const nyPerDag = lastRekkefolge
      ? perDag
      : trekkOmRekkefolge(perDag, lasteElever);

    const nyttTema = lastTema
      ? na
      : trekkOmTema(perDag.flat(), na, lasteElever, aktiveTemaer);

    await skriv(byggPlan(nyPerDag, nyttTema));
  }

  const kapasiteter = dager.map((d) => kapasitet(d, minutter, pausen));
  const samletKapasitet = kapasiteter.reduce((a, b) => a + b, 0);
  // Plassene som trengs: én per elev, eller én per gruppe.
  const visOppsett = redigerer ?? true;
  const plasserTrengs = antallEnheter(deltakere.length, storrelse);
  const plassord = storrelse > 1 ? "grupper" : "elever";
  const timer = dager.reduce((sum, d) => sum + timerPaDagen(d), 0);
  // Elevene som ikke fikk plass i trekningen, når kapasiteten ikke rakk.
  const plassert = new Set(
    (trekning ?? []).flatMap((d) =>
      d.rader.flatMap((r) => r.medlemmer.map((m) => m.id)),
    ),
  );
  const utenPlass =
    trekning === null ? [] : deltakere.filter((d) => !plassert.has(d.id));

  return (
    <div className="flex min-h-0 w-full flex-1 overflow-clip">
      {notatFor && notatFor.rad.samtaleId && (
        <Samtalenotat
          key={notatFor.rad.samtaleId}
          elevId={notatFor.rad.elevId}
          navn={notatFor.rad.navn}
          tid={`${storForbokstav(langDato(notatFor.dag.dato))} · ${notatFor.rad.fra}–${notatFor.rad.til}`}
          oppgave={
            notatFor.rad.tema
              ? {
                  nr:
                    temaer.indexOf(notatFor.rad.tema) >= 0
                      ? temaer.indexOf(notatFor.rad.tema) + 1
                      : null,
                  tema: notatFor.rad.tema,
                  farge:
                    temaer.indexOf(notatFor.rad.tema) >= 0
                      ? temafarge(temaer.indexOf(notatFor.rad.tema) + 1)
                      : undefined,
                }
              : null
          }
          samtaleId={notatFor.rad.samtaleId}
          dag={notatFor.dag}
          notat={(() => {
            // Dagens notat på eleven, men aldri et fra en annen fags samtale
            // samme dag — da ville vinduet skrevet over feil notat.
            const n = notater.get(notatFor.rad.elevId);
            return n &&
              (n.samtaleId === notatFor.rad.samtaleId ||
                n.skolearFagId === notatFor.dag.skolearFagId ||
                n.skolearFagId === null)
              ? n
              : null;
          })()}
          vurdering={(() => {
            const v =
              modus === "fag"
                ? vurderinger.find((x) => x.id === valgtVurdering)
                : undefined;
            return v
              ? { id: v.id, skalaId: v.skalaId, tittel: v.tittel }
              : null;
          })()}
          vurderingsvalg={
            modus === "fag"
              ? vurderinger
                  .filter((v) => v.skolearFagId === fagId)
                  .map((v) => ({ id: v.id, tittel: v.tittel }))
              : []
          }
          onVelgVurdering={async (id) => {
            setValgtVurdering(id);
            await settTrekningensVurdering(dager, id);
            await last();
          }}
          onLukk={async () => {
            setNotatFor(null);
            setNotater(await notaterFor(trekning ?? []));
          }}
        />
      )}
      {/*
        Oppsettskolonnen. Én sammenhengende kolonne med sin egen rullesone —
        ingen faner, ingen steg. Alt som styrer trekningen er synlig samtidig,
        i blokker skilt med en linje (DESIGN.md §10).
      */}
      {visOppsett && (
        <div className="flex w-[18rem] shrink-0 flex-col overflow-clip border-r border-linje-medium pr-5 xl:w-[22rem] xl:pr-6">
          <div className="min-h-0 flex-1 divide-y divide-linje-medium overflow-auto pr-1 [&>*]:py-5 [&>*:first-child]:pt-0">
            <div>
              <Bryter
                verdi={modus}
                settVerdi={(v) => setModus(v as Modus)}
                fyll
                valg={[
                  { id: "fag", navn: "Fagsamtale" },
                  { id: "mentor", navn: "Mentorsamtale" },
                ]}
              />
              {modus === "mentor" && (
                <p className="mt-2 text-liten text-blekk-dempet">
                  Mentorsamtalen hører ikke til noe fag. Elevene er
                  mentorelevene dine i år.
                </p>
              )}
            </div>

            {/*
            Vurderingen trekningen hører til — og med den faget. Uten den
            vises ikke oppgaven eleven fikk under selve vurderingen (§4.6),
            og den står ikke på øktene i årsplanen.
          */}
            {modus === "fag" && (
              <Bolk tittel="Vurdering">
                <select
                  value={`${fagId}|${valgtVurdering}`}
                  onChange={async (e) => {
                    const [nyttFag, vurdering] = e.target.value.split("|");
                    if (nyttFag !== fagId) {
                      venterVurdering.current = vurdering;
                      setFagId(nyttFag);
                      return;
                    }
                    setValgtVurdering(vurdering);
                    await settTrekningensVurdering(dager, vurdering || null);
                    await last();
                  }}
                  className="h-[2.4em] w-full rounded-vanlig border border-linje bg-ark px-2.5 text-brod"
                >
                  {fag.map((f) => (
                    <optgroup key={f.id} label={`${f.kode} — ${f.navn}`}>
                      {vurderinger
                        .filter((v) => v.skolearFagId === f.id)
                        .map((v) => (
                          <option key={v.id} value={`${f.id}|${v.id}`}>
                            {v.tittel} ({f.kode})
                          </option>
                        ))}
                      <option value={`${f.id}|`}>
                        Uten vurdering ({f.kode})
                      </option>
                    </optgroup>
                  ))}
                </select>
              </Bolk>
            )}

            <Bolk tittel="Samtalene">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="mb-1 block text-liten text-blekk-dempet">
                    Elever
                  </span>
                  {/* Et klikk viser lista, og der velges alle eller noen. */}
                  <button
                    onClick={() => setVelgElever((v) => !v)}
                    disabled={brukEgen}
                    aria-expanded={velgElever}
                    title={
                      brukEgen ? undefined : "Velg hvem som skal ha samtale"
                    }
                    className={`flex h-[2.4em] w-full items-center justify-between rounded-vanlig border bg-ark px-2.5 text-brod tabular-nums disabled:bg-flate-svak ${
                      velgElever
                        ? "border-aksent"
                        : "border-linje hover:border-linje-sterk"
                    }`}
                  >
                    <span>
                      {deltakere.length}
                      {deltakere.length < alleDeltakere.length && (
                        <span className="text-liten text-blekk-dempet">
                          {" "}
                          av {alleDeltakere.length}
                        </span>
                      )}
                    </span>
                    {!brukEgen && (
                      <span
                        aria-hidden
                        className={`text-blekk-svak transition-transform ${velgElever ? "-rotate-90" : "rotate-90"}`}
                      >
                        ›
                      </span>
                    )}
                  </button>
                </div>
                <Tallfelt
                  etikett="Minutter"
                  verdi={samtaletid}
                  settVerdi={setSamtaletid}
                />
                <Tallfelt etikett="Pause" verdi={pause} settVerdi={setPause} />
              </div>
              {velgElever && !brukEgen && (
                <div className="mt-2 rounded-vanlig border border-linje bg-ark">
                  <div className="flex items-center gap-3 border-b border-linje-svak px-2.5 py-1.5 text-liten">
                    <span className="text-blekk-dempet">
                      {deltakere.length} av {alleDeltakere.length} valgt
                    </span>
                    <button
                      onClick={() => settUtelatt(new Set())}
                      className="ml-auto text-blekk-dempet hover:text-blekk"
                    >
                      Alle
                    </button>
                    <button
                      onClick={() =>
                        settUtelatt(new Set(alleDeltakere.map((d) => d.id)))
                      }
                      className="text-blekk-dempet hover:text-blekk"
                    >
                      Ingen
                    </button>
                  </div>
                  <ul className="max-h-60 overflow-y-auto py-1">
                    {alleDeltakere.map((d) => (
                      <li key={d.id}>
                        <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1 text-brod hover:bg-flate">
                          <input
                            type="checkbox"
                            checked={!utelatt.has(d.id)}
                            onChange={(e) => {
                              const ny = new Set(utelatt);
                              if (e.target.checked) ny.delete(d.id);
                              else ny.add(d.id);
                              settUtelatt(ny);
                            }}
                            className="accent-[var(--color-aksent)]"
                          />
                          <span className="truncate">{d.navn}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-3 flex items-center gap-3">
                <span className="text-brod text-blekk-dempet">Samtale</span>
                <Bryter
                  storrelse="liten"
                  verdi={storrelse >= 4 ? "4" : String(storrelse)}
                  settVerdi={(v) => {
                    const n = Number(v);
                    setStorrelse(n);
                    void settInnstilling(storrelseNokkel, String(n));
                  }}
                  valg={[
                    { id: "1", navn: "Enkeltvis" },
                    { id: "2", navn: "Par" },
                    { id: "3", navn: "3" },
                    { id: "4", navn: "4–6" },
                  ]}
                />
                {storrelse >= 4 && (
                  <select
                    value={storrelse}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setStorrelse(n);
                      void settInnstilling(storrelseNokkel, String(n));
                    }}
                    className="rounded-vanlig border border-linje bg-ark px-1.5 py-0.5 text-liten"
                  >
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                    <option value={6}>6</option>
                  </select>
                )}
              </div>
              {storrelse > 1 && (
                <p className="mt-2 text-liten text-blekk-svak">
                  {deltakere.length} elever i {plasserTrengs} grupper. Minuttene
                  gjelder hele gruppa; går det ikke opp, blir de siste gruppene
                  én større.
                </p>
              )}
              {!brukEgen ? (
                <p className="mt-3 text-liten text-blekk-dempet">
                  {deltakere.length > 0
                    ? `Elevene hentes fra ${
                        modus === "mentor"
                          ? "mentorgruppa"
                          : (fag.find((f) => f.id === fagId)?.kode ?? "faget")
                      }. `
                    : modus === "mentor"
                      ? "Ingen mentorelever i år ennå. "
                      : "Ingen elever er koblet til dette faget. "}
                  <button
                    onClick={() => setBrukEgen(true)}
                    className="text-blekk underline underline-offset-2 hover:text-aksent"
                  >
                    Lim inn en annen liste
                  </button>
                </p>
              ) : (
                <div className="mt-3">
                  <textarea
                    value={egenListe}
                    onChange={(e) => setEgenListe(e.target.value)}
                    rows={6}
                    placeholder={"Tony Soprano\nCarmela Soprano"}
                    className="w-full rounded-vanlig border border-linje px-2 py-1.5 font-mono text-liten outline-none focus:border-aksent"
                  />
                  <button
                    onClick={() => {
                      setBrukEgen(false);
                      setEgenListe("");
                    }}
                    className="mt-1 text-liten text-blekk-dempet underline underline-offset-2 hover:text-blekk"
                  >
                    Bruk elevene fra appen i stedet
                  </button>
                </div>
              )}
            </Bolk>

            {/* Mentorsamtalen har ikke oppgavenummer (§4.10). */}
            {modus === "fag" && (
              <Bolk
                tittel="Temaer"
                etter={temaer.length > 0 ? String(temaer.length) : undefined}
              >
                {temaer.length === 0 && (
                  <p className="mb-1 text-liten text-blekk-svak">
                    Ingen temaer ennå. Uten temaer trekkes bare rekkefølgen.
                  </p>
                )}
                <ul className="space-y-1">
                  {temaer.map((t, i) => (
                    <li key={i} className="group flex items-center gap-2.5">
                      <Temarute nr={i + 1} />
                      <input
                        value={t}
                        onChange={(e) =>
                          lagreTemaer(
                            temaer.map((x, j) =>
                              j === i ? e.target.value : x,
                            ),
                          )
                        }
                        placeholder={`Oppgave ${i + 1}`}
                        className="min-w-0 flex-1 rounded-vanlig border border-transparent bg-transparent px-1 py-0.5 text-brod outline-none placeholder:text-blekk-svak hover:border-linje focus:border-aksent focus:bg-ark"
                      />
                      <button
                        onClick={() =>
                          lagreTemaer(temaer.filter((_, j) => j !== i))
                        }
                        className="shrink-0 px-1 text-blekk-svakest opacity-0 hover:text-feil group-hover:opacity-100"
                        title="Fjern"
                      >
                        <Ikon navn="kryss" />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => lagreTemaer([...temaer, ""])}
                  className="mt-2 text-liten text-blekk-dempet hover:text-blekk"
                >
                  + Legg til tema
                </button>
              </Bolk>
            )}

            <Bolk
              tittel="Samtaledager"
              nokkel="samtaler-dager"
              etter={
                dager.length === 0
                  ? undefined
                  : `${dager.length} ${dager.length === 1 ? "dag" : "dager"} · plass til ${samletKapasitet}`
              }
            >
              {modus === "fag" && (
                <Oktvelger
                  okter={oktvalg}
                  vurderingsokter={
                    new Set(
                      vurderinger
                        .filter(
                          (v) =>
                            v.skolearFagId === fagId &&
                            (!valgtVurdering || v.id === valgtVurdering),
                        )
                        .flatMap((v) => v.oktIder),
                    )
                  }
                  dager={dager}
                  kapasiteter={kapasiteter}
                  minutter={minutter}
                  pause={pausen}
                  kollisjon={(dato: string) => {
                    const b = blokkering(dato, fridager, rode);
                    return b && b.type !== "helg" ? b.navn : null;
                  }}
                  onVelg={async (okt, pa) => {
                    const dag = dager.find((d) => d.oktId === okt.id);
                    if (pa) {
                      await leggDagIOkt(
                        skolear.id,
                        okt.id,
                        valgtVurdering || null,
                      );
                    } else if (dag) {
                      if (
                        dag.antall > 0 &&
                        !(await bekreft(
                          `Ta samtalene ut av økta ${kortDato(okt.dato)}?\n\n` +
                            `${dag.antall} samtaler er trukket der. De forsvinner.`,
                        ))
                      )
                        return;
                      await fjernDagFraOkt(dag.id);
                    }
                    await last();
                  }}
                />
              )}

              {/*
              Egne dager, utenfor øktene. I mentormodus er det de eneste —
              mentorsamtalen har ikke noe fag og dermed ingen økter.
            */}
              {dager.map((dag, i) =>
                dag.oktId ? null : (
                  <Dagkort
                    key={dag.id}
                    dag={dag}
                    nr={i + 1}
                    kapasitet={kapasiteter[i]}
                    plassord={plassord}
                    onEndre={async (felter) => {
                      await endreSamtaledag(dag.id, felter);
                      await last();
                    }}
                    onSlett={async () => {
                      if (
                        !(await bekreft(
                          `Slette dag ${i + 1}?\n\nSamtalene som er trukket på den forsvinner.`,
                        ))
                      )
                        return;
                      await slettSamtaledag(dag.id);
                      await last();
                    }}
                  />
                ),
              )}
              <button
                onClick={async () => {
                  await opprettSamtaledag(skolear.id, {
                    skolearFagId: modus === "mentor" ? null : fagId,
                    dato: "",
                    vurderingId:
                      modus === "fag" ? valgtVurdering || null : null,
                    ...NY_DAG,
                  });
                  await last();
                }}
                className="mt-1 text-liten text-blekk-dempet hover:text-blekk"
              >
                {modus === "fag"
                  ? "+ Egen dag utenfor øktene"
                  : "+ Legg til dag"}
              </button>

              {dager.length > 0 && (
                <p className="mt-2 text-liten text-blekk-svak">
                  {timer} timer satt av · plass til {samletKapasitet} {plassord}
                </p>
              )}
            </Bolk>

            {/*
            Historikken er synlig mens du trekker, ikke bare etterpå. Merknadene
            vises uansett om vektingen er på — de er opplysning, ikke konsekvens
            av en innstilling (§4.10).
          */}
            <Bolk tittel="Historikk">
              <label className="flex select-none items-center gap-2 text-brod">
                <input
                  type="checkbox"
                  checked={vekting}
                  onChange={(e) => setVekting(e.target.checked)}
                />
                Veie mot sist (tidlig → senere)
              </label>
              <Historikkoversikt deltakere={deltakere} historikk={historikk} />
            </Bolk>
          </div>

          {/* Generer, og under den Trekk på nytt med de to låsene (§4.10). */}
          <div className="shrink-0 space-y-2.5 border-t border-linje-medium pt-4">
            <button
              disabled={deltakere.length === 0 || dager.length === 0}
              onClick={() => void generer()}
              className="h-11 w-full rounded-full bg-aksent text-brod font-medium text-ark hover:bg-aksent-mork disabled:opacity-40"
            >
              Generer
            </button>

            {trekning && (
              <>
                <div className="flex gap-2">
                  <Pilleknapp
                    onKlikk={() => void trekkPaNytt()}
                    av={lastTema && lastRekkefolge}
                  >
                    Trekk på nytt
                  </Pilleknapp>
                  <Pilleknapp
                    pa={lastTema}
                    onKlikk={() => setLastTema((v) => !v)}
                    tittel="Lås temaene ved ny trekning"
                  >
                    <Ikon navn={lastTema ? "las" : "apen-las"} /> Tema
                  </Pilleknapp>
                  <Pilleknapp
                    pa={lastRekkefolge}
                    onKlikk={() => setLastRekkefolge((v) => !v)}
                    tittel="Lås rekkefølgen ved ny trekning"
                  >
                    <Ikon navn={lastRekkefolge ? "las" : "apen-las"} />{" "}
                    Rekkefølge
                  </Pilleknapp>
                </div>
                {(lashint(lastTema, lastRekkefolge) ||
                  lasteElever.size > 0) && (
                  <p className="text-liten text-blekk-svak">
                    {lashint(lastTema, lastRekkefolge)}
                    {lasteElever.size > 0 &&
                      ` ${lasteElever.size} ${lasteElever.size === 1 ? "elev" : "elever"} låst.`}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div
        className={`@container min-h-0 min-w-0 flex-1 overflow-auto ${visOppsett ? "pl-5 xl:pl-6" : ""}`}
      >
        {/*
          Gult varsel øverst når det er for få plasser, og det sier hvem som
          mangler tid — når trekningen er gjort, står navnene der (§10).
        */}
        {plasserTrengs > samletKapasitet && dager.length > 0 && (
          <div className="mb-5 flex gap-3 rounded-stor border border-[color-mix(in_srgb,var(--color-lys-gul)_55%,var(--color-ark))] bg-[color-mix(in_srgb,var(--color-lys-gul)_12%,var(--color-ark))] px-4 py-3 text-brod">
            <span aria-hidden className="pt-0.5 text-blekk-dempet">
              <Varseltrekant />
            </span>
            <p>
              <strong className="font-semibold">
                {samletKapasitet} plasser til {plasserTrengs} {plassord}.
              </strong>{" "}
              {utenPlass.length > 0 &&
                `${listeTekst(utenPlass.map((d) => d.navn))} har ikke fått tid. `}
              {modus === "fag"
                ? "Legg til en dag, forleng en økt eller kort ned pausen."
                : "Legg til en dag, forleng en dag eller kort ned pausen."}
            </p>
          </div>
        )}

        {dragmelding && (
          <div className="mb-4 border border-linje bg-flate px-3 py-2 text-brod text-blekk-dempet">
            {dragmelding}
          </div>
        )}

        {!lagret && (
          <div className="mb-4 border border-linje bg-flate px-3 py-2 text-brod text-blekk-dempet">
            Trekningen er ikke lagret. Elevene i den innlimte lista finnes ikke
            i appen, så det er ingenting å henge samtalene på. Lim dem inn under
            Elever først, så lagres trekningen og teller i historikken.
          </div>
        )}

        {/*
          Trekningens navn og eksporten står i verktøylinja (DESIGN.md §10).
        */}
        <IVerktoylinja>
          {modus === "mentor" ? (
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full bg-aksent"
            />
          ) : (
            <Fagfirkant
              farge={fag.find((f) => f.id === fagId)?.farge ?? null}
              storrelse={10}
            />
          )}
          <span className="min-w-0 truncate text-brod font-semibold">
            {modus === "mentor"
              ? "Mentorsamtaler"
              : (vurderinger.find((v) => v.id === valgtVurdering)?.tittel ??
                fag.find((f) => f.id === fagId)?.kode ??
                "")}
          </span>
          <span className="hidden shrink-0 text-liten tabular-nums text-blekk-dempet xl:inline">
            {[
              modus === "fag" && valgtVurdering
                ? fag.find((f) => f.id === fagId)?.kode
                : null,
              `${deltakere.length} elever`,
              dager.length > 0
                ? `${dager.length} ${dager.length === 1 ? "dag" : "dager"}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-1">
            {/*
              Rediger viser oppsettet (lerretet A). En trekning som er
              trukket, vises som ren timeplan til du ber om å endre den.
            */}
            {trekning !== null && (
              <Verktoyknapp
                ramme={visOppsett}
                onKlikk={() => setRedigerer(!visOppsett)}
              >
                {visOppsett ? "Ferdig" : "Rediger"}
              </Verktoyknapp>
            )}
            {/*
              Publiseringen er en bevisst handling, ikke en bivirkning av at
              du dro en rad. Knappen sier hva som venter — og at noe er endret
              siden sist, så du vet at kalenderen er i utakt (§8.1).
            */}
            {trekning !== null && modus === "mentor" && kalender?.pa && (
              <>
                <span className="mr-1 text-liten text-blekk-dempet">
                  {kalendertekst(kalender)}
                </span>
                <Verktoyknapp
                  ramme={kalender.endrede + kalender.fjernes > 0}
                  av={publiserer || kalender.endrede + kalender.fjernes === 0}
                  onKlikk={() => void publiser()}
                >
                  {publiserer ? "Publiserer …" : "Publiser til kalender"}
                </Verktoyknapp>
              </>
            )}
            {trekning !== null && (
              <>
                <Verktoyknapp ramme onKlikk={() => void tilTeams()}>
                  {kopiert === "teams" ? (
                    <>
                      <Ikon navn="hake" /> Kopiert
                    </>
                  ) : (
                    "Kopier til Teams"
                  )}
                </Verktoyknapp>
                <Verktoyknapp onKlikk={() => void tilMarkdown()}>
                  {kopiert === "md" ? (
                    <>
                      <Ikon navn="hake" /> Kopiert
                    </>
                  ) : (
                    "Markdown"
                  )}
                </Verktoyknapp>
                <Verktoyknapp onKlikk={() => void invoke("skriv_ut")}>
                  Skriv ut …
                </Verktoyknapp>
              </>
            )}
            {dager.length > 0 && (
              <Verktoyknapp
                farlig
                onKlikk={() =>
                  void slettPlan(
                    dager,
                    modus === "mentor"
                      ? "mentorsamtalene"
                      : (fag.find((f) => f.id === fagId)?.kode ?? "faget"),
                  )
                }
              >
                Slett planen
              </Verktoyknapp>
            )}
          </span>
        </IVerktoylinja>

        {trekning !== null && (
          <div className="mb-5 flex items-center gap-4">
            <Bryter
              verdi={visning}
              settVerdi={(v) => setVisning(v as Visning)}
              valg={[
                { id: "timeplan", navn: "Timeplan" },
                { id: "fordeling", navn: "Fordeling" },
                { id: "alfabetisk", navn: "Alfabetisk" },
                // Fordelingen handler om temaene, og mentorsamtalen har ingen.
              ].filter((v) => !(v.id === "fordeling" && modus === "mentor"))}
            />
            {visning === "timeplan" && (
              <span className="text-liten text-blekk-svak">
                Klikk på et navn for å ta notat fra samtalen. Dra en rad for å
                flytte; nederste halvdel = etter denne.
              </span>
            )}
          </div>
        )}

        {trekning === null ? (
          <Tomtilstand
            tekst={
              dager.length === 0
                ? modus === "fag"
                  ? "Kryss av for øktene samtalene skal ligge i, til venstre — eller legg til en egen dag."
                  : "Legg til minst én samtaledag til venstre."
                : "Sett opp trekningen til venstre og trykk Generer timeplan."
            }
          />
        ) : visning === "fordeling" ? (
          <Fordeling plan={trekning} />
        ) : visning === "alfabetisk" ? (
          <Alfabetisk plan={trekning} medTema={modus === "fag"} />
        ) : (
          <Timeplan
            plan={trekning}
            historikk={historikk}
            laste={lasteElever}
            notater={notater}
            temaer={temaer}
            onMotte={async (rad) => {
              if (!rad.samtaleId) return;
              await settMotte(rad.samtaleId, !rad.motte);
              await last();
            }}
            onApneNotat={(rad, dag) => setNotatFor({ rad, dag })}
            kapasitetFor={(planIdx) =>
              kapasiteter[
                dager.findIndex((d) => d.id === trekning[planIdx]?.dag.id)
              ] ?? 0
            }
            onFlytt={(fra, til) => void flytt(fra, til)}
            onFlyttElev={(elevId, dag, rad) => void flyttElev(elevId, dag, rad)}
            onLas={(elevId) =>
              setLasteElever((f) => {
                const ny = new Set(f);
                if (ny.has(elevId)) ny.delete(elevId);
                else ny.add(elevId);
                return ny;
              })
            }
          />
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ deler

function Bolk({
  tittel,
  etter,
  nokkel,
  children,
}: {
  tittel: string;
  /** står til høyre for overskriften, f.eks. antall */
  etter?: string;
  /** gis den, kan bolken legges sammen, og valget huskes */
  nokkel?: string;
  children: React.ReactNode;
}) {
  if (nokkel)
    return (
      <Sammenleggbolk tittel={tittel} etter={etter} nokkel={nokkel}>
        {children}
      </Sammenleggbolk>
    );
  return (
    <section>
      <h2 className="mb-3 flex items-baseline text-brod font-semibold text-blekk">
        {tittel}
        {etter && (
          <span className="ml-auto text-liten font-normal tabular-nums text-blekk-svak">
            {etter}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

/**
 * Knappene i verktøylinja: rolige tekstknapper på glasset, den viktigste
 * med ramme som en kapsel, og Slett i rødt (DESIGN.md §10).
 */
function Verktoyknapp({
  ramme,
  farlig,
  av,
  onKlikk,
  children,
}: {
  ramme?: boolean;
  farlig?: boolean;
  av?: boolean;
  onKlikk: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onKlikk}
      disabled={av}
      className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-brod disabled:opacity-40 ${
        ramme
          ? "border border-linje-sterk bg-ark/70 text-blekk hover:bg-ark"
          : farlig
            ? "text-feil hover:bg-feil-flate"
            : "text-blekk-dempet hover:bg-[var(--glass-valgt)] hover:text-blekk"
      }`}
    >
      {children}
    </button>
  );
}

function Varseltrekant() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M8 2.5l6 10.5H2z" />
      <path d="M8 6.5v3M8 11.3v.2" />
    </svg>
  );
}

/** «Tony og Vito», «Tony, Vito og Paulie». */
function listeTekst(navn: string[]): string {
  if (navn.length <= 1) return navn.join("");
  return `${navn.slice(0, -1).join(", ")} og ${navn[navn.length - 1]}`;
}

/** En bolk som legges sammen med et klikk på overskriften. */
function Sammenleggbolk({
  tittel,
  etter,
  nokkel,
  children,
}: {
  tittel: string;
  etter?: string;
  nokkel: string;
  children: React.ReactNode;
}) {
  const [apen, setApen] = useApen(nokkel);
  return (
    <section>
      <button
        onClick={() => setApen(!apen)}
        aria-expanded={apen}
        className="group flex w-full items-baseline gap-2 text-left text-brod font-semibold text-blekk"
      >
        <span
          aria-hidden
          className={`inline-block w-2 text-blekk-svak transition-transform duration-[var(--tid-inn)] ${
            apen ? "rotate-90" : ""
          }`}
        >
          ›
        </span>
        {tittel}
        {etter && (
          <span className="ml-auto text-liten font-normal tabular-nums text-blekk-svak group-hover:text-blekk-dempet">
            {etter}
          </span>
        )}
      </button>
      <Utfold apen={apen}>
        <div className="pt-3">{children}</div>
      </Utfold>
    </section>
  );
}

/** Et lite tallfelt med etiketten over. */
function Tallfelt({
  etikett,
  verdi,
  settVerdi,
}: {
  etikett: string;
  verdi: string;
  settVerdi: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-liten text-blekk-dempet">{etikett}</span>
      <input
        inputMode="numeric"
        value={verdi}
        onChange={(e) => settVerdi(e.target.value)}
        className="h-[2.4em] w-full rounded-vanlig border border-linje bg-ark px-2.5 text-brod tabular-nums outline-none focus:border-aksent"
      />
    </label>
  );
}

/** Oppgavenummeret som liten rute i temafargen (DESIGN.md §10). */
function Temarute({ nr }: { nr: number }) {
  return (
    <span
      className="grid h-6 w-6 shrink-0 place-items-center rounded-[5px] text-liten font-medium tabular-nums"
      style={{ background: temafarge(nr), color: TEMATEKST }}
    >
      {nr}
    </span>
  );
}

/** Knappene under Generer: Trekk på nytt og de to låsene, som piller. */
function Pilleknapp({
  pa,
  av,
  tittel,
  onKlikk,
  children,
}: {
  /** låst: knappen står trykket inn */
  pa?: boolean;
  av?: boolean;
  tittel?: string;
  onKlikk: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onKlikk}
      disabled={av}
      aria-pressed={pa}
      title={tittel}
      className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-brod disabled:opacity-40 ${
        pa
          ? "border-aksent bg-valgt text-aksent"
          : "border-linje-sterk bg-ark text-blekk hover:bg-flate"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Ett kort per dag, med sin egen kapasitet.
 *
 * Kapasiteten oppdateres mens du skriver — den regnes ut fra dagen slik den
 * står akkurat nå, ikke fra noe som må lagres først.
 */
/**
 * Fagets økter som avkrysningsliste. Hver økt som krysses av, blir en
 * samtaledag med øktas klokkeslett som ramme (§4.10). Får ikke alle elevene
 * plass i én økt, krysses en til av — kapasiteten står ved hver.
 *
 * Kommende økter vises; tidligere bare når de allerede er valgt, eller når
 * du ber om dem.
 */
function Oktvelger({
  okter,
  vurderingsokter,
  dager,
  kapasiteter,
  minutter,
  pause,
  kollisjon,
  onVelg,
}: {
  okter: Oktvalg[];
  /**
   * Øktene som er huket av for en vurdering — den valgte, eller alle i
   * faget når ingen er valgt. Det er bare dem samtaler legges i, så lista
   * viser bare dem til du ber om resten.
   */
  vurderingsokter: Set<string>;
  dager: Samtaledag[];
  kapasiteter: number[];
  minutter: number;
  pause: number;
  /** det som ligger på datoen — en hendelse, en fridag — eller null */
  kollisjon: (dato: string) => string | null;
  onVelg: (okt: Oktvalg, pa: boolean) => Promise<void>;
}) {
  const [visAlle, setVisAlle] = useState(false);
  const [visTidligere, setVisTidligere] = useState(false);
  const idag = new Date().toLocaleDateString("sv-SE");
  const valgt = new Map(
    dager.map((d, i) => [d.oktId, { dag: d, plass: kapasiteter[i] }]),
  );
  const synlige = okter.filter((o) =>
    visAlle
      ? visTidligere || o.dato >= idag || valgt.has(o.id)
      : vurderingsokter.has(o.id) || valgt.has(o.id),
  );
  const skjulte = visAlle ? okter.length - synlige.length : 0;

  if (okter.length === 0) {
    return (
      <p className="mb-2 text-liten text-blekk-svak">
        Faget har ingen økter ennå. Legg dem inn under Økter, eller bruk en egen
        dag under.
      </p>
    );
  }

  return (
    <div className="mb-2">
      {synlige.length === 0 ? (
        <p className="text-liten text-blekk-svak">
          Ingen økter er knyttet til vurderingen ennå. Huk av for vurderingen på
          økta, eller vis alle øktene i faget.
        </p>
      ) : (
        <ul
          className={`space-y-3 ${visAlle ? "max-h-80 overflow-y-auto pr-1" : ""}`}
        >
          {synlige.map((o) => {
            const v = valgt.get(o.id);
            const slutt = o.klokkeslett
              ? tilKlokke(tilMin(o.klokkeslett) + o.varighetMin)
              : null;
            // Kapasiteten står også på økter som ikke er valgt, så du ser
            // hva en til gir. Dagen i en økt har ingen lunsj (§3.6) før du
            // legger den inn selv.
            const plass =
              v?.plass ??
              (o.klokkeslett && slutt
                ? kapasitet(
                    {
                      fra: o.klokkeslett,
                      til: slutt,
                      lunsjFra: null,
                      lunsjMin: null,
                    },
                    minutter,
                    pause,
                  )
                : 0);
            const kolliderer = kollisjon(o.dato);
            return (
              <li key={o.id}>
                <label
                  className={`flex gap-2.5 ${o.klokkeslett ? "cursor-pointer" : "text-blekk-svak"}`}
                  title={o.klokkeslett ? undefined : "Økta mangler klokkeslett"}
                >
                  <input
                    type="checkbox"
                    checked={v !== undefined}
                    disabled={!o.klokkeslett}
                    onChange={(e) => void onVelg(o, e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-aksent)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span
                        className={`min-w-0 flex-1 truncate text-brod first-letter:uppercase ${
                          v ? "" : "text-blekk-dempet"
                        }`}
                      >
                        {dagOgDato(o.dato)}
                      </span>
                      {plass > 0 && (
                        <span className="shrink-0 text-liten tabular-nums text-blekk-dempet">
                          maks {plass}
                        </span>
                      )}
                    </span>
                    <span
                      className={`block truncate text-liten tabular-nums ${
                        kolliderer ? "text-feil" : "text-blekk-dempet"
                      }`}
                    >
                      {kolliderer
                        ? `${kolliderer} — kolliderer`
                        : o.klokkeslett
                          ? `Økt ${o.klokkeslett}–${slutt}${
                              v?.dag.lunsjFra
                                ? ` · lunsj ${v.dag.lunsjFra}`
                                : ""
                            }`
                          : "uten klokkeslett"}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <span className="mt-2 flex gap-4">
        <button
          onClick={() => setVisAlle((v) => !v)}
          className="text-liten text-blekk-svak hover:text-blekk"
        >
          {visAlle
            ? "Bare øktene med vurdering"
            : `Vis alle ${okter.length} øktene i faget`}
        </button>
        {skjulte > 0 && (
          <button
            onClick={() => setVisTidligere(true)}
            className="text-liten text-blekk-svak hover:text-blekk"
          >
            Vis {skjulte} tidligere økter
          </button>
        )}
      </span>
    </div>
  );
}

/** «torsdag 15. oktober» */
function dagOgDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function Dagkort({
  dag,
  nr,
  kapasitet: plass,
  plassord = "elever",
  onEndre,
  onSlett,
}: {
  dag: Samtaledag;
  nr: number;
  kapasitet: number;
  /** «elever», eller «grupper» i gruppesamtaler */
  plassord?: string;
  onEndre: (felter: Record<string, unknown>) => Promise<void>;
  onSlett: () => void;
}) {
  const harLunsj = dag.lunsjFra !== null;

  return (
    <div className="mb-2 rounded-vanlig border border-linje bg-flate-svak p-2">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-liten font-medium">Dag {nr}</span>
        <span className="flex items-baseline gap-2">
          <span className="text-liten tabular-nums text-blekk-dempet">
            {plass > 0 ? `Maks ${plass} ${plassord}` : "–"}
          </span>
          <button
            onClick={onSlett}
            className="text-blekk-svakest hover:text-feil"
            title="Fjern dagen"
          >
            <Ikon navn="kryss" />
          </button>
        </span>
      </div>

      <input
        type="date"
        defaultValue={dag.dato}
        key={`d${dag.dato}`}
        onBlur={(e) => void onEndre({ dato: e.target.value })}
        className={feltstil + " mb-1.5 w-full"}
      />

      <div className="flex gap-1.5">
        <input
          type="time"
          defaultValue={dag.fra}
          key={`f${dag.fra}`}
          onBlur={(e) => void onEndre({ fra: e.target.value })}
          className={feltstil + " w-1/2"}
        />
        <input
          type="time"
          defaultValue={dag.til}
          key={`t${dag.til}`}
          onBlur={(e) => void onEndre({ til: e.target.value })}
          className={feltstil + " w-1/2"}
        />
      </div>

      <label className="mt-1.5 flex select-none items-center gap-1.5 text-liten text-blekk-dempet">
        <input
          type="checkbox"
          checked={harLunsj}
          onChange={(e) =>
            void onEndre(
              e.target.checked
                ? { lunsj_fra: "11:45", lunsj_min: 30 }
                : { lunsj_fra: null, lunsj_min: null },
            )
          }
        />
        Lunsjpause
      </label>

      {harLunsj && (
        <div className="mt-1.5 flex gap-1.5">
          <input
            type="time"
            defaultValue={dag.lunsjFra ?? "11:45"}
            key={`lf${dag.lunsjFra}`}
            onBlur={(e) => void onEndre({ lunsj_fra: e.target.value })}
            className={feltstil + " w-1/2"}
          />
          <input
            type="number"
            min={5}
            max={120}
            defaultValue={dag.lunsjMin ?? 30}
            key={`lm${dag.lunsjMin}`}
            onBlur={(e) =>
              void onEndre({ lunsj_min: Number(e.target.value) || 30 })
            }
            className={feltstil + " w-1/2"}
          />
        </div>
      )}
    </div>
  );
}

const feltstil =
  "rounded border border-linje bg-ark px-2 py-1 text-brod tabular-nums outline-none focus:border-aksent";

/**
 * Timeplanen: én bolk per dag, én rad per samtale.
 *
 * Plassnummeret løper sammenhengende over alle dagene — dag 2 fortsetter der
 * dag 1 sluttet (§4.10).
 */
function Timeplan({
  plan,
  historikk,
  laste,
  notater,
  temaer,
  kapasitetFor,
  onLas,
  onMotte,
  onApneNotat,
  onFlytt,
  onFlyttElev,
}: {
  plan: Dagplan[];
  historikk: Map<string, Plassering[]>;
  laste: ReadonlySet<string>;
  notater: Map<string, Elevnotat>;
  /** temalista fra oppsettet, så oppgavenummeret blir det samme som der */
  temaer: string[];
  onLas: (elevId: string) => void;
  /** «møtte ikke» av og på for en samtale */
  onMotte: (rad: Dagplan["rader"][number]) => void;
  /** hvor mange plasser dagen har, etter plassen i planen */
  kapasitetFor: (planIdx: number) => number;
  /** et klikk på navnet: notatet fra samtalen */
  onApneNotat: (rad: Dagplan["rader"][number], dag: Samtaledag) => void;
  onFlytt: (
    fra: { dag: number; rad: number },
    til: { dag: number; rad: number; etter: boolean },
  ) => void;
  /** en elev dras fra sin gruppe over på en annen plass */
  onFlyttElev: (elevId: string, dag: number, rad: number) => void;
}) {
  // Et navn i en gruppe åpner elevkortet som et ark over timeplanen. En
  // enkeltsamtale åpner notatet fra samtalen.
  const ark = useArk();
  let plass = 0;

  // ------------------------------------------------------------ dra
  //
  // Raden følger musa, og de andre glir unna mens du drar — du ser hvor den
  // havner før du slipper. Posisjonene måles én gang når draget begynner;
  // forskyvningene regnes ut fra dem, ikke fra en DOM som flytter seg.
  // Nederste halvdel av en rad betyr «etter denne». Er dagen det slippes på
  // full, bytter de to plass (§4.10), og raden som byttes står markert.
  type Mal = { dag: number; rad: number; etter: boolean; bytt: boolean };
  const [dra, setDra] = useState<{
    fra: { dag: number; rad: number };
    dy: number;
    h: number;
    mal: Mal | null;
  } | null>(null);
  const radEl = useRef(new Map<string, HTMLElement>());
  const malt = useRef<
    { dag: number; rad: number; top: number; bunn: number }[]
  >([]);
  const draget = useRef(false);
  // Målet slik det sto sist pekeren flyttet seg — det er dit eleven går.
  const sisteMal = useRef<Mal | null>(null);

  function begynnDra(e: React.PointerEvent, fra: { dag: number; rad: number }) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-ikke-dra], input, textarea"))
      return;
    const startY = e.clientY;
    const startX = e.clientX;
    let pekerY = startY;
    let aktiv = false;
    let h = 0;
    // Rullesonen timeplanen står i. Drar du mot kanten, ruller den, og
    // rullingen regnes inn: posisjonene ble målt før den begynte.
    const sone = (e.currentTarget as HTMLElement).closest<HTMLElement>(
      ".overflow-auto",
    );
    const startRull = sone?.scrollTop ?? 0;
    let ramme = 0;

    const oppdater = () => {
      const rullet = (sone?.scrollTop ?? 0) - startRull;
      const mal = finnMal(pekerY + rullet, fra);
      sisteMal.current = mal;
      setDra({ fra, dy: pekerY - startY + rullet, h, mal });
    };

    const rull = () => {
      ramme = 0;
      if (!aktiv || !sone) return;
      const r = sone.getBoundingClientRect();
      const kant = 48;
      const fart =
        pekerY < r.top + kant
          ? -Math.ceil((r.top + kant - pekerY) / 4)
          : pekerY > r.bottom - kant
            ? Math.ceil((pekerY - (r.bottom - kant)) / 4)
            : 0;
      if (fart === 0) return;
      sone.scrollTop += fart;
      oppdater();
      ramme = requestAnimationFrame(rull);
    };

    const flytt = (ev: PointerEvent) => {
      pekerY = ev.clientY;
      if (!aktiv) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
        aktiv = true;
        draget.current = true;
        malt.current = [...radEl.current].map(([k, el]) => {
          const [dag, rad] = k.split(":").map(Number);
          const r = el.getBoundingClientRect();
          return { dag, rad, top: r.top, bunn: r.bottom };
        });
        const egen = malt.current.find(
          (m) => m.dag === fra.dag && m.rad === fra.rad,
        );
        h = egen ? egen.bunn - egen.top : 0;
      }
      oppdater();
      if (!ramme) ramme = requestAnimationFrame(rull);
    };

    const slipp = () => {
      window.removeEventListener("pointermove", flytt);
      window.removeEventListener("pointerup", slipp);
      window.removeEventListener("pointercancel", slipp);
      if (ramme) cancelAnimationFrame(ramme);
      // Utføres her, ikke i en state-oppdatering: React kan kjøre dem to
      // ganger, og da ville eleven blitt flyttet to ganger.
      const mal = sisteMal.current;
      sisteMal.current = null;
      setDra(null);
      if (aktiv && mal) utfor(fra, mal);
      // Klikket som kommer etter slippet, skal ikke åpne notatet.
      window.setTimeout(() => (draget.current = false), 0);
    };

    window.addEventListener("pointermove", flytt);
    window.addEventListener("pointerup", slipp);
    window.addEventListener("pointercancel", slipp);
  }

  function finnMal(y: number, fra: { dag: number; rad: number }): Mal | null {
    const andre = malt.current
      .filter((m) => !(m.dag === fra.dag && m.rad === fra.rad))
      .sort((a, b) => a.top - b.top);
    if (andre.length === 0) return null;
    // Raden pekeren står over, eller den nærmeste.
    const over =
      andre.find((m) => y >= m.top && y < m.bunn) ??
      andre.reduce((best, m) =>
        Math.abs((m.top + m.bunn) / 2 - y) <
        Math.abs((best.top + best.bunn) / 2 - y)
          ? m
          : best,
      );
    const etter = y > (over.top + over.bunn) / 2;
    const bytt =
      over.dag !== fra.dag &&
      plan[over.dag].rader.length >= kapasitetFor(over.dag);
    return { dag: over.dag, rad: over.rad, etter: bytt ? false : etter, bytt };
  }

  /** Slippet: samme regler som før — innen dagen, eller til en annen dag. */
  function utfor(fra: { dag: number; rad: number }, mal: Mal) {
    if (mal.dag === fra.dag) {
      const t = mal.etter ? mal.rad + 1 : mal.rad;
      const til = t > fra.rad ? t - 1 : t;
      if (til !== fra.rad)
        onFlytt(fra, { dag: mal.dag, rad: til, etter: false });
    } else {
      onFlytt(fra, mal);
    }
  }

  /** Hvor langt en rad skal gli for å gi plass, mens det dras. */
  function forskyvning(dag: number, rad: number): number {
    if (!dra?.mal || dra.mal.bytt) return 0;
    const { fra, mal, h } = dra;
    const t = mal.etter ? mal.rad + 1 : mal.rad;
    if (mal.dag === fra.dag) {
      if (dag !== fra.dag) return 0;
      if (t > fra.rad) return rad > fra.rad && rad < t ? -h : 0;
      return rad >= t && rad < fra.rad ? h : 0;
    }
    if (dag === fra.dag && rad > fra.rad) return -h;
    if (dag === mal.dag && rad >= t) return h;
    return 0;
  }

  function erDratt(dag: number, rad: number): boolean {
    return dra !== null && dra.fra.dag === dag && dra.fra.rad === rad;
  }

  function byttesMed(dag: number, rad: number): boolean {
    return !!dra?.mal?.bytt && dra.mal.dag === dag && dra.mal.rad === rad;
  }

  function stil(dag: number, rad: number): React.CSSProperties | undefined {
    if (!dra) return undefined;
    if (erDratt(dag, rad))
      return { transform: `translateY(${dra.dy}px)`, transition: "none" };
    return {
      transform: `translateY(${forskyvning(dag, rad)}px)`,
      transition: "transform var(--tid-inn) var(--ease-inn)",
    };
  }

  return (
    <div className="space-y-6">
      {plan.map((d, dagIdx) => (
        <section key={d.dag.id}>
          {/* Dagen i Light (DESIGN.md §10), med tid og antall ved siden av. */}
          <div className="flex flex-wrap items-baseline gap-x-3 border-b border-linje pb-2">
            <h2 className="text-[calc(26px*var(--tekst-skala))] font-light leading-tight tracking-overskrift first-letter:uppercase">
              {langDato(d.dag.dato)}
            </h2>
            <span className="text-liten tabular-nums text-blekk-dempet">
              {d.dag.fra}–{d.dag.til} ·{" "}
              {d.rader.reduce((n, r) => n + r.medlemmer.length, 0)} elever
              {d.rader.some((r) => r.medlemmer.length > 1) &&
                ` i ${d.rader.length} grupper`}
              {d.dag.oktId && " · økt"}
            </span>
          </div>

          {d.rader.map((r, radIdx) => {
            plass++;
            // Lunsjen står på sin plass i rekka: rett før den første samtalen
            // som begynner etter at pausen er over.
            const lunsjHer =
              d.lunsj !== null &&
              r.fra >= d.lunsj.til &&
              (radIdx === 0 || d.rader[radIdx - 1].fra < d.lunsj.fra);
            // Merknaden bygges på historikken FØR denne trekningen, så den
            // sier noe om hva som har skjedd — ikke om det som nettopp ble
            // trukket.
            const notis = merknad(historikk.get(r.elevId) ?? []);
            const erLast = laste.has(r.elevId);
            return (
              <Fragment key={`${r.elevId}-${r.fra}`}>
                {lunsjHer && d.lunsj && (
                  <div className="flex items-baseline gap-3 border-b border-linje-svak bg-flate py-2 text-brod text-blekk-dempet">
                    <span className="w-7 shrink-0" />
                    <span className="shrink-0 tabular-nums">
                      {d.lunsj.fra}–{d.lunsj.til}
                    </span>
                    <span className="flex-1">
                      · Lunsj ({tilMin(d.lunsj.til) - tilMin(d.lunsj.fra)} min)
                    </span>
                  </div>
                )}
                <div
                  ref={(el) => {
                    const k = `${dagIdx}:${radIdx}`;
                    if (el) radEl.current.set(k, el);
                    else radEl.current.delete(k);
                  }}
                  onPointerDown={(e) =>
                    !erLast && begynnDra(e, { dag: dagIdx, rad: radIdx })
                  }
                  // Et navn dratt ut av en gruppe: eleven flyttes hit.
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const elev = e.dataTransfer.getData(ELEVDRAG);
                    if (elev) onFlyttElev(elev, dagIdx, radIdx);
                  }}
                  style={stil(dagIdx, radIdx)}
                  className={`relative flex touch-none select-none items-center gap-3 border-b border-linje-svak py-2 text-brod ${
                    r.motte ? "" : "opacity-55"
                  } ${
                    erLast
                      ? "bg-flate-svak"
                      : dra
                        ? "cursor-grabbing"
                        : "cursor-grab hover:bg-flate-svak"
                  } ${erDratt(dagIdx, radIdx) ? "z-20 bg-ark shadow-[var(--shadow-ark)]" : ""} ${
                    byttesMed(dagIdx, radIdx)
                      ? "bg-valgt ring-1 ring-inset ring-aksent"
                      : ""
                  }`}
                >
                  <span className="w-7 shrink-0 text-right text-liten tabular-nums text-blekk-svak">
                    {plass}
                  </span>
                  {/* Bare starttida: slutten er neste rad (§4.10). */}
                  <span
                    className="w-14 shrink-0 tabular-nums"
                    title={`${r.fra}–${r.til}`}
                  >
                    {r.fra}
                  </span>
                  {r.medlemmer.length > 1 ? (
                    <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                      {r.medlemmer.map((m) => (
                        <span
                          key={m.id}
                          data-ikke-dra
                          draggable={!erLast}
                          onDragStart={(e) => {
                            // Navnet, ikke hele raden: raden har sitt eget drag.
                            e.stopPropagation();
                            e.dataTransfer.setData(ELEVDRAG, m.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onClick={() => ark.apneElev(m.id)}
                          title="Klikk for elevkortet, dra til en annen gruppe"
                          className={`cursor-pointer rounded-full bg-flate px-2 py-px hover:bg-linje-medium ${erLast ? "" : "active:cursor-grab"}`}
                        >
                          {m.navn}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        // Musa ble sluppet etter et drag: det var ikke et klikk.
                        if (draget.current) return;
                        if (r.samtaleId) onApneNotat(r, d.dag);
                        else if (r.medlemmer[0])
                          ark.apneElev(r.medlemmer[0].id);
                      }}
                      title={
                        r.samtaleId
                          ? (notater.get(r.elevId)?.tekst ??
                            "Skriv notat fra samtalen")
                          : undefined
                      }
                      className={`flex min-w-0 flex-1 items-center gap-2 text-left font-medium hover:text-aksent ${
                        r.motte ? "" : "line-through"
                      }`}
                    >
                      <Kappet verdi={r.navn} />
                    </button>
                  )}
                  {r.tema && (
                    <span
                      title={r.tema}
                      className="flex w-6 min-w-0 shrink-0 items-center gap-3 @xl:w-44 @3xl:w-60"
                    >
                      {/* Oppgavenummeret som liten rute i temafargen. */}
                      {temaer.indexOf(r.tema) >= 0 && (
                        <Temarute nr={temaer.indexOf(r.tema) + 1} />
                      )}
                      <Kappet verdi={r.tema} klasse="hidden @xl:block" />
                    </span>
                  )}
                  <span className="hidden w-28 shrink-0 text-right text-liten text-blekk-dempet @3xl:block">
                    {r.motte ? notis : "møtte ikke"}
                  </span>
                  {r.samtaleId && r.medlemmer.length === 1 ? (
                    <button
                      data-ikke-dra
                      onClick={() => onApneNotat(r, d.dag)}
                      title={
                        notater.has(r.elevId)
                          ? "Notatet fra samtalen"
                          : "Ta notat fra samtalen"
                      }
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-vanlig ${
                        notater.has(r.elevId)
                          ? "text-aksent hover:bg-flate"
                          : "text-blekk-svakest hover:bg-flate hover:text-blekk"
                      }`}
                    >
                      <Ikon
                        navn={notater.has(r.elevId) ? "notat-fylt" : "notat"}
                      />
                    </button>
                  ) : (
                    <span className="w-7 shrink-0" />
                  )}
                  <button
                    data-ikke-dra
                    onClick={() => onLas(r.elevId)}
                    title={
                      erLast
                        ? "Lås opp — eleven trekkes om igjen"
                        : "Lås — eleven beholder plass og tema"
                    }
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-vanlig ${
                      erLast
                        ? "text-blekk"
                        : "text-blekk-svakest hover:bg-flate hover:text-blekk"
                    }`}
                  >
                    <Ikon navn={erLast ? "las-fylt" : "apen-las"} />
                  </button>
                  {r.samtaleId && r.medlemmer.length === 1 ? (
                    <button
                      data-ikke-dra
                      onClick={() => onMotte(r)}
                      aria-pressed={!r.motte}
                      title={
                        r.motte
                          ? "Møtte ikke — raden blir stående med klokkeslettet sitt"
                          : "Møtte likevel"
                      }
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-vanlig ${
                        r.motte
                          ? "text-blekk-svakest hover:bg-flate hover:text-blekk"
                          : "text-feil"
                      }`}
                    >
                      <Ikon navn="motte-ikke" />
                    </button>
                  ) : (
                    <span className="w-7 shrink-0" />
                  )}
                </div>
              </Fragment>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/**
 * Hvem som hadde tidlig eller sent sist, samlet.
 *
 * Bare de som har noe å si står her — de fleste har ingenting, og det er
 * nettopp derfor de som har det er verdt å se på.
 */
function Historikkoversikt({
  deltakere,
  historikk,
}: {
  deltakere: { id: string; navn: string }[];
  historikk: Map<string, Plassering[]>;
}) {
  const grupper = new Map<string, string[]>();
  for (const d of deltakere) {
    const notis = merknad(historikk.get(d.id) ?? []);
    if (!notis) continue;
    grupper.set(notis, [...(grupper.get(notis) ?? []), d.navn.split(" ")[0]]);
  }

  if (grupper.size === 0) {
    return (
      <p className="mt-2 text-liten text-blekk-dempet">
        Ingenting å melde ennå. Etter et par trekninger står det her hvem som
        har hatt tidlig eller sent.
      </p>
    );
  }

  const antall = [...grupper.values()].reduce((n, g) => n + g.length, 0);
  return (
    <div className="mt-2">
      <p className="text-liten text-blekk-dempet">
        {antall === 1 ? "Én elev har" : `${antall} elever har`} en merknad.
        Merknadene vises uansett.
      </p>
      <ul className="mt-1.5 space-y-1">
        {[...grupper].map(([notis, navn]) => (
          <li key={notis} className="text-liten">
            <span className="text-blekk-dempet">{notis}</span>{" "}
            <span className="text-blekk-svak">· {navn.join(", ")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ordlyden fra §4.10 — den sier hva «Trekk på nytt» faktisk gjør. */
function lashint(tema: boolean, rekkefolge: boolean): string {
  if (tema && rekkefolge) return "Begge er låst — ingenting endres.";
  if (tema) return "Temaer holdes — kun rekkefølge trekkes.";
  if (rekkefolge) return "Rekkefølge holdes — kun tema trekkes.";
  return "";
}

function storForbokstav(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function langDato(dato: string): string {
  if (!dato) return "Dato ikke satt";
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Fordeling — ett kort per elev i tidsrekkefølge på tvers av alle dagene.
 *
 * Plassnummeret er posisjonen i køen denne trekningen, ikke en fast id.
 */
function Fordeling({ plan }: { plan: Dagplan[] }) {
  const alle = plan.flatMap((d) => d.rader);

  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))]">
      {alle.map((r, i) => (
        <div
          key={`${r.elevId}-${r.fra}`}
          className={`rounded-vanlig border border-linje bg-ark px-3 py-2 ${
            r.motte ? "" : "opacity-50"
          }`}
        >
          <span className="text-liten tabular-nums text-blekk-svak">
            {i + 1}
          </span>
          <p className="truncate text-brod font-medium">{r.navn}</p>
          {r.tema && (
            <p className="truncate text-liten text-blekk-dempet">{r.tema}</p>
          )}
          <p className="text-liten tabular-nums text-blekk-svak">{r.fra}</p>
        </div>
      ))}
    </div>
  );
}

/** Alfabetisk — lista sortert på navn, med tidspunkt og dag. */
function Alfabetisk({ plan, medTema }: { plan: Dagplan[]; medTema: boolean }) {
  // Én rad per elev, også i gruppesamtaler — lista er til å finne seg selv.
  const rader = plan
    .flatMap((d) =>
      d.rader.flatMap((r) =>
        r.medlemmer.map((m) => ({
          ...r,
          elevId: m.id,
          navn: m.navn,
          dato: d.dag.dato,
        })),
      ),
    )
    .sort((a, b) => a.navn.localeCompare(b.navn, "nb-NO"));

  return (
    <table className="w-full text-brod">
      <thead>
        <tr className="border-b border-linje text-left text-etikett uppercase tracking-etikett text-blekk-dempet">
          <th className="py-1">Navn</th>
          {medTema && <th className="py-1">Oppgave</th>}
          <th className="py-1">Tid</th>
          <th className="py-1">Dag</th>
        </tr>
      </thead>
      <tbody>
        {rader.map((r) => (
          <tr
            key={`${r.elevId}-${r.fra}`}
            className={`border-b border-linje-svak ${
              r.motte ? "" : "text-blekk-svak line-through"
            }`}
          >
            <td className="py-1.5">{r.navn}</td>
            {medTema && (
              <td className="py-1.5 text-blekk-dempet">{r.tema ?? ""}</td>
            )}
            <td className="py-1.5 tabular-nums text-blekk-dempet">
              {r.fra}–{r.til}
            </td>
            <td className="py-1.5 tabular-nums text-blekk-dempet">
              {kortDato(r.dato)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function kortDato(dato: string): string {
  if (!dato) return "—";
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
  });
}

/**
 * Hva kalenderen vet om trekningen.
 *
 * Sier om den er i utakt, ikke bare om publiseringen er slått på — en
 * omstokking etter publisering skal være synlig som noe som må sendes.
 */
function kalendertekst(k: {
  kalender: string;
  publiserte: number;
  uendret: number;
  endrede: number;
  fjernes: number;
}): string {
  if (!k.kalender.trim()) return "Ingen kalender satt i innstillingene";

  const utakt = k.endrede + k.fjernes;
  if (utakt === 0) {
    return k.uendret === 0
      ? "Ingenting å publisere"
      : `${k.uendret} publisert, ingen endringer`;
  }
  if (k.publiserte === 0) return `${k.endrede} samtaler ikke publisert ennå`;
  return `${utakt} endret siden publisering`;
}
