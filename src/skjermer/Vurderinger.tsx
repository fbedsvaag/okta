import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  bekreftUtkast,
  hentVurderinger,
  hentVurderingsskalaer,
  opprettVurdering,
  hentOktvalg,
  knyttOkt,
  type Oktvalg,
  type Vurdering,
  type Vurderingstype,
} from "../data/vurderinger";
import {
  byggOversikt,
  filtrer,
  GRUPPENAVN,
  harMentorelever,
  hentSamtalelinjer,
  MENTORORD,
  type Oversiktsrad,
  type Oversiktstype,
  type Samtalelinje,
  type Statusgruppe,
} from "../data/vurderingsoversikt";
import { hentSamtaledager, type Samtaledag } from "../data/samtale";
import {
  hentRunder,
  opprettRunde,
  rundenavn,
  type Samtalerunde,
} from "../data/samtalerunde";
import { iDag } from "./tidsplan/Generator";
import { oktetikett } from "./Vurderingsfelter";
import type { FagIAr } from "../data/fag";
import type { Skala } from "../skala";
import { Fagfirkant, Felt, Kappet, Knapp } from "../ui/felles";
import { Tomside } from "../ui/Tomside";
import { useArk } from "../ui/Arkstabel";
import { lyttVurderinger } from "../data/endringer";
import { Velger } from "../ui/Velger";
import { useLagretInnstilling } from "../ui/useLagretInnstilling";
import { IVerktoylinja } from "../ui/Verktoylinje";
import {
  Utkastmerke,
  Vurderingsikon,
  vurderingstype,
} from "../ui/Vurderingsikon";

/**
 * Vurderinger og samtaler (SPEC §4.6, ARBEIDSLISTE 28.0, lerretet
 * VurderingerSamtaler): én fane for alt som har en tidsplan eller skal
 * føres. Gruppert etter status — Nå · Kommende · Til føring · Ferdig —
 * filtrert på type og fag. Mentorsamtaler står her for å samle
 * tidsplanene, men er ikke vurderinger, og vises bare for den som har
 * mentorelever.
 *
 * Egen skjerm, ikke en bolk inne i fagportalen: de samme vurderingene vises
 * både under faget og under eleven, så de bor ett sted og lånes ut derfra.
 */
