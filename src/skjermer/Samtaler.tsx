import { useEffect, useMemo, useRef, useState } from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import type { Skolear } from "../data/skolear";
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
  tiderITrekning,
} from "../data/samtale";
import { invoke } from "@tauri-apps/api/core";
import { mentorStatus, publiserMentor } from "../data/caldav";
import { hentNotatPerElev, type Elevnotat } from "../data/elevnotat";
import { Bryter, Fagfirkant, Ikon, Tomtilstand } from "../ui/felles";
import { blokkering, rodekart, type Fridag } from "../data/kalender";
import { hentFridager } from "../data/skolear";
import { IVerktoylinja } from "../ui/Verktoylinje";
import { Utfold } from "../ui/Utfold";
import { useApen } from "../ui/Sammenleggbar";
import { Samtalenotat } from "./Samtalenotat";
import { temafarge } from "../ui/farger";
import { lesJson } from "../data/json";
import { useLagretInnstilling } from "../ui/useLagretInnstilling";
import { Dagkort, Oktvelger, Pilleknapp, Tallfelt } from "./samtaler/Oppsett";
import { Temarute, kortDato, langDato } from "./samtaler/deler";
import { Timeplan } from "./samtaler/Timeplan";
import { Alfabetisk, Fordeling, Historikkoversikt } from "./samtaler/Visninger";
import {
  NY_DAG,
  type Dagplan,
  type Modus,
  type Visning,
} from "./samtaler/deler";

/**
 * Samtaletrekkeren, SPEC §4.10.
 *
 * Én sammenhengende kolonne til venstre og resultatet til høyre. Ingen faner,
 * ingen steg, ingen veiviser — alt som styrer trekningen er synlig samtidig.
 */

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
  // Temaene hører til ett fag. Bytter man fag før svaret er kommet, skal
  // verken et tregt svar eller en redigering havne under feil fag (#6).
  const [temaer, lagreTemaer] = useLagretInnstilling<string[]>(
    modus === "fag" && fagId ? temanokkel(fagId) : null,
    [],
    (v) => lesJson<string[]>(v, [], "samtaletemaene"),
    (t) => JSON.stringify(t),
  );
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
  const [storrelse, settStorrelse] = useLagretInnstilling(
    modus === "mentor"
      ? "samtale_storrelse_mentor"
      : `samtale_storrelse_${fagId}`,
    1,
    (v) => (v ? Math.max(1, Number(v) || 1) : 1),
    String,
  );
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

  // Trekningen samtaletid og pause sist ble lest ut av (se last()).
  const tiderLest = useRef<string | null>(null);

  async function last() {
    setElever(await hentElever(skolear.id));
    setFridager(await hentFridager(skolear.id));
    const alle = await hentSamtaledager(skolear.id);
    const mine = alle.filter((d) =>
      modus === "mentor" ? d.skolearFagId === null : d.skolearFagId === fagId,
    );
    // Historikken er de andre trekningene, ikke den man står i.
    setHistorikk(
      await hentHistorikk(
        skolear.id,
        mine.map((d) => d.id),
      ),
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
    // Samtaletid og pause slik trekningen faktisk ligger, så en flytting
    // ikke legger dagen ut på nytt med standardverdiene.
    // Bare når trekningen åpnes: et tall man nettopp har skrevet i feltet,
    // skal ikke overskrives av at skjermen leses inn på nytt.
    const tider = tiderITrekning(lagrede.map((d) => d.rader));
    const trekningen = `${modus}:${fagId}`;
    if (tider && tiderLest.current !== trekningen) {
      tiderLest.current = trekningen;
      setSamtaletid(String(tider.minutter));
      setPause(String(tider.pause));
    }
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

  /** Elevene trekningen gjelder — fra appen, eller fra lista du limte inn. */
  // Elevene som er tatt ut av samtalene (DESIGN §10: alle eller noen
  // utvalgte). Lagret per fag, og for mentorsamtalene for seg. Lista er de
  // som er tatt UT, så en ny elev i faget kommer med av seg selv.
  const [velgElever, setVelgElever] = useState(false);
  const [utelatt, settUtelatt] = useLagretInnstilling<Set<string>>(
    `samtale_utelatt_${modus === "mentor" ? "mentor" : fagId}`,
    new Set(),
    (v) => new Set(lesJson<string[]>(v, [], "utvalget av elever")),
    (u) => JSON.stringify([...u]),
  );

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
    // Raden i basen følger eleven gjennom en flytting innen dagen
    // (lagreTrekning gjenbruker den; til en annen dag blir det en ny rad). Uten dette forsvant notat- og låseikonene fra slippet til basen
    // var lest inn igjen, og timeplanen blinket.
    const radId = new Map(
      (trekning ?? []).flatMap((d) =>
        d.rader.map((r) => [`${d.dag.id}:${r.elevId}`, r.samtaleId] as const),
      ),
    );
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
            samtaleId: radId.get(`${dag.id}:${paDagen[j]}`) ?? null,
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
      : trekkOmRekkefolge(
          perDag,
          lasteElever,
          Math.random,
          vekting ? historikk : undefined,
        );

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
                    <optgroup key={f.id} label={`${f.kode} · ${f.navn}`}>
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
                    settStorrelse(n);
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
                      settStorrelse(n);
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
                  ? "Kryss av for øktene samtalene skal ligge i, til venstre, eller legg til en egen dag."
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
/** Ordlyden fra §4.10 — den sier hva «Trekk på nytt» faktisk gjør. */
function lashint(tema: boolean, rekkefolge: boolean): string {
  if (tema && rekkefolge) return "Begge er låst, ingenting endres.";
  if (tema) return "Temaer holdes, kun rekkefølge trekkes.";
  if (rekkefolge) return "Rekkefølge holdes, kun tema trekkes.";
  return "";
}
function storForbokstav(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
