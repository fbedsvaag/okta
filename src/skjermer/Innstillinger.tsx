import { lagreTema, TEMA, type Tema } from "../ui/tema";
import { GLASS, lagreGlass, type Glass } from "../ui/glass";
import { BEVEGELSE, lagreBevegelse, type Bevegelse } from "../ui/bevegelse";
import { lagrePalett, PALETT, PALETTER, type Palett } from "../ui/palett";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DelOppsett } from "./Oppsettfil";
import { Skalaer } from "./innstillinger/Skalaer";
import {
  endreSkolear,
  hentFridager,
  hentInnstilling,
  opprettFridag,
  slettFridag,
  hentSkolear,
  opprettSkolear,
  settAktivtSkolear,
  settInnstilling,
  settTekstskala,
  slettSkolear,
  tellForSkolear,
  TEKSTSKALA,
} from "../data/skolear";
import {
  gjenopprettFra,
  hentKopier,
  hentKopimappe,
  taKopiNa,
  type Kopi,
} from "../data/sikkerhetskopi";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { appDataDir } from "@tauri-apps/api/path";
import { erMac } from "../ui/taster";
import type { Skolear } from "../data/skolear";
import type { Fridag } from "../data/kalender";
import * as kalender from "../data/kalenderfeed";
import * as caldav from "../data/caldav";
import { skrivArkiv } from "../data/arkiv";
import { LAERERNAVN, SKOLENAVN } from "../data/arsplanark";
import { Merke } from "../ui/logo";
import { getVersion } from "@tauri-apps/api/app";
import { open, confirm as bekreft } from "@tauri-apps/plugin-dialog";
import { endreFag, leggFagIAr, type FagIAr } from "../data/fag";
import { Bryter, Fagfirkant, Knapp, Ikon } from "../ui/felles";
import {
  bevegelseshjelp,
  filbehandler,
  glasshjelp,
  nokkelringen,
  synkadvarsel,
  systemnavn,
} from "../ui/plattformord";
import { invoke } from "@tauri-apps/api/core";
import { PLANVISNING, lesPlanvisning, type Planvisning } from "../data/oktplan";
import { FAGFARGER } from "../ui/farger";
import { useArk } from "../ui/Arkstabel";
import { IVerktoylinja } from "../ui/Verktoylinje";
import { useLagretInnstilling } from "../ui/useLagretInnstilling";
import { visToast } from "../ui/Toast";
import { giTilbakemelding } from "../ui/Sidemeny";
import { SKJEMA_URL } from "../tilbakemelding";
import {
  hentAlleElever,
  hentElever,
  hentKlasser,
  settMentor,
  slettElevHelt,
  slettEleverIAr,
  slettElevtekst,
  tellEleverIAr,
  tellForElever,
  type Klasse,
} from "../data/elever";
import { slettAlleElevbilder } from "../data/elevbilde";
import { settVisElevbilder, visesElevbilder } from "../ui/Elevfoto";
import {
  GAMLE,
  SIDENAVN,
  sok,
  type Oppslag,
  type Sideid,
} from "./innstillinger/sok";
import {
  Feltinput,
  Gruppe,
  Hake,
  Menyikon,
  Rad,
  Side,
  Sti,
  Vippebryter,
} from "./innstillinger/byggeklosser";

/**
 * Innstillinger, SPEC §4.8, i den nye modellen (ARBEIDSLISTE 23, lerretet
 * Innstillinger2): undermeny med ikoner i grupper, kort med rader (tittel og
 * hjelp til venstre, kontroll til høyre), og søk i verktøylinja som hopper
 * til raden og blinker den.
 *
 * Bare det som gjelder på tvers av skoleår ligger her, pluss skoleårets
 * egne datoer og fagene i året.
 */