export function Vurderinger({
  skolearId,
  fag,
  onApneTrekning,
}: {
  skolearId: string;
  fag: FagIAr[];
  /** fag-id eller «mentor»: samtaletrekkeren for det som ikke har eget ark */
  onApneTrekning: (id: string) => void;
}) {
  const [vurderinger, setVurderinger] = useState<Vurdering[]>([]);
  const [lastet, setLastet] = useState(false);
  const [linjer, setLinjer] = useState<Samtalelinje[]>([]);
  const [dager, setDager] = useState<Samtaledag[]>([]);
  const [runder, setRunder] = useState<Samtalerunde[]>([]);
  const [harMentor, setHarMentor] = useState(false);
  const [skalaer, setSkalaer] = useState<Skala[]>([]);
  const [valgt, setValgt] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useLagretInnstilling<
    Oversiktstype | "alle"
  >(
    "vurderinger_type",
    "alle",
    (v) =>
      v === "skriftlig" ||
      v === "muntlig" ||
      v === "innlevering" ||
      v === "mentor"
        ? v
        : "alle",
    String,
  );
  // Fagbrikkene: flervalg, ingen valgt = alle fag. Huskes.
  const [fagValg, setFagValg] = useLagretInnstilling<string[]>(
    "vurderinger_fag",
    [],
    (v) => (v ? v.split(",").filter(Boolean) : []),
    (v) => v.join(","),
  );
  const [ny, setNy] = useState<Vurderingstype | null>(null);
  const ark = useArk();

  async function last() {
    const [v, d, l, r] = await Promise.all([
      hentVurderinger(skolearId),
      hentSamtaledager(skolearId),
      hentSamtalelinjer(skolearId),
      hentRunder(skolearId),
    ]);
    setVurderinger(v);
    setDager(d);
    setLinjer(l);
    setRunder(r);
    setLastet(true);
  }

  useEffect(() => {
    void last();
    void hentVurderingsskalaer().then(setSkalaer);
    void harMentorelever(skolearId).then(setHarMentor);
  }, [skolearId]);
  // Vurderingen åpnes som et ark over lista; endres den der, skal lista
  // vise det med en gang.
  useEffect(() => lyttVurderinger(() => void last()), [skolearId]);
  // «Pågår · … er inne» skal følge klokka.
  const [naa, setNaa] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNaa(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const rader = useMemo(
    () =>
      byggOversikt({
        vurderinger,
        dager,
        linjer,
        harMentor,
        runder,
        naa,
      }),
    [vurderinger, dager, linjer, harMentor, runder, naa],
  );
  const fagSett = useMemo(
    () => new Set(fagValg.filter((id) => fag.some((f) => f.id === id))),
    [fagValg, fag],
  );
  const synlige = filtrer(rader, typeFilter, fagSett);

  function apne(r: Oversiktsrad) {
    setValgt(r.id);
    if ("vurdering" in r.apner) ark.apneVurdering(r.apner.vurdering);
    else if ("runde" in r.apner) ark.apneRunde(r.apner.runde);
    else onApneTrekning(r.apner.trekning);
  }

  const typer: [Oversiktstype | "alle", string][] = [
    ["alle", "Alle"],
    ["skriftlig", "Skriftlig"],
    ["muntlig", "Muntlig"],
    ["innlevering", "Innlevering"],
    ...(harMentor
      ? [["mentor", MENTORORD.samtaler] as [Oversiktstype, string]]
      : []),
  ];
  const utkast = synlige.filter((r) => r.utkast);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-auto">
      <IVerktoylinja>
        <span className="ml-auto" />
        <NyMeny
          harMentor={harMentor}
          kanVurdere={fag.length > 0}
          onVelg={(t) =>
            t === "mentor"
              ? void opprettRunde(
                  skolearId,
                  rundenavn(iDag(), MENTORORD.samtaler),
                ).then((id) => ark.apneRunde(id))
              : setNy(t)
          }
        />
      </IVerktoylinja>

      {lastet && rader.length === 0 && !ny ? (
        <Tomside
          tegning="vurderinger"
          tittel={
            fag.length === 0
              ? "Legg inn fagene dine først"
              : "Ingen vurderinger ennå"
          }
          tekst={
            fag.length === 0
              ? "Vurderingene hører til et fag. Når fagene er lagt inn, kan du lage prøver, muntlige vurderinger og innleveringer her."
              : "Lag en skriftlig prøve, en muntlig vurdering med tidsplan, eller en innlevering med frist."
          }
          hoved={
            fag.length > 0
              ? { tekst: "+ Ny vurdering", onKlikk: () => setNy("skriftlig") }
              : undefined
          }
          sekundar={
            harMentor
              ? {
                  tekst: MENTORORD.samtaler,
                  onKlikk: () =>
                    void opprettRunde(
                      skolearId,
                      rundenavn(iDag(), MENTORORD.samtaler),
                    ).then((id) => ark.apneRunde(id)),
                }
              : undefined
          }
          hint="Tips: du kan også lage en vurdering rett fra en økt."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {typer.map(([id, navn]) => (
              <Filterbrikke
                key={id}
                pa={typeFilter === id}
                onKlikk={() => setTypeFilter(id)}
              >
                {navn}
                <small className="text-[11.5px] tabular-nums opacity-60">
                  {id === "alle"
                    ? filtrer(rader, "alle", fagSett).length
                    : filtrer(rader, id, fagSett).length}
                </small>
              </Filterbrikke>
            ))}
            {fag.length > 1 && <span className="w-3" />}
            {fag.length > 1 &&
              fag.map((f) => (
                <Filterbrikke
                  key={f.id}
                  pa={fagSett.has(f.id)}
                  onKlikk={() =>
                    setFagValg(
                      fagSett.has(f.id)
                        ? [...fagSett].filter((x) => x !== f.id)
                        : [...fagSett, f.id],
                    )
                  }
                >
                  <Fagfirkant farge={f.farge} />
                  {f.kode}
                </Filterbrikke>
              ))}
          </div>

          {ny && (
            <div className="mt-4">
              <NyVurdering
                fag={fag}
                skalaer={skalaer}
                startType={ny}
                startFagId={fagSett.size === 1 ? [...fagSett][0] : fag[0]?.id}
                onLagret={async (id) => {
                  setNy(null);
                  await last();
                  setValgt(id);
                  ark.apneVurdering(id);
                }}
                onAvbryt={() => setNy(null)}
              />
            </div>
          )}

          {utkast.length > 0 && (
            <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-flate-svak px-3.5 py-2 text-liten text-blekk-dempet">
              <Utkastmerke />
              <span className="flex-1">
                {utkast.length} hentet fra i fjor. De står ikke blant fristene
                før du bekrefter dem.
              </span>
              <Knapp
                onClick={async () => {
                  await bekreftUtkast(utkast.map((r) => r.id));
                  await last();
                }}
              >
                Bekreft alle
              </Knapp>
            </div>
          )}

          {(Object.keys(GRUPPENAVN) as Statusgruppe[]).map((g) => {
            const gruppe = synlige.filter((r) => r.gruppe === g);
            if (gruppe.length === 0) return null;
            return (
              <section key={g}>
                <h2 className="mx-1 mb-2 mt-[22px] flex items-center gap-2 text-[calc(12px*var(--tekst-skala))] font-semibold text-blekk-dempet">
                  {GRUPPENAVN[g]}
                  <small className="font-normal text-blekk-svak">
                    {gruppe.length}
                  </small>
                </h2>
                {gruppe.map((r) => (
                  <Rad
                    key={`${r.type}-${r.id}`}
                    rad={r}
                    valgt={valgt === r.id}
                    onVelg={() => apne(r)}
                  />
                ))}
              </section>
            );
          })}
          {synlige.length === 0 && (
            <p className="mt-8 text-center text-brod text-blekk-dempet">
              Ingenting med dette filteret.
            </p>
          )}

          {harMentor && (
            <p className="mx-1 my-[18px] max-w-[640px] text-liten leading-relaxed text-blekk-svak">
              {MENTORORD.samtaler} ligger her for å samle alle tidsplanene, men
              er ikke vurderinger: de gir ingen karakter, og notatene vises
              aldri i faget.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Filterbrikke({
  pa,
  onKlikk,
  children,
}: {
  pa: boolean;
  onKlikk: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onKlikk}
      aria-pressed={pa}
      className={`inline-flex h-[30px] items-center gap-[7px] whitespace-nowrap rounded-full px-3 text-[calc(13px*var(--tekst-skala))] transition-colors duration-200 ${
        pa
          ? "bg-blekk text-ark"
          : "bg-ark text-blekk-dempet shadow-[inset_0_0_0_1px_var(--color-linje)] hover:text-blekk"
      }`}
    >
      {children}
    </button>
  );
}

/** «+ Ny ⌄»: de tre vurderingsformene, og under en strek mentorsamtaler. */
function NyMeny({
  harMentor,
  kanVurdere,
  onVelg,
}: {
  harMentor: boolean;
  kanVurdere: boolean;
  onVelg: (t: Vurderingstype | "mentor") => void;
}) {
  // Menyen legges i body: verktøylinja kapper alt som stikker ut av den.
  const [apen, setApen] = useState<{ right: number; top: number } | null>(null);
  const boks = useRef<HTMLDivElement>(null);
  const menyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!apen) return;
    const ut = (e: MouseEvent) => {
      const m = e.target as Node;
      if (!boks.current?.contains(m) && !menyRef.current?.contains(m))
        setApen(null);
    };
    const tast = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setApen(null);
    };
    window.addEventListener("mousedown", ut);
    window.addEventListener("keydown", tast, true);
    return () => {
      window.removeEventListener("mousedown", ut);
      window.removeEventListener("keydown", tast, true);
    };
  }, [apen]);

  const valg: [Exclude<Oversiktstype, "mentor">, string, string][] = [
    ["skriftlig", "Skriftlig prøve", "I en økt. Føres etterpå."],
    [
      "muntlig",
      "Muntlig vurdering",
      "Med tidsplan, oppgaver som trekkes og rubrikk.",
    ],
    ["innlevering", "Innlevering", "Med frist. Kryss av hvem som har levert."],
  ];
  const velg = (t: Vurderingstype | "mentor") => {
    setApen(null);
    onVelg(t);
  };
  return (
    <div ref={boks} className="relative">
      <button
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setApen((a) =>
            a
              ? null
              : { right: window.innerWidth - r.right, top: r.bottom + 8 },
          );
        }}
        aria-expanded={!!apen}
        className="flex h-8 items-center gap-1.5 rounded-full bg-aksent px-3.5 text-brod font-medium text-ark hover:bg-aksent-mork"
      >
        + Ny<span className="text-[11px] opacity-70">⌄</span>
      </button>
      {apen &&
        createPortal(
          <div
            ref={menyRef}
            className="glass-meny ny-meny-inn fixed z-[60] w-[330px] rounded-[16px] p-1.5"
            style={{ right: apen.right, top: apen.top }}
          >
            {kanVurdere &&
              valg.map(([t, navn, hint]) => (
                <button
                  key={t}
                  onClick={() => velg(t)}
                  className="flex w-full items-start gap-3 rounded-[11px] p-2.5 text-left hover:bg-flate"
                >
                  <Typeikon type={t} />
                  <span>
                    <b className="block text-[13.5px] font-medium">{navn}</b>
                    <small className="mt-0.5 block text-liten leading-snug text-blekk-svak">
                      {hint}
                    </small>
                  </span>
                </button>
              ))}
            {harMentor && (
              <>
                {kanVurdere && <div className="mx-2 my-1 h-px bg-linje-svak" />}
                <button
                  onClick={() => velg("mentor")}
                  className="flex w-full items-start gap-3 rounded-[11px] p-2.5 text-left hover:bg-flate"
                >
                  <Typeikon type="mentor" />
                  <span>
                    <b className="block text-[13.5px] font-medium">
                      {MENTORORD.samtaler}
                    </b>
                    <small className="mt-0.5 block text-liten leading-snug text-blekk-svak">
                      {MENTORORD.hjelp}
                    </small>
                  </span>
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Ikonet for formen, 30 × 30 som i lerretet. Egne tegninger. */
function Typeikon({ type }: { type: Oversiktstype }) {
  return (
    <span
      aria-hidden
      className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] ${
        type === "mentor"
          ? "bg-aksent/10 text-aksent"
          : "bg-flate text-blekk-dempet"
      }`}
    >
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {type === "skriftlig" && (
          <>
            <path d="M4 2.5h6l2.5 2.5v8.5h-8.5z" />
            <path d="M6 7h4.5M6 9.5h4.5" />
          </>
        )}
        {type === "muntlig" && (
          <path d="M3 4.5a2 2 0 012-2h6a2 2 0 012 2v4a2 2 0 01-2 2H8l-3 2.5v-2.5a2 2 0 01-2-2z" />
        )}
        {type === "innlevering" && (
          <>
            <path d="M8 2.5v7M5 6.5l3 3 3-3" />
            <path d="M3 11v2h10v-2" />
          </>
        )}
        {type === "mentor" && (
          <>
            <circle cx="6" cy="6" r="2.2" />
            <circle cx="11" cy="6.5" r="1.8" />
            <path d="M2.5 13c.6-2.2 2-3.2 3.5-3.2s2.9 1 3.5 3.2M10 10c1.5 0 2.8.8 3.4 2.6" />
          </>
        )}
      </svg>
    </span>
  );
}

const TYPENAVN: Record<Oversiktstype, string> = {
  skriftlig: "Skriftlig",
  muntlig: "Muntlig",
  innlevering: "Innlevering",
  mentor: MENTORORD.samtaler,
};

function Rad({
  rad: r,
  valgt,
  onVelg,
}: {
  rad: Oversiktsrad;
  valgt: boolean;
  onVelg: () => void;
}) {
  const mentor = r.type === "mentor";
  const pst = r.av > 0 ? Math.min(100, Math.round((r.ant / r.av) * 100)) : 0;
  return (
    <button
      onClick={onVelg}
      className={`mb-2 grid w-full grid-cols-[30px_minmax(0,1fr)_170px_150px_24px] items-center gap-3.5 rounded-[14px] px-3.5 py-3 text-left transition-shadow duration-200 ${
        mentor ? "bg-flate-svak" : "bg-ark"
      } ${
        r.pagar
          ? "shadow-[inset_0_0_0_1.5px_var(--color-aksent),0_6px_18px_rgba(74,61,125,.1)]"
          : valgt
            ? "shadow-[inset_0_0_0_1.5px_var(--color-linje-sterk)]"
            : "shadow-[inset_0_0_0_1px_var(--color-linje-svak)] hover:shadow-[inset_0_0_0_1.5px_var(--color-linje-sterk)]"
      } ${r.utkast ? "opacity-60" : ""}`}
    >
      <Typeikon type={r.type} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <Kappet
            verdi={r.tittel}
            klasse="min-w-0 text-[calc(14px*var(--tekst-skala))] font-medium"
          />
          {r.utkast && <Utkastmerke />}
        </div>
        <div className="mt-[3px] flex items-center gap-[7px] text-liten text-blekk-svak">
          {r.fagKode && <Fagfirkant farge={r.farge} />}
          <span className="truncate">
            {(mentor
              ? [MENTORORD.gruppe, "ingen karakter"]
              : [r.fagKode, TYPENAVN[r.type], r.skalaNavn]
            )
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-[calc(13px*var(--tekst-skala))] tabular-nums">
          {r.dato}
        </div>
        <div className="mt-[3px] flex items-center gap-[7px] text-liten text-blekk-svak">
          {r.pagar && (
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#3f9d49] shadow-[0_0_0_3px_#3f9d4926]" />
          )}
          <span className="truncate">{r.info}</span>
        </div>
      </div>
      <div>
        <div className="h-[5px] overflow-hidden rounded-[3px] bg-flate">
          <span
            className={`block h-full rounded-[3px] ${mentor ? "bg-aksent" : "bg-aksent/70"}`}
            style={{ width: `${pst}%` }}
          />
        </div>
        <div className="mt-[3px] text-liten tabular-nums text-blekk-svak">
          {r.av > 0 ? `${r.ant} av ${r.av}` : ""}
        </div>
      </div>
      <span className="text-[16px] text-blekk-svakest">›</span>
    </button>
  );
}

function NyVurdering({
  fag,
  skalaer,
  startType,
  startFagId,
  onLagret,
  onAvbryt,
}: {
  fag: FagIAr[];
  skalaer: Skala[];
  startType: Vurderingstype;
  startFagId?: string;
  onLagret: (id: string) => void;
  onAvbryt: () => void;
}) {
  const [fagId, setFagId] = useState(startFagId ?? fag[0]?.id ?? "");
  const [tittel, setTittel] = useState("");
  const [type, setType] = useState<Vurderingstype | "">(startType);
  const [frist, setFrist] = useState("");
  const [skalaId, setSkalaId] = useState("");
  // Økta prøven holdes i (skriftlig og innlevering). Muntlig velger øktene
  // i tidsplanen, så der står ikke feltet.
  const [oktId, setOktId] = useState("");
  const [okter, setOkter] = useState<Oktvalg[]>([]);
  useEffect(() => {
    setOktId("");
    if (fagId) void hentOktvalg(fagId).then(setOkter);
  }, [fagId]);

  // Fagets standard for nye vurderinger (29.2), ellers den første.
  const fagSkala = fag.find((f) => f.id === fagId)?.vurderingsskalaId;
  const valgtSkala = skalaId || fagSkala || skalaer[0]?.id || "";

  async function lagre() {
    if (!fagId || tittel.trim() === "" || !valgtSkala) return;
    const okt = okter.find((o) => o.id === oktId);
    const id = await opprettVurdering(
      fagId,
      valgtSkala,
      tittel.trim(),
      type || null,
      frist || okt?.dato || null,
    );
    if (okt && type !== "muntlig") await knyttOkt(id, okt.id);
    onLagret(id);
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 border border-linje bg-flate p-3">
      <label className="block">
        <Etikett>Fag</Etikett>
        <Velger
          verdi={fagId}
          settVerdi={setFagId}
          valg={fag.map((f) => ({
            verdi: f.id,
            tekst: f.kode,
            farge: f.farge,
            firkant: true,
          }))}
        />
      </label>

      <Felt
        etikett="Tittel"
        verdi={tittel}
        settVerdi={setTittel}
        plassholder="Fagartikkel: markedsanalyse"
        bredde="w-72"
        autoFocus
        onEnter={lagre}
      />

      <label className="block">
        <Etikett>Type</Etikett>
        <Velger
          verdi={type}
          settVerdi={(v) => setType(v as Vurderingstype | "")}
          valg={[
            { verdi: "", tekst: "Ingen type", dempet: true },
            ...(
              ["skriftlig", "muntlig", "innlevering", "praktisk"] as const
            ).map((t) => ({
              verdi: t,
              tekst: vurderingstype(t),
              ikon: <Vurderingsikon type={t} />,
            })),
          ]}
        />
      </label>

      {type !== "muntlig" && (
        <label className="block">
          <Etikett>Økt</Etikett>
          <Velger
            verdi={oktId}
            settVerdi={setOktId}
            bredde="w-56"
            valg={[
              { verdi: "", tekst: "Ingen økt", dempet: true },
              ...okter
                .filter((o) => o.dato >= iDag())
                .map((o) => ({ verdi: o.id, tekst: oktetikett(o) })),
            ]}
          />
        </label>
      )}

      <Felt
        etikett="Frist"
        verdi={frist}
        settVerdi={setFrist}
        type="date"
        bredde="w-40"
      />

      <label className="block">
        <Etikett>Skala</Etikett>
        <Velger
          verdi={valgtSkala}
          settVerdi={setSkalaId}
          valg={skalaer.map((s) => ({ verdi: s.id, tekst: s.navn }))}
        />
      </label>

      <Knapp
        variant="primar"
        onClick={lagre}
        disabled={!fagId || tittel.trim() === ""}
      >
        Opprett
      </Knapp>
      <Knapp variant="stille" onClick={onAvbryt}>
        Avbryt
      </Knapp>
    </div>
  );
}

function Etikett({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-etikett uppercase tracking-etikett text-blekk-dempet">
      {children}
    </span>
  );
}