export function Innstillinger({
  skolear,
  fag,
  onEndret,
  onApneSkoleruta,
  onApneFag,
  startSide,
  oppsettTekst,
  onOppsettLest,
}: {
  /** en oppsettfil åpnet med dobbeltklikk: vises under Del med kollegaer */
  oppsettTekst?: string | null;
  onOppsettLest?: () => void;
  skolear: Skolear;
  fag: FagIAr[];
  /** siden som står framme når skjermen åpnes, f.eks. «skolear» */
  startSide?: string;
  /** Skoleruta — ferier, fridager og hendelser. */
  onApneSkoleruta: () => void;
  /** Fag i år: der fag legges til og fagbanken står */
  onApneFag?: () => void;
  /** laster skoleåret og fagene på nytt — uten å laste hele appen, som
      ville sendt deg tilbake til startskjermen */
  onEndret: () => void;
}) {
  const [side, setSide] = useState<Sideid>(() => {
    const s = GAMLE[startSide ?? ""] ?? startSide;
    return s && s in SIDENAVN ? (s as Sideid) : "generelt";
  });
  useEffect(() => {
    if (oppsettTekst) setSide("del");
  }, [oppsettTekst]);

  // Markøren i undermenyen glir til siden som er valgt (360 ms).
  const meny = useRef<HTMLDivElement>(null);
  const [markorY, setMarkorY] = useState<number | null>(null);
  useLayoutEffect(() => {
    const k = meny.current?.querySelector<HTMLElement>(`[data-side="${side}"]`);
    if (k) setMarkorY(k.offsetTop);
  }, [side]);

  // Søket: hopper til siden og blinker raden.
  const [sokTekst, setSokTekst] = useState("");
  const [sokValg, setSokValg] = useState(0);
  // Treffene legges over vinduet: verktøylinja klipper det som stikker ut.
  const sokFelt = useRef<HTMLLabelElement>(null);
  const ekstra = useMemo<Oppslag[]>(
    () =>
      fag.map((f) => ({
        side: "fag",
        k: `fag-${f.id}`,
        tittel: `${f.kode} ${f.navn}`,
      })),
    [fag],
  );
  const treff = sok(sokTekst, ekstra);
  function hopp(x: Oppslag) {
    setSide(x.side);
    setSokTekst("");
    window.setTimeout(() => {
      const rad = document.querySelector<HTMLElement>(
        `[data-k="${CSS.escape(x.k)}"]`,
      );
      if (!rad) return;
      rad.scrollIntoView({ block: "center", behavior: "smooth" });
      rad.classList.remove("inn-blink");
      void rad.offsetWidth;
      rad.classList.add("inn-blink");
    }, 80);
  }

  const MENY: { gruppe: string | null; sider: Sideid[] }[] = [
    { gruppe: null, sider: ["deg"] },
    {
      gruppe: "Daglig bruk",
      sider: ["generelt", "skolear", "fag", "skalaer", "utseende"],
    },
    { gruppe: "Trygghet", sider: ["kopi", "personvern"] },
    { gruppe: "Utenfor Økta", sider: ["kalender", "del"] },
    { gruppe: "", sider: ["om"] },
  ];

  return (
    <div
      className={`mx-auto flex min-h-0 w-full flex-1 flex-col ${side === "skalaer" ? "max-w-7xl" : "max-w-5xl"}`}
    >
      <IVerktoylinja>
        <span className="text-liten text-blekk-svak">{SIDENAVN[side]}</span>
        <span className="relative ml-auto">
          <label
            ref={sokFelt}
            className="flex h-8 w-60 items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--color-blekk)_5%,transparent)] px-3 focus-within:bg-ark/80"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="shrink-0 text-blekk-svak"
              aria-hidden
            >
              <circle cx="7" cy="7" r="4.6" />
              <path d="M10.5 10.5l3 3" strokeLinecap="round" />
            </svg>
            <input
              value={sokTekst}
              onChange={(e) => {
                setSokTekst(e.target.value);
                setSokValg(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSokValg((v) => Math.min(treff.length - 1, v + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSokValg((v) => Math.max(0, v - 1));
                } else if (e.key === "Enter" && treff[sokValg]) {
                  hopp(treff[sokValg]);
                } else if (e.key === "Escape") {
                  e.stopPropagation();
                  setSokTekst("");
                }
              }}
              placeholder="Søk i innstillinger"
              aria-label="Søk i innstillinger"
              className="uten-fokusring min-w-0 flex-1 bg-transparent text-liten outline-none placeholder:text-blekk-svak"
            />
          </label>
          {sokTekst.trim() &&
            sokFelt.current &&
            createPortal(
              <div
                className="glass-meny fixed z-50 w-80 rounded-[14px] p-[5px]"
                style={{
                  top: sokFelt.current.getBoundingClientRect().bottom + 6,
                  right:
                    window.innerWidth -
                    sokFelt.current.getBoundingClientRect().right,
                }}
              >
                {treff.length === 0 ? (
                  <p className="px-3 py-2.5 text-liten text-blekk-svak">
                    Ingen treff
                  </p>
                ) : (
                  treff.map((x, i) => (
                    <button
                      key={`${x.side}:${x.k}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => hopp(x)}
                      className={`flex w-full items-baseline gap-2 rounded-[9px] px-2.5 py-2 text-left text-liten ${
                        i === sokValg ? "bg-flate" : "hover:bg-flate"
                      }`}
                    >
                      <span className="truncate">{x.tittel}</span>
                      <small className="ml-auto shrink-0 text-etikett text-blekk-svak">
                        {SIDENAVN[x.side]}
                      </small>
                    </button>
                  ))
                )}
              </div>,
              document.body,
            )}
        </span>
      </IVerktoylinja>

      <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)]">
        <nav
          ref={meny}
          aria-label="Innstillinger"
          className="relative overflow-y-auto border-r border-linje-svak pr-3.5 pt-1"
        >
          {markorY !== null && (
            <span
              aria-hidden
              className="inn-meny-markor"
              style={{ transform: `translateY(${markorY}px)` }}
            />
          )}
          {MENY.map((g, gi) => (
            <div key={gi}>
              {g.gruppe ? (
                <p className="mx-2.5 mb-1.5 mt-3.5 text-[11px] uppercase tracking-[0.06em] text-blekk-svak">
                  {g.gruppe}
                </p>
              ) : (
                g.gruppe === "" && <div className="h-3.5" />
              )}
              {g.sider.map((id) => (
                <button
                  key={id}
                  data-side={id}
                  onClick={() => setSide(id)}
                  aria-current={side === id ? "page" : undefined}
                  className="inn-meny-knapp"
                >
                  <span className="inn-meny-ikon">
                    <Menyikon navn={id} />
                  </span>
                  {SIDENAVN[id]}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="min-h-0 overflow-auto pb-10 pl-10 pr-2 pt-1.5">
          <div key={side} className={side === "skalaer" ? "" : "max-w-[720px]"}>
            {side === "deg" && <SideDeg skolear={skolear} />}
            {side === "generelt" && <SideGenerelt />}
            {side === "skolear" && (
              <SideSkolear
                skolear={skolear}
                fag={fag}
                onEndret={onEndret}
                onApneSkoleruta={onApneSkoleruta}
              />
            )}
            {side === "fag" && (
              <SideFag fag={fag} onEndret={onEndret} onApneFag={onApneFag} />
            )}
            {side === "skalaer" && <Skalaer />}
            {side === "utseende" && <SideUtseende />}
            {side === "kopi" && <SideKopi skolear={skolear} />}
            {side === "personvern" && (
              <SidePersonvern skolear={skolear} onEndret={onEndret} />
            )}
            {side === "kalender" && (
              <SideKalender skolear={skolear} fag={fag} />
            )}
            {side === "del" && (
              <Side
                tittel="Del med kollegaer"
                intro="Gi en kollega oppsettet ditt. Elevene følger aldri med."
              >
                <div data-k="deloppsett">
                  <DelOppsett
                    harAr={!!skolear}
                    startTekst={oppsettTekst}
                    onImportert={() => {
                      onOppsettLest?.();
                      onEndret();
                    }}
                  />
                </div>
              </Side>
            )}
            {side === "om" && <SideOm />}
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- Deg

/** Mentor-ordene (appen sier mentor; et språkvalg kan komme senere). */
const MENTOR = "mentor";
const MENTORKLASSE = "mentor_klasse";

function SideDeg({ skolear }: { skolear: Skolear }) {
  const [navn, setNavn] = useState("");
  const [skole, setSkole] = useState("");
  const [mentor, setMentor] = useState(false);
  const [klasse, setKlasse] = useState("");
  const [klasser, setKlasser] = useState<Klasse[]>([]);
  useEffect(() => {
    void hentInnstilling(LAERERNAVN).then((v) => setNavn(v ?? ""));
    void hentInnstilling(SKOLENAVN).then((v) => setSkole(v ?? ""));
    void hentInnstilling(MENTOR).then((v) => setMentor(v === "pa"));
    void hentInnstilling(MENTORKLASSE).then((v) => setKlasse(v ?? ""));
    void hentKlasser(skolear.id).then(setKlasser);
  }, [skolear.id]);

  async function velgKlasse(id: string) {
    setKlasse(id);
    await settInnstilling(MENTORKLASSE, id);
    if (!id) return;
    // Elevene i klassen blir mentorelever (§3.2). Andre røres ikke.
    const elever = (await hentElever(skolear.id)).filter(
      (e) => e.klasseId === id && !e.mentor,
    );
    for (const e of elever) await settMentor(e.id, skolear.id, true);
    const k = klasser.find((x) => x.id === id);
    if (elever.length > 0)
      visToast(`${elever.length} elever i ${k?.navn} er mentorelever`);
  }

  return (
    <Side tittel="Deg" intro="Det som står på årsplaner og utskrifter.">
      <Gruppe>
        <Rad
          k="navn"
          tittel="Ditt navn"
          hjelp="Står som faglærer på årsplanen."
        >
          <Feltinput
            value={navn}
            onChange={(e) => {
              setNavn(e.target.value);
              void settInnstilling(LAERERNAVN, e.target.value.trim());
            }}
          />
        </Rad>
        <Rad
          k="skole"
          tittel="Skole"
          hjelp="Står i toppen av årsplanen. Tomt felt = ingenting."
        >
          <Feltinput
            value={skole}
            onChange={(e) => {
              setSkole(e.target.value);
              void settInnstilling(SKOLENAVN, e.target.value.trim());
            }}
          />
        </Rad>
      </Gruppe>
      <Gruppe tittel="Mentor">
        <Rad
          k="mentor"
          tittel="Jeg er mentor"
          hjelp="For mentorsamtaler og mentorelevene dine."
        >
          <Vippebryter
            pa={mentor}
            etikett="Jeg er mentor"
            onBytt={(pa) => {
              setMentor(pa);
              void settInnstilling(MENTOR, pa ? "pa" : "av");
            }}
          />
        </Rad>
        {mentor && (
          <Rad
            k="mentorklasse"
            tittel="For klasse"
            hjelp="Elevene i klassen blir mentorelever i år. Enkeltelever kan endres i elevkortet."
          >
            <select
              value={klasse}
              onChange={(e) => void velgKlasse(e.target.value)}
              className="inn-felt"
            >
              <option value="">Ingen</option>
              {klasser.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.navn}
                </option>
              ))}
            </select>
          </Rad>
        )}
      </Gruppe>
    </Side>
  );
}

// --------------------------------------------------------------- Generelt

/** Mindre / Vanlig / Større → --tekst-skala. */
const TEKSTVALG = [
  { verdi: "0.87", navn: "Mindre" },
  { verdi: "0.93", navn: "Vanlig" },
  { verdi: "1.07", navn: "Større" },
];

/** Eldre baser kan ha andre trinn lagret; vis det nærmeste. */
function narmesteTekstvalg(v: string): string {
  const n = Number(v);
  return TEKSTVALG.reduce((best, t) =>
    Math.abs(Number(t.verdi) - n) < Math.abs(Number(best.verdi) - n) ? t : best,
  ).verdi;
}

function SideGenerelt() {
  const [tekstskala, setTekstskala] = useState("0.93");
  const [varighet, setVarighet] = useState("180");
  const [planvisning, setPlanvisning] = useState<Planvisning>("enkel");
  const [idag, settIdag] = useLagretInnstilling<"enkel" | "full">(
    "idag_oppsett",
    "enkel",
    (v) => (v === "full" ? "full" : "enkel"),
    String,
  );
  useEffect(() => {
    void hentInnstilling(TEKSTSKALA).then((v) => setTekstskala(v ?? "0.93"));
    void hentInnstilling("standard_varighet_min").then((v) =>
      setVarighet(v ?? "180"),
    );
    void hentInnstilling(PLANVISNING).then((v) =>
      setPlanvisning(lesPlanvisning(v)),
    );
  }, []);

  return (
    <Side tittel="Generelt" intro="Hvordan Økta oppfører seg i hverdagen.">
      <Gruppe tittel="Forsiden">
        <Rad
          k="idag"
          tittel="I dag"
          hjelp="Enkel: dagens økter og hvem du bør følge opp. Full: også uka, frister og innsats. Du kan bytte når som helst, også fra forsiden."
        >
          <Bryter
            storrelse="liten"
            verdi={idag}
            settVerdi={(v) => settIdag(v as "enkel" | "full")}
            valg={[
              { id: "enkel", navn: "Enkel" },
              { id: "full", navn: "Full" },
            ]}
          />
        </Rad>
      </Gruppe>
      <Gruppe tittel="Økter">
        <Rad
          k="varighet"
          tittel="Standard lengde på nye økter"
          hjelp="Gjelder bare nye økter. Fagets egen lengde går foran, og økta kan alltid endres."
        >
          <Feltinput
            type="number"
            bredde="w-16"
            className="text-right tabular-nums"
            value={varighet}
            onChange={(e) => setVarighet(e.target.value)}
            onBlur={async () => {
              const n = Math.round(Number(varighet));
              if (n > 0) {
                await settInnstilling("standard_varighet_min", String(n));
                setVarighet(String(n));
              }
            }}
          />
          <span className="text-liten text-blekk-dempet">min</span>
        </Rad>
        <Rad
          k="plan"
          tittel="Øktplan"
          hjelp="Enkel: en liste med minutter. Full: tidslinje du drar i, med beskrivelser og pauser. Det du skrev i Full, blir liggende om du bytter."
        >
          <Bryter
            storrelse="liten"
            valg={[
              { id: "enkel", navn: "Enkel" },
              { id: "full", navn: "Full" },
            ]}
            verdi={planvisning}
            settVerdi={async (v) => {
              setPlanvisning(lesPlanvisning(v));
              await settInnstilling(PLANVISNING, v);
            }}
          />
        </Rad>
      </Gruppe>
      <Gruppe tittel="Lesbarhet">
        {/*
          Hele typeskalaen ganges med dette tallet, så forholdet mellom
          gradene holder seg uansett valg.
        */}
        <Rad
          k="tekst"
          tittel="Tekststørrelse"
          hjelp="Gjelder med en gang. Med Større får færre enn tretti elever plass i skåringslista uten å rulle."
        >
          <Bryter
            storrelse="liten"
            valg={TEKSTVALG.map((t) => ({ id: t.verdi, navn: t.navn }))}
            verdi={narmesteTekstvalg(tekstskala)}
            settVerdi={async (v) => {
              setTekstskala(v);
              settTekstskala(v);
              await settInnstilling(TEKSTSKALA, v);
            }}
          />
        </Rad>
      </Gruppe>
    </Side>
  );
}

// ---------------------------------------------------------------- Skoleår

const datoTekst = (d: string) =>
  new Date(`${d}T12:00:00`)
    .toLocaleDateString("nb-NO", { day: "numeric", month: "numeric" })
    .replace(/\.$/, "");

/** Neste skoleårs navn og datoer: 52 uker senere, så ukedagene står. */
export function nesteSkolear(a: {
  navn: string;
  start: string;
  slutt: string;
}) {
  const flytt = (d: string) => {
    const x = new Date(`${d}T12:00:00`);
    x.setDate(x.getDate() + 364);
    return x.toLocaleDateString("sv-SE");
  };
  const [f, t] = a.navn.split("/").map(Number);
  const navn =
    Number.isFinite(f) && Number.isFinite(t)
      ? `${f + 1}/${String((t + 1) % 100).padStart(2, "0")}`
      : `${a.navn} (neste)`;
  return { navn, start: flytt(a.start), slutt: flytt(a.slutt) };
}

function SideSkolear({
  skolear,
  fag,
  onEndret,
  onApneSkoleruta,
}: {
  skolear: Skolear;
  fag: FagIAr[];
  onEndret: () => void;
  onApneSkoleruta: () => void;
}) {
  const [ar, setAr] = useState<Skolear[]>([]);
  const [fri, setFri] = useState<Fridag[]>([]);
  const [nyFri, setNyFri] = useState({ navn: "", fra: "", til: "" });
  const [navn, setNavn] = useState(skolear.navn);
  useEffect(() => {
    void hentSkolear().then(setAr);
    void hentFridager(skolear.id).then(setFri);
    setNavn(skolear.navn);
  }, [skolear.id]);
  const neste = nesteSkolear(skolear);
  const finnesNeste = ar.some((a) => a.navn === neste.navn);
  const andre = ar.filter((a) => a.id !== skolear.id);

  async function forbered() {
    const ok = await bekreft(
      `Lage skoleåret ${neste.navn}?\n\n` +
        `${datoTekst(neste.start)} til ${datoTekst(neste.slutt)}, med de samme ` +
        `${fag.length} fagene som i år. Elevene følger ikke med.\n\n` +
        `Du blir i ${skolear.navn} til du gjør det nye aktivt. Der kan du ` +
        "hente perioder fra i år når øktene er lagt inn.",
    );
    if (!ok) return;
    const id = await opprettSkolear(neste.navn, neste.start, neste.slutt);
    for (const f of fag)
      await leggFagIAr(
        id,
        f.fagkode,
        f.navn,
        f.farge,
        f.grepKode,
        f.arstimetall,
      );
    // Det aktive året står som før; det nye gjøres aktivt når du vil.
    await settAktivtSkolear(skolear.id);
    setAr(await hentSkolear());
    visToast(`${neste.navn} er laget med ${fag.length} fag`);
  }

  return (
    <Side
      tittel="Skoleår"
      intro="Datoene styrer kalenderen, årsplanen og hvilke dager øktene havner på."
    >
      <Gruppe tittel={`${skolear.navn} · aktivt`}>
        <Rad k="aret" tittel="Navn">
          <Feltinput
            bredde="w-28"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            onBlur={async () => {
              const n = navn.trim();
              if (n && n !== skolear.navn) {
                await endreSkolear(skolear.id, { navn: n });
                onEndret();
              }
            }}
          />
        </Rad>
        <Rad k="start" tittel="Første skoledag">
          <Feltinput
            type="date"
            bredde="w-40"
            value={skolear.start}
            onChange={async (e) => {
              if (e.target.value) {
                await endreSkolear(skolear.id, { start: e.target.value });
                onEndret();
              }
            }}
          />
        </Rad>
        <Rad k="slutt" tittel="Siste skoledag">
          <Feltinput
            type="date"
            bredde="w-40"
            value={skolear.slutt}
            onChange={async (e) => {
              if (e.target.value) {
                await endreSkolear(skolear.id, { slutt: e.target.value });
                onEndret();
              }
            }}
          />
        </Rad>
      </Gruppe>

      <Gruppe
        tittel="Ferier og fridager"
        fot="Fridagene står i kalenderen og i Året. Økter som faller på en fridag, flyttes ikke."
      >
        {fri.length === 0 ? (
          <Rad
            tittel={
              <span className="text-blekk-svak">Ingen lagt inn ennå.</span>
            }
          />
        ) : (
          fri.map((f) => (
            <div
              key={f.id}
              className="inn-rad min-h-[40px] py-2 text-[calc(13.5px*var(--tekst-skala))]"
            >
              <span className="flex-1">{f.navn}</span>
              <span className="tabular-nums text-blekk-dempet">
                {f.fra === f.til
                  ? datoTekst(f.fra)
                  : `${datoTekst(f.fra)} – ${datoTekst(f.til)}`}
              </span>
              <button
                aria-label={`Fjern ${f.navn}`}
                title="Fjern"
                onClick={async () => {
                  await slettFridag(f.id);
                  setFri(await hentFridager(skolear.id));
                  onEndret();
                }}
                className="px-1 text-blekk-svak hover:text-feil"
              >
                ×
              </button>
            </div>
          ))
        )}
        <form
          data-k="nyfri"
          className="inn-rad flex-nowrap gap-2 py-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const n = nyFri.navn.trim();
            if (!n || !nyFri.fra) return;
            const til =
              nyFri.til && nyFri.til >= nyFri.fra ? nyFri.til : nyFri.fra;
            await opprettFridag(skolear.id, n, "ferie", nyFri.fra, til);
            setNyFri({ navn: "", fra: "", til: "" });
            setFri(await hentFridager(skolear.id));
            onEndret();
          }}
        >
          <Feltinput
            bredde="min-w-0 flex-1"
            placeholder="Ny ferie eller fridag"
            aria-label="Navn"
            value={nyFri.navn}
            onChange={(e) => setNyFri({ ...nyFri, navn: e.target.value })}
          />
          <Feltinput
            type="date"
            bredde="w-[140px]"
            aria-label="Fra"
            min={skolear.start}
            max={skolear.slutt}
            value={nyFri.fra}
            onChange={(e) => setNyFri({ ...nyFri, fra: e.target.value })}
          />
          <span className="text-blekk-svak">–</span>
          <Feltinput
            type="date"
            bredde="w-[140px]"
            aria-label="Til"
            min={nyFri.fra || skolear.start}
            max={skolear.slutt}
            value={nyFri.til}
            onChange={(e) => setNyFri({ ...nyFri, til: e.target.value })}
          />
          <Knapp type="submit" disabled={!nyFri.navn.trim() || !nyFri.fra}>
            Legg til
          </Knapp>
        </form>
        <Rad
          k="fri"
          tittel="Skoleruta"
          hjelp="Hendelser, planleggingsdager og alt annet ved ruta."
        >
          <Knapp onClick={onApneSkoleruta}>
            Åpne skoleruta <Ikon navn="pil" />
          </Knapp>
        </Rad>
      </Gruppe>

      <Gruppe tittel="Neste skoleår">
        <Rad
          k="nytt"
          tittel={`Start ${neste.navn}`}
          hjelp={
            finnesNeste
              ? `${neste.navn} finnes allerede. Gjør det aktivt under Andre år når du vil bytte.`
              : "Lager året med de samme fagene. Perioder og tema hentes i Året når øktene er lagt inn. Elevene følger ikke med."
          }
        >
          <Knapp disabled={finnesNeste} onClick={() => void forbered()}>
            Forbered …
          </Knapp>
        </Rad>
      </Gruppe>

      {andre.length > 0 && (
        <Gruppe
          tittel="Andre år"
          fot="Å bytte aktivt år rører ingen data. Det endrer bare hva appen viser."
        >
          {andre.map((a, i) => (
            <Rad
              key={a.id}
              k={i === 0 ? "tidligere" : undefined}
              tittel={a.navn}
              hjelp={`${datoTekst(a.start)} ${a.start.slice(0, 4)} – ${datoTekst(a.slutt)} ${a.slutt.slice(0, 4)}`}
            >
              <Knapp
                onClick={async () => {
                  await settAktivtSkolear(a.id);
                  // Hele appen henger på det aktive året, men du skal bli
                  // stående i innstillingene.
                  setAr(await hentSkolear());
                  onEndret();
                }}
              >
                Gjør aktivt
              </Knapp>
              <button
                onClick={async () => {
                  const n = await tellForSkolear(a.id);
                  const ok = await bekreft(
                    `Slette skoleåret ${a.navn}?\n\n` +
                      `${n.fag} fag i året, ${n.okter} økter, ` +
                      `${n.skaringer} skåringer, ${n.vurderinger} vurderinger, ` +
                      `${n.klasser} klasser.\n\n` +
                      "Fagene blir stående i fagbanken, og elevene blir " +
                      "stående. De lever på tvers av år. Det som " +
                      "forsvinner er dette årets økter og koblinger.\n\n" +
                      "Sikkerhetskopien fra i dag er veien tilbake.",
                  );
                  if (!ok) return;
                  await slettSkolear(a.id);
                  setAr(await hentSkolear());
                  onEndret();
                }}
                className="px-1 text-liten text-blekk-svak hover:text-feil"
              >
                Slett
              </button>
            </Rad>
          ))}
        </Gruppe>
      )}
    </Side>
  );
}

// -------------------------------------------------------------------- Fag

function SideFag({
  fag,
  onEndret,
  onApneFag,
}: {
  fag: FagIAr[];
  onEndret: () => void;
  onApneFag?: () => void;
}) {
  const ark = useArk();
  const [apen, setApen] = useState<string | null>(null);
  return (
    <Side
      tittel="Fag"
      intro="Fagene dine i år. Klikk fargen for å bytte, eller faget for timer, lengde og skala."
    >
      <Gruppe tittel="I år">
        {fag.length === 0 && (
          <Rad
            tittel={<span className="text-blekk-svak">Ingen fag ennå.</span>}
          />
        )}
        {fag.map((f, i) => (
          <div key={f.id} data-k={`fag-${f.id}`}>
            <div className="inn-rad" data-k={i === 0 ? "fagfarge" : undefined}>
              <button
                onClick={() => setApen(apen === f.id ? null : f.id)}
                title="Bytt farge"
                aria-expanded={apen === f.id}
                className="h-[22px] w-[22px] shrink-0 rounded-[7px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] transition-[background] duration-300"
                style={{ background: f.farge ?? "var(--color-linje-sterk)" }}
              />
              <button
                onClick={() => ark.apneFag(f.id)}
                className="min-w-[220px] flex-1 text-left"
              >
                <span className="text-[calc(13.5px*var(--tekst-skala))]">
                  <b className="font-semibold">{f.kode}</b>{" "}
                  <span className="text-blekk-dempet">{f.navn}</span>
                </span>
                <span className="mt-[3px] block text-etikett text-blekk-svak">
                  {[
                    f.arstimetall ? `${f.arstimetall} årstimer` : null,
                    f.grepKode ? `Udir ${f.grepKode}` : "uten Udir-kode",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
              <span className="text-[16px] text-blekk-svakest">›</span>
            </div>
            {apen === f.id && (
              <div className="flex flex-wrap items-center gap-1.5 pb-3 pl-[50px] pr-4 pt-1">
                {FAGFARGER.map((c) => {
                  const brukt = fag.some((x) => x.id !== f.id && x.farge === c);
                  return (
                    <button
                      key={c}
                      onClick={async () => {
                        await endreFag(f.fagId, { farge: c });
                        setApen(null);
                        onEndret();
                      }}
                      title={brukt ? "Brukt av et annet fag" : c}
                      aria-pressed={f.farge === c}
                      className={`h-[18px] w-[18px] rounded-md ${brukt ? "opacity-25" : ""} ${
                        f.farge === c
                          ? "shadow-[0_0_0_2px_var(--color-ark),0_0_0_3.5px_var(--color-blekk)]"
                          : ""
                      }`}
                      style={{ background: c }}
                    />
                  );
                })}
                <span className="ml-1.5 text-etikett text-blekk-svak">
                  Dempet = brukt av et annet fag
                </span>
              </div>
            )}
          </div>
        ))}
        <Rad
          k="nyfag"
          tittel="Legg til fag"
          hjelp="Søk i Udirs fagkoder, eller hent et fag du har hatt før fra fagbanken."
        >
          {onApneFag && (
            <Knapp onClick={onApneFag}>
              Fag i år <Ikon navn="pil" />
            </Knapp>
          )}
        </Rad>
      </Gruppe>
    </Side>
  );
}

// ---------------------------------------------------------------- Skalaer

// --------------------------------------------------------------- Utseende

function SideUtseende() {
  const [tema, setTema] = useState<Tema>("system");
  const [glass, setGlass] = useState<Glass>("pa");
  const [bevegelse, setBevegelse] = useState<Bevegelse>("system");
  const [palett, setPalett] = useState<Palett>("fiolett");
  useEffect(() => {
    void hentInnstilling(TEMA).then((v) =>
      setTema(v === "lys" || v === "mork" ? v : "system"),
    );
    void hentInnstilling(GLASS).then((v) => setGlass(v === "av" ? "av" : "pa"));
    void hentInnstilling(BEVEGELSE).then((v) =>
      setBevegelse(v === "pa" || v === "dempet" || v === "av" ? v : "system"),
    );
    void hentInnstilling(PALETT).then((v) => {
      const p = PALETTER.find((x) => x.id === v);
      setPalett(p ? p.id : "fiolett");
    });
  }, []);

  return (
    <Side tittel="Utseende" intro="Hvordan Økta ser ut på din maskin.">
      <Gruppe>
        <Rad
          k="palett"
          tittel="Fargepalett"
          hjelp="Bytter knapper, markering og bakgrunn. Trafikklyset og fagfargene er like i alle."
        >
          {/*
            Hexene står her og ikke som tokens med vilje: alle seks skal vises
            samtidig, uavhengig av hvilken som er på.
          */}
          <div className="grid grid-cols-3 gap-1.5">
            {PALETTER.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPalett(p.id);
                  void lagrePalett(p.id);
                }}
                aria-pressed={palett === p.id}
                className={`flex h-[34px] w-24 items-center gap-2 rounded-[9px] px-2 text-etikett ${
                  palett === p.id
                    ? "font-medium shadow-[inset_0_0_0_1.5px_var(--color-blekk)]"
                    : "shadow-[inset_0_0_0_1px_var(--color-linje-medium)]"
                }`}
              >
                <span className="flex overflow-hidden rounded-[5px]">
                  <i
                    className="block h-[18px] w-2.5"
                    style={{ background: p.aksent }}
                  />
                  <i
                    className="block h-[18px] w-2.5"
                    style={{ background: p.valgt }}
                  />
                </span>
                {p.navn}
              </button>
            ))}
          </div>
        </Rad>
        <Rad k="glass" tittel="Glass" hjelp={glasshjelp()}>
          <Vippebryter
            pa={glass === "pa"}
            etikett="Glass"
            onBytt={(pa) => {
              const v = pa ? "pa" : "av";
              setGlass(v);
              void lagreGlass(v);
            }}
          />
        </Rad>
        <Rad k="bev" tittel="Bevegelse" hjelp={bevegelseshjelp()}>
          <Bryter
            storrelse="liten"
            valg={[
              { id: "system", navn: `Som ${systemnavn()}` },
              { id: "pa", navn: "På" },
              { id: "dempet", navn: "Dempet" },
              { id: "av", navn: "Av" },
            ]}
            verdi={bevegelse}
            settVerdi={(v) => {
              setBevegelse(v as Bevegelse);
              void lagreBevegelse(v as Bevegelse);
            }}
          />
        </Rad>
      </Gruppe>
      <Gruppe>
        <Rad
          k="lysmork"
          tittel="Lys eller mørk"
          hjelp={`Mørk er ikke ferdig ennå, og kan se rar ut enkelte steder. «Som ${systemnavn()}» skifter av seg selv. Utskriften av årsplanen er alltid lys.`}
        >
          <Bryter
            storrelse="liten"
            valg={[
              { id: "system", navn: `Som ${systemnavn()}` },
              { id: "lys", navn: "Lys" },
              { id: "mork", navn: "Mørk" },
            ]}
            verdi={tema}
            settVerdi={(v) => {
              setTema(v as Tema);
              void lagreTema(v as Tema);
            }}
          />
        </Rad>
      </Gruppe>
    </Side>
  );
}

// --------------------------------------------------------- Sikkerhetskopi

function SideKopi({ skolear }: { skolear: Skolear }) {
  const [kopier, setKopier] = useState<Kopi[]>([]);
  const [kopimappe, setKopimappe] = useState("");
  const [tarKopi, setTarKopi] = useState(false);
  const [alle, setAlle] = useState(false);
  const [kopimelding, setKopimelding] = useState<{
    ok: boolean;
    tekst: string;
  } | null>(null);
  const [arkivmappe, setArkivmappe] = useState("");
  const [arkivMelding, setArkivMelding] = useState<string | null>(null);
  const [arkiverer, setArkiverer] = useState(false);

  async function lastKopier() {
    setKopier((await hentKopier()) ?? []);
    setKopimappe((await hentKopimappe()) ?? "");
  }
  useEffect(() => {
    void lastKopier();
    void invoke<string | null>("hent_arkivmappe").then((v) =>
      setArkivmappe(v ?? ""),
    );
  }, []);

  /**
   * Bytter arbeidsfila. Stor nok til en tydelig bekreftelse, men ikke
   * uopprettelig: den nåværende basen sikres i backup-mappa først.
   */
  async function gjenopprett(sti: string, navn: string) {
    const svar = await bekreft(
      `Gjenopprett fra ${navn}?\n\n` +
        `Alt du har lagt inn etter at denne kopien ble tatt, forsvinner fra ` +
        `arbeidsfila. Den nåværende basen legges i backup-mappa først, så du ` +
        `kan gå tilbake.\n\nAppen starter på nytt.`,
    );
    if (!svar) return;
    try {
      await gjenopprettFra(sti);
    } catch (e) {
      alert(`Gjenopprettingen stoppet: ${e}`);
    }
  }

  async function velgFil() {
    const valgt = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "SQLite-database", extensions: ["sqlite", "db"] }],
    });
    if (typeof valgt === "string")
      await gjenopprett(valgt, valgt.split("/").pop() ?? valgt);
  }

  const synlige = alle ? kopier : kopier.slice(0, 5);

  return (
    <Side
      tittel="Sikkerhetskopi"
      intro="Økta tar en kopi av alt én gang i døgnet når den åpnes, og beholder de 30 nyeste. Kopiene blir liggende på maskinen."
    >
      <div
        data-k="kopinaa"
        className="mb-1 flex items-center gap-3 rounded-[14px] bg-[color-mix(in_srgb,var(--color-god)_8%,var(--color-ark))] px-4 py-3.5 text-[calc(13.5px*var(--tekst-skala))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-god)_20%,transparent)]"
      >
        {kopier.length > 0 && <Hake />}
        <div className="min-w-0 flex-1">
          <b className="font-semibold">
            {kopier.length > 0
              ? `Siste kopi: ${kopier[0].navn}`
              : "Ingen kopier ennå"}
          </b>
          <div className="mt-0.5 text-etikett text-blekk-svak">
            {kopier.length} kopier · kopien skrives med SQLites egen VACUUM
            INTO, som gir en hel database også hvis noe skrives samtidig
          </div>
          {kopimelding && (
            <div
              role="status"
              className={`mt-1 text-etikett ${kopimelding.ok ? "text-god" : "text-feil"}`}
            >
              {kopimelding.tekst}
            </div>
          )}
        </div>
        <Knapp
          disabled={tarKopi}
          onClick={async () => {
            setTarKopi(true);
            setKopimelding(null);
            try {
              const sti = await taKopiNa();
              await lastKopier();
              const kl = new Date().toTimeString().slice(0, 5);
              setKopimelding({
                ok: true,
                tekst: sti
                  ? `Kopien er tatt kl. ${kl}: ${sti.split("/").pop()}`
                  : `Kopien er tatt kl. ${kl}.`,
              });
            } catch (e) {
              setKopimelding({
                ok: false,
                tekst: `Kopien ble ikke tatt: ${String(e)}`,
              });
            } finally {
              setTarKopi(false);
            }
          }}
        >
          {tarKopi ? "Tar kopi …" : "Ta kopi nå"}
        </Knapp>
      </div>

      <Gruppe tittel="Kopier">
        {synlige.map((k) => (
          <div
            key={k.navn}
            className="inn-rad min-h-[40px] py-2 text-[calc(13px*var(--tekst-skala))]"
          >
            <span className="flex-1 font-mono text-etikett">
              {k.navn}
              {!k.daglig && (
                <span className="ml-2 font-sans text-blekk-svak">
                  før gjenoppretting
                </span>
              )}
            </span>
            <span className="tabular-nums text-blekk-dempet">
              {(k.bytes / 1024).toFixed(0)} kB
            </span>
            <button
              onClick={() => void gjenopprett(`${kopimappe}/${k.navn}`, k.navn)}
              className="text-etikett text-aksent hover:underline"
            >
              Gjenopprett …
            </button>
          </div>
        ))}
        <div className="inn-rad min-h-[40px] py-2">
          {kopier.length > 5 && (
            <button
              onClick={() => setAlle(!alle)}
              className="text-liten text-aksent"
            >
              {alle ? "Vis færre" : `Vis alle ${kopier.length}`}
            </button>
          )}
          <button
            onClick={() => void velgFil()}
            className="ml-auto text-liten text-blekk-dempet hover:text-blekk"
          >
            Åpne en .sqlite-fil …
          </button>
        </div>
      </Gruppe>

      <Gruppe tittel="Hvor" fot={synkadvarsel()}>
        <Rad
          k="kopimappe"
          tittel="Mappe"
          hjelp="Legg den gjerne på en ekstern disk. Ikke i en skytjeneste: kopiene har elevdata."
        >
          {kopimappe && <Sti>{kopimappe}</Sti>}
          {kopimappe && (
            <Knapp onClick={() => void revealItemInDir(kopimappe)}>
              Vis i {filbehandler()}
            </Knapp>
          )}
        </Rad>
      </Gruppe>

      <Gruppe tittel="Arkiv">
        <Rad
          k="arkiv"
          tittel="Lesbart arkiv"
          hjelp="Hele basen som markdown og CSV, én fil per elev og per fag, skrevet ved hver oppstart. Kan åpnes i Obsidian eller hva som helst, også uten Økta. Denne mappa kan ligge i en skytjeneste; databasen selv skal aldri det. Kjønn og bilde er aldri med."
          under={
            arkivMelding && (
              <p className="text-liten text-blekk-dempet">{arkivMelding}</p>
            )
          }
        >
          {arkivmappe && <Sti>{arkivmappe}</Sti>}
          <Knapp
            onClick={async () => {
              const valgt = await invoke<string | null>("velg_arkivmappe");
              if (!valgt) return;
              setArkivmappe(valgt);
              setArkivMelding(null);
            }}
          >
            {arkivmappe ? "Bytt …" : "Velg mappe …"}
          </Knapp>
          {arkivmappe && (
            <Knapp
              disabled={arkiverer}
              onClick={async () => {
                setArkiverer(true);
                setArkivMelding(null);
                try {
                  const r = await skrivArkiv(skolear);
                  setArkivMelding(
                    r === null
                      ? "Ingen mappe valgt."
                      : `${r.skrevet} filer skrevet.` +
                          (r.feil.length > 0
                            ? ` ${r.feil.length} feilet.`
                            : ""),
                  );
                } catch (e) {
                  setArkivMelding(String(e));
                } finally {
                  setArkiverer(false);
                }
              }}
            >
              {arkiverer ? "Skriver …" : "Skriv nå"}
            </Knapp>
          )}
        </Rad>
      </Gruppe>
    </Side>
  );
}

// ------------------------------------------------------------- Personvern

function SidePersonvern({
  skolear,
  onEndret,
}: {
  skolear: Skolear;
  onEndret: () => void;
}) {
  const [datamappe, setDatamappe] = useState<string | null>(null);
  const [visBilder, setVisBilder] = useState(visesElevbilder);
  const [elever, setElever] = useState<
    { id: string; fornavn: string; etternavn: string }[]
  >([]);
  const [elev, setElev] = useState("");
  const [ar, setAr] = useState<Skolear[]>([]);
  const [tidligere, setTidligere] = useState("");
  const lesInn = () => {
    void hentAlleElever().then(setElever);
    void hentSkolear().then((a) => setAr(a.filter((x) => x.id !== skolear.id)));
  };
  useEffect(() => {
    void appDataDir()
      .then(setDatamappe)
      .catch(() => {});
    lesInn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skolear.id]);

  async function slettEn() {
    const e = elever.find((x) => x.id === elev);
    if (!e) return;
    const n = await tellForElever([e.id]);
    if (!(await bekreft(slettElevtekst([`${e.fornavn} ${e.etternavn}`], n))))
      return;
    await slettElevHelt(e.id);
    setElev("");
    lesInn();
    onEndret();
    visToast(`${e.fornavn} ${e.etternavn} er slettet`);
  }

  async function slettAr() {
    const a = ar.find((x) => x.id === tidligere);
    if (!a) return;
    const n = await tellEleverIAr(a.id);
    if (n.elever === 0) {
      visToast(`Ingen elever i ${a.navn}`);
      return;
    }
    const hva = [
      n.skaringer && `${n.skaringer} skåringer`,
      n.vurderinger && `${n.vurderinger} vurderingsresultater`,
      n.notater && `${n.notater} notater`,
    ].filter(Boolean);
    const ok = await bekreft(
      `Slette elevene fra ${a.navn}?\n\n` +
        `${n.elever} elever. ` +
        (n.helt > 0
          ? `${n.helt} av dem finnes bare i ${a.navn} og slettes helt. `
          : "") +
        (n.elever - n.helt > 0
          ? `${n.elever - n.helt} går også i et annet år og blir der. `
          : "") +
        (hva.length > 0 ? `Med dem går ${hva.join(", ")} fra ${a.navn}.` : "") +
        "\n\nFag, økter og planer blir stående.\n\n" +
        "Sikkerhetskopien fra i dag er veien tilbake.",
    );
    if (!ok) return;
    await slettEleverIAr(a.id);
    setTidligere("");
    lesInn();
    onEndret();
    visToast(`Elevene fra ${a.navn} er slettet`);
  }

  async function slettBilder() {
    const ok = await bekreft(
      "Slette alle elevbildene?\n\nBildene tømmes fra basen. " +
        "Du kan lese dem inn igjen fra InSchool-utskriften.",
    );
    if (!ok) return;
    const n = await slettAlleElevbilder();
    visToast(n === 1 ? "1 bilde er slettet" : `${n} bilder er slettet`);
  }

  const linjer = [
    "Alt ligger på denne maskinen. Ingen konto, ingen sky.",
    "Økta går bare på nett hvis du slår på publisering til en kalenderserver. Søket i Udirs fag er lokalt.",
    "Kjønn og bilde blir aldri med i eksport, utskrift eller arkiv.",
    "Kalenderen får aldri notater eller skår. Mentorsamtaler bare med fornavn og klokkeslett, og bare hvis du slår det på.",
  ];
  return (
    <Side tittel="Personvern" intro="Hva Økta lagrer, og hvor det går.">
      <div data-k="lagres" className="inn-grp px-4 py-1.5">
        {linjer.map((l) => (
          <div
            key={l}
            className="flex items-start gap-2.5 border-t border-linje-svak py-2 text-[calc(13.5px*var(--tekst-skala))] leading-normal first:border-t-0"
          >
            <Hake />
            <span>{l}</span>
          </div>
        ))}
      </div>
      <Gruppe tittel="Elevdata">
        <Rad
          tittel="Innsyn for en elev"
          hjelp="Åpne eleven og velg Innsyn i ⋯-menyen. Det gir én fil med alt Økta har om eleven."
        />
        <Rad
          tittel="Notatene"
          hjelp="Notatfeltene er ditt arbeidsmateriale. Helse, hjemmeforhold og andre særlige kategorier hører ikke hjemme der."
        />
        <Rad
          k="visbilder"
          tittel="Vis elevbilder"
          hjelp="Av: alle bildene byttes med plassholderen, f.eks. når skjermen vises for klassen. Bildene blir liggende."
        >
          <Vippebryter
            pa={visBilder}
            etikett="Vis elevbilder"
            onBytt={(pa) => {
              setVisBilder(pa);
              void settVisElevbilder(pa);
            }}
          />
        </Rad>
        <Rad
          k="slettbilder"
          tittel="Slett alle elevbilder"
          hjelp="Tømmer bildene fra basen. Elevene blir stående."
        >
          <Knapp onClick={() => void slettBilder()}>Slett bildene</Knapp>
        </Rad>
        <Rad
          tittel="Databasen"
          hjelp={
            <>
              Ligger i{" "}
              <code className="break-words text-etikett">
                {datamappe ?? "appens datamappe"}
              </code>
              .
            </>
          }
        />
      </Gruppe>
      <Gruppe
        tittel="Slett"
        fot="Sikkerhetskopien fra i dag er veien tilbake hvis det var feil."
      >
        <Rad
          k="slettelev"
          tittel="Slett en elev helt"
          hjelp="Eleven og alt som er ført på hen, i alle skoleår."
        >
          <select
            value={elev}
            onChange={(e) => setElev(e.target.value)}
            className="inn-felt"
          >
            <option value="">Velg elev</option>
            {elever.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fornavn} {e.etternavn}
              </option>
            ))}
          </select>
          <Knapp onClick={() => void slettEn()} disabled={!elev}>
            Slett
          </Knapp>
        </Rad>
        <Rad
          k="slettar"
          tittel="Slett elevene fra et tidligere år"
          hjelp="Elevene og skåren deres fra året går. Fag, økter og planer blir stående."
        >
          <select
            value={tidligere}
            onChange={(e) => setTidligere(e.target.value)}
            className="inn-felt"
            disabled={ar.length === 0}
          >
            <option value="">
              {ar.length === 0 ? "Ingen andre år" : "Velg år"}
            </option>
            {ar.map((a) => (
              <option key={a.id} value={a.id}>
                {a.navn}
              </option>
            ))}
          </select>
          <Knapp onClick={() => void slettAr()} disabled={!tidligere}>
            Slett
          </Knapp>
        </Rad>
      </Gruppe>
    </Side>
  );
}

// --------------------------------------------------------------- Kalender

function SideKalender({ skolear, fag }: { skolear: Skolear; fag: FagIAr[] }) {
  const [feedPa, setFeedPa] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [feedFeil, setFeedFeil] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const [dav, setDav] = useState<caldav.Oppsett>({
    base: "",
    bruker: "",
    pa: false,
    kalendere: {},
    mentorPa: false,
    mentorKalender: "",
  });
  const [davPassord, setDavPassord] = useState("");
  const [davHarPassord, setDavHarPassord] = useState(false);
  const [davMelding, setDavMelding] = useState<string | null>(null);
  const [davFeil, setDavFeil] = useState<string | null>(null);
  const [davJobber, setDavJobber] = useState(false);

  useEffect(() => {
    void (async () => {
      const pa = await kalender.erPa();
      setFeedPa(pa);
      if (pa) setFeedUrl(await kalender.hentUrl());
      setDav(await caldav.hentOppsett());
      setDavHarPassord(await caldav.harPassord());
    })();
  }, []);

  async function lagre() {
    setDavFeil(null);
    setDavMelding(null);
    await caldav.lagreOppsett(dav);
    if (davPassord) {
      await caldav.lagrePassord(davPassord);
      setDavPassord("");
      setDavHarPassord(true);
    }
    setDavMelding("Lagret.");
  }

  return (
    <Side
      tittel="Kalender"
      intro="Få øktene inn i kalenderen du bruker fra før. Velg én av måtene."
    >
      <Gruppe
        tittel={erMac ? "Abonner på denne Macen" : "Abonner på denne maskinen"}
      >
        <Rad
          k="strom"
          tittel="Kalenderstrøm"
          hjelp="Kalenderen din abonnerer på årsplanen og oppdaterer seg selv. Bare denne maskinen får tak i den, og den inneholder fagkode, tema, dato og varighet, aldri elevnavn, skåringer eller notater."
          under={
            <>
              {feedFeil && <p className="text-liten text-feil">{feedFeil}</p>}
              {feedPa && feedUrl && (
                <div>
                  <div className="flex items-center gap-2">
                    <Sti>{feedUrl}</Sti>
                    <Knapp
                      onClick={async () => {
                        await navigator.clipboard.writeText(feedUrl);
                        setKopiert(true);
                        setTimeout(() => setKopiert(false), 1500);
                      }}
                    >
                      {kopiert ? "Kopiert" : "Kopier"}
                    </Knapp>
                  </div>
                  <p className="mt-2 text-etikett leading-normal text-blekk-svak">
                    {erMac
                      ? "I Kalender: Arkiv → Nytt kalenderabonnement, lim inn adressen, og velg oppdatering hvert femte minutt. Velger du iCloud som plassering, lastes timeplanen opp til Apple og følger med til telefonen; På min Mac blir den her. Strømmen oppdaterer seg bare mens appen kjører."
                      : "Lim inn adressen som et kalenderabonnement i kalenderprogrammet på denne maskinen. Adressen virker bare her, og strømmen oppdaterer seg bare mens appen kjører."}
                  </p>
                </div>
              )}
            </>
          }
        >
          <Vippebryter
            pa={feedPa}
            etikett="Kalenderstrøm"
            onBytt={async (pa) => {
              setFeedPa(pa);
              setFeedFeil(null);
              await kalender.settPa(pa);
              if (!pa) return;
              try {
                setFeedUrl(await kalender.start(skolear));
              } catch (err) {
                setFeedFeil(String(err));
                setFeedPa(false);
                await kalender.settPa(false);
              }
            }}
          />
        </Rad>
      </Gruppe>

      <Gruppe
        tittel="Publiser til en kalenderserver (CalDAV)"
        fot="Det eneste stedet Økta sender noe ut (§8.1): fag, tittel, dato, klokkeslett, sted og agenda. Aldri elevnavn, skåringer eller notater."
      >
        <Rad
          k="dav"
          tittel="Publiser automatisk"
          hjelp="Når du endrer en økt, sendes den noen sekunder etter. Bare øktene som faktisk er endret. Ett fag per kalender, så elevene kan abonnere på sitt."
        >
          <Vippebryter
            pa={dav.pa}
            etikett="Publiser automatisk"
            onBytt={async (pa) => {
              setDav((d) => ({ ...d, pa }));
              await caldav.lagreOppsett({ pa });
            }}
          />
        </Rad>
        <Rad k="davadr" tittel="Adresse til kalendermappa">
          <Feltinput
            bredde="w-72"
            value={dav.base}
            onChange={(e) => setDav((d) => ({ ...d, base: e.target.value }))}
            placeholder="https://…/remote.php/dav/calendars/brukernavn"
          />
        </Rad>
        <Rad k="davbr" tittel="Brukernavn">
          <Feltinput
            bredde="w-52"
            value={dav.bruker}
            onChange={(e) => setDav((d) => ({ ...d, bruker: e.target.value }))}
          />
        </Rad>
        <Rad
          k="davpw"
          tittel="Passord"
          hjelp={`Bruk et app-passord, ikke hovedpassordet ditt. Det lagres i ${nokkelringen()}, aldri i databasen.`}
        >
          <Feltinput
            type="password"
            bredde="w-52"
            value={davPassord}
            placeholder={davHarPassord ? "••••••••  lagret" : "App-passord"}
            onChange={(e) => setDavPassord(e.target.value)}
          />
        </Rad>
        <Rad
          tittel="Kalender per fag"
          hjelp="Navnet på kalenderen på serveren. Tomt = faget publiseres ikke."
          under={
            <div className="grid gap-1.5">
              {fag.length === 0 ? (
                <p className="text-liten text-blekk-svak">
                  Ingen fag i skoleåret.
                </p>
              ) : (
                fag.map((f) => (
                  <label
                    key={f.id}
                    className="flex items-center gap-2 text-liten"
                  >
                    <span className="flex w-20 shrink-0 items-center gap-1.5 font-medium">
                      <Fagfirkant farge={f.farge} />
                      {f.kode}
                    </span>
                    <Feltinput
                      bredde="flex-1"
                      value={dav.kalendere[f.id] ?? ""}
                      placeholder="tomt = publiseres ikke"
                      onChange={(e) =>
                        setDav((d) => ({
                          ...d,
                          kalendere: { ...d.kalendere, [f.id]: e.target.value },
                        }))
                      }
                    />
                  </label>
                ))
              )}
            </div>
          }
        />
        {/*
          Mentorsamtalene har sin egen bryter: et hakk satt i august skal ikke
          begynne å sende elevfornavn i november (§8.1).
        */}
        <Rad
          k="davmentor"
          tittel="Publiser mentorsamtalene"
          hjelp="Én hendelse per samtale: «Mentorsamtale med Vera», på samtalens tidspunkt. Bare fornavn og klokkeslett. Denne kalenderen bør ikke deles med andre."
          under={
            <div>
              <label className="flex items-center gap-2 text-liten">
                <span className="w-20 shrink-0 font-medium">Kalender</span>
                <Feltinput
                  bredde="w-56"
                  value={dav.mentorKalender}
                  placeholder="f.eks. mentorsamtaler"
                  onChange={(e) =>
                    setDav((d) => ({ ...d, mentorKalender: e.target.value }))
                  }
                  onBlur={async (e) =>
                    await caldav.lagreOppsett({
                      mentorKalender: e.target.value,
                    })
                  }
                />
              </label>
              {dav.mentorPa && !dav.mentorKalender.trim() && (
                <p className="mt-1 text-etikett text-varsel">
                  Publiseringen er på, men ingen kalender er satt, så ingenting
                  sendes.
                </p>
              )}
              <p className="mt-1 text-etikett text-blekk-svak">
                Navnet på samlingen slik den heter på serveren. Den må finnes
                fra før; Økta oppretter ikke kalendere og leser aldri noe
                tilbake.
              </p>
            </div>
          }
        >
          <Vippebryter
            pa={dav.mentorPa}
            etikett="Publiser mentorsamtalene"
            onBytt={async (mentorPa) => {
              setDav((d) => ({ ...d, mentorPa }));
              await caldav.lagreOppsett({ mentorPa });
            }}
          />
        </Rad>
        <div className="inn-rad">
          <Knapp onClick={() => void lagre()}>Lagre</Knapp>
          <Knapp
            disabled={!dav.base || !dav.bruker}
            onClick={async () => {
              setDavFeil(null);
              setDavMelding(null);
              try {
                // Testen leser passordet fra nøkkelringen, så det du nettopp
                // skrev må lagres først.
                if (davPassord) {
                  await caldav.lagrePassord(davPassord);
                  setDavPassord("");
                  setDavHarPassord(true);
                }
                await caldav.lagreOppsett(dav);
                setDavMelding(await caldav.test(dav.base, dav.bruker));
              } catch (e) {
                setDavFeil(String(e));
              }
            }}
          >
            Test tilkoblingen
          </Knapp>
          <Knapp
            variant="primar"
            disabled={davJobber || !dav.base}
            onClick={async () => {
              setDavJobber(true);
              setDavFeil(null);
              setDavMelding(null);
              try {
                const r = await caldav.publiser(skolear);
                setDavMelding(
                  `${r.skrevet} skrevet, ${r.slettet} fjernet, ` +
                    `${r.uendret} uendret.` +
                    (r.feil.length > 0 ? ` ${r.feil.length} feilet.` : ""),
                );
                if (r.feil.length > 0)
                  setDavFeil(r.feil.slice(0, 3).join("\n"));
              } catch (e) {
                setDavFeil(String(e));
              } finally {
                setDavJobber(false);
              }
            }}
          >
            {davJobber ? "Publiserer …" : "Publiser nå"}
          </Knapp>
          {davHarPassord && (
            <Knapp
              variant="stille"
              onClick={async () => {
                await caldav.glemPassord();
                setDavHarPassord(false);
                setDavMelding(`Passordet er slettet fra ${nokkelringen()}.`);
              }}
            >
              Glem passordet
            </Knapp>
          )}
          {(davMelding || davFeil) && (
            <div className="w-full">
              {davMelding && (
                <p className="text-liten text-god">{davMelding}</p>
              )}
              {davFeil && (
                <p className="whitespace-pre-wrap text-liten text-feil">
                  {davFeil}
                </p>
              )}
            </div>
          )}
        </div>
      </Gruppe>
    </Side>
  );
}

// ---------------------------------------------------------------- Om Økta

/** Siste utgivelse. Åpnes i nettleseren; appen selv går aldri dit (§1). */
const UTGIVELSER_URL = "https://github.com/fbedsvaag/okta/releases/latest";

function SideOm() {
  const [versjon, setVersjon] = useState("");
  const [datamappe, setDatamappe] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  useEffect(() => {
    void getVersion()
      .then(setVersjon)
      .catch(() => {});
    void appDataDir()
      .then(setDatamappe)
      .catch(() => {});
  }, []);
  return (
    <Side
      tittel="Om Økta"
      intro="Undervisningsplanlegging og elevoppfølging. Laget av lektor Fredrik Geving Bedsvaag."
    >
      <Gruppe fot="Kjønn gjettes fra fornavn med navnestatistikk fra Statistisk sentralbyrå (SSB), CC BY 4.0.">
        <Rad k="versjon" tittel="Versjon">
          <span className="flex items-center gap-2 tabular-nums text-blekk-dempet">
            <Merke storrelse={18} />
            {versjon || "–"}
          </span>
        </Rad>
        <Rad
          k="oppdatering"
          tittel="Se etter oppdatering"
          hjelp="Åpner siste utgivelse på GitHub i nettleseren. Økta sjekker aldri selv."
        >
          <Knapp
            onClick={() =>
              void import("@tauri-apps/plugin-opener").then((o) =>
                o.openUrl(UTGIVELSER_URL),
              )
            }
          >
            Åpne …
          </Knapp>
        </Rad>
        {SKJEMA_URL && (
          <Rad
            k="tilbake"
            tittel="Gi tilbakemelding"
            hjelp={
              kopiert
                ? "Kopiert. Lim inn under «Versjon og skjerm» i skjemaet."
                : "Åpner et skjema i nettleseren. Versjon og system kopieres, aldri elever eller innhold."
            }
          >
            <Knapp
              onClick={() =>
                void giTilbakemelding("innstillinger", () => {
                  setKopiert(true);
                  setTimeout(() => setKopiert(false), 6000);
                })
              }
            >
              Skriv …
            </Knapp>
          </Rad>
        )}
        <Rad k="datamappe" tittel="Datamappe">
          {datamappe && <Sti>{datamappe}</Sti>}
          {datamappe && (
            <Knapp onClick={() => void revealItemInDir(datamappe)}>
              Vis i {filbehandler()}
            </Knapp>
          )}
        </Rad>
      </Gruppe>
    </Side>
  );
}
