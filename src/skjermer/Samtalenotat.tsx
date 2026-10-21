import { useEffect, useRef, useState } from "react";
import {
  endreElevnotat,
  opprettElevnotat,
  type Elevnotat,
} from "../data/elevnotat";
import type { Samtaledag } from "../data/samtale";
import {
  fjernResultat,
  hentSkalaverdier,
  hentVurderingElever,
  settResultat,
} from "../data/vurderinger";
import { taster, type Skalaverdi } from "../skala";
import { skalafarge, TEMATEKST } from "../ui/farger";
import { hentElevbilde } from "../data/elevbilde";
import { visesElevbilder } from "../ui/Elevfoto";
import { hentInnstilling, settInnstilling } from "../data/skolear";
import { Elevbilde } from "../ui/Elevbilde";
import { useInngang } from "../ui/bevegelse";
import { hovedtast, tast as visTast } from "../ui/taster";
import { Velger } from "../ui/Velger";

/** Hvor lenge det skal være stille i feltet før notatet lagres. */
const PAUSE_MS = 400;

/** Vinduets vanlige størrelse, og grensene det kan dras mellom. */
const VANLIG = { w: 672, h: 560 };
const MINST = { w: 440, h: 340 };
const STORRELSE = "samtalenotat_storrelse";

/** De fire hjørnene: hvilken vei de drar, og hvor de står. */
const HJORNER = [
  { id: "nv", sx: -1, sy: -1, plass: "left-0 top-0" },
  { id: "nh", sx: 1, sy: 1, plass: "bottom-0 right-0" },
  { id: "ov", sx: -1, sy: 1, plass: "bottom-0 left-0" },
  { id: "oh", sx: 1, sy: -1, plass: "right-0 top-0" },
] as const;

/**
 * Størrelsen på vinduet, som kan dras i hjørnene — som i Photoshop:
 * uten tast står det motsatte hjørnet fast, ⌥ skalerer fra midten, og ⇧
 * holder proporsjonene. Tastene kan trykkes og slippes mens du drar.
 * Størrelsen huskes til neste gang (i `innstilling`); plasseringen gjør
 * det ikke — vinduet åpner alltid midt på skjermen.
 */
function useSkalerbar() {
  const [storrelse, setStorrelse] = useState(VANLIG);
  const [forskyvning, setForskyvning] = useState({ x: 0, y: 0 });

  useEffect(() => {
    void hentInnstilling(STORRELSE).then((v) => {
      if (!v) return;
      try {
        const s = JSON.parse(v) as { w: number; h: number };
        setStorrelse(begrens(s.w, s.h));
      } catch {
        // En ødelagt verdi gir bare vanlig størrelse.
      }
    });
  }, []);

  function begrens(w: number, h: number) {
    return {
      w: Math.round(Math.min(Math.max(w, MINST.w), window.innerWidth - 32)),
      h: Math.round(Math.min(Math.max(h, MINST.h), window.innerHeight - 32)),
    };
  }

  function begynnSkalering(e: React.PointerEvent, sx: number, sy: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY };
    const fra = storrelse;
    const fraForskyvning = forskyvning;
    let siste = fra;

    const flytt = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.x) * sx;
      const dy = (ev.clientY - start.y) * sy;
      // ⌥: fra midten — begge sider beveger seg, så endringen dobles.
      const fakt = ev.altKey ? 2 : 1;
      let w = fra.w + dx * fakt;
      let h = fra.h + dy * fakt;
      // ⇧: proporsjonene holdes, etter den aksen som har flyttet seg mest.
      if (ev.shiftKey) {
        const s = Math.max(w / fra.w, h / fra.h);
        w = fra.w * s;
        h = fra.h * s;
      }
      siste = begrens(w, h);
      setStorrelse(siste);
      // Vinduet står midtstilt. Uten ⌥ skal det motsatte hjørnet stå fast,
      // og da må midten flytte seg halve endringen i draretningen.
      setForskyvning(
        ev.altKey
          ? fraForskyvning
          : {
              x: fraForskyvning.x + (sx * (siste.w - fra.w)) / 2,
              y: fraForskyvning.y + (sy * (siste.h - fra.h)) / 2,
            },
      );
    };

    const slipp = () => {
      window.removeEventListener("pointermove", flytt);
      window.removeEventListener("pointerup", slipp);
      window.removeEventListener("pointercancel", slipp);
      void settInnstilling(STORRELSE, JSON.stringify(siste));
    };

    window.addEventListener("pointermove", flytt);
    window.addEventListener("pointerup", slipp);
    window.addEventListener("pointercancel", slipp);
  }

  function tilbakestill() {
    const s = begrens(VANLIG.w, VANLIG.h);
    setStorrelse(s);
    setForskyvning({ x: 0, y: 0 });
    void settInnstilling(STORRELSE, JSON.stringify(s));
  }

  return { storrelse, forskyvning, begynnSkalering, tilbakestill };
}

/**
 * Notatet fra én samtale, åpnet med et klikk på navnet i timeplanen.
 *
 * Formet som ⌘K-vinduet: navn, tidspunkt og oppgave øverst, et stort
 * skrivefelt, og skalaen til vurderingen nederst. Notatet bor i elevens
 * møtelogg (§4.7) med samtalen som kilde, så det står både i elevkortet og
 * ved eleven i vurderingslista.
 *
 * **Notatet lagres mens du skriver.** Et feiltrykk under en samtale skal
 * aldri koste det du har skrevet: teksten lagres etter en kort pause i
 * skrivingen, og alltid når vinduet lukkes — med Esc, et klikk utenfor
 * eller at noe annet tar over skjermen. Lagringene står i kø, så det aldri
 * blir laget to notater, og et tomt felt overskriver aldri et notat.
 */
export function Samtalenotat({
  elevId,
  navn,
  tid,
  oppgave,
  samtaleId,
  dag,
  notat,
  vurdering,
  vurderingsvalg,
  onVelgVurdering,
  onLukk,
}: {
  elevId: string;
  navn: string;
  /** «Torsdag 15. oktober · 08:30–08:50» */
  tid: string;
  /** oppgavenummeret og temaet, når samtalen har et */
  oppgave: { nr: number | null; tema: string; farge?: string } | null;
  samtaleId: string;
  dag: Samtaledag;
  /** notatet som finnes fra før, om noe */
  notat: Elevnotat | null;
  /** vurderingen trekningen hører til; null i mentorsamtaler */
  vurdering: { id: string; skalaId: string; tittel: string } | null;
  /**
   * Fagets vurderinger, når trekningen ikke er knyttet til noen ennå. Da
   * kan den knyttes her, og skalaen kommer fram. Tom i mentorsamtaler.
   */
  vurderingsvalg: { id: string; tittel: string }[];
  onVelgVurdering: (id: string) => void;
  /** kalles etter at alt er lagret */
  onLukk: () => void;
}) {
  const [tekst, setTekst] = useState(notat?.tekst ?? "");
  const [bilde, setBilde] = useState<string | null>(null);
  const { storrelse, forskyvning, begynnSkalering, tilbakestill } =
    useSkalerbar();
  const inne = useInngang();
  useEffect(() => {
    void hentElevbilde(elevId).then(setBilde);
  }, [elevId]);
  const [status, setStatus] = useState<"lagret" | "lagrer" | "feil" | null>(
    null,
  );
  const notatId = useRef<string | null>(notat?.id ?? null);
  const sist = useRef(notat?.tekst ?? "");
  const siste = useRef(tekst);
  siste.current = tekst;
  const ko = useRef<Promise<void>>(Promise.resolve());
  const tidtaker = useRef<number | null>(null);
  const lukker = useRef(false);
  // Feilet siste lagring, blir vinduet stående med teksten i.
  const feilet = useRef(false);

  function lagre(t: string): Promise<void> {
    ko.current = ko.current.then(async () => {
      // Et tomt felt overskriver aldri et notat — det er nettopp feiltrykket
      // som skal være ufarlig. Et notat slettes i elevkortet, med vilje.
      if (t.trim() === "" || t === sist.current) return;
      setStatus("lagrer");
      try {
        if (notatId.current) {
          await endreElevnotat(notatId.current, { tekst: t });
        } else {
          notatId.current = await opprettElevnotat(elevId, dag.skolearId, {
            dato: dag.dato,
            tekst: t,
            // Fagsamtalens notat henger på faget; mentorsamtalens står uten.
            skolearFagId: dag.skolearFagId,
            samtaleId,
          });
        }
        sist.current = t;
        feilet.current = false;
        setStatus("lagret");
      } catch (e) {
        console.error("samtalenotat:", e);
        feilet.current = true;
        setStatus("feil");
      }
    });
    return ko.current;
  }

  function planlegg(t: string) {
    if (tidtaker.current) window.clearTimeout(tidtaker.current);
    tidtaker.current = window.setTimeout(() => void lagre(t), PAUSE_MS);
  }

  async function lukk() {
    if (lukker.current) return;
    lukker.current = true;
    if (tidtaker.current) window.clearTimeout(tidtaker.current);
    await lagre(siste.current);
    // Gikk lagringen ikke gjennom, lukkes ikke vinduet: teksten skal stå
    // der til den er trygg.
    if (feilet.current) {
      lukker.current = false;
      return;
    }
    onLukk();
  }

  // Forsvinner vinduet uten å gå om lukk() — skjermen byttes, appen
  // lastes på nytt — lagres det som står, likevel.
  useEffect(
    () => () => {
      if (tidtaker.current) window.clearTimeout(tidtaker.current);
      if (!lukker.current) void lagre(siste.current);
    },
    [],
  );

  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        void lukk();
      }
      if (e.key === "Enter" && hovedtast(e)) {
        e.preventDefault();
        void lukk();
      }
    };
    window.addEventListener("keydown", tast, true);
    return () => window.removeEventListener("keydown", tast, true);
  }, []);

  return (
    <div
      // Bakgrunnen tones ned og blir så vidt uskarp, så samtalen er det
      // eneste som står fram (glass, DESIGN.md §7).
      data-inngang="teppe"
      data-inne={inne}
      className="matt-teppe fixed inset-0 z-50 flex items-center justify-center p-6"
      onMouseDown={(e) => e.target === e.currentTarget && void lukk()}
    >
      <div
        // Inngangen (10.1) tas bort når vinduet er flyttet: en overgang på
        // transform ville gjort at det henger etter musa.
        data-inngang={forskyvning.x || forskyvning.y ? undefined : "midt"}
        data-inne={inne}
        className="glass-matt relative flex flex-col overflow-hidden rounded-[26px]"
        style={{
          width: storrelse.w,
          height: storrelse.h,
          maxWidth: "100%",
          maxHeight: "100%",
          transform:
            forskyvning.x || forskyvning.y
              ? `translate(${forskyvning.x}px, ${forskyvning.y}px)`
              : undefined,
        }}
      >
        {HJORNER.map((h) => (
          <span
            key={h.id}
            aria-hidden
            onPointerDown={(e) => begynnSkalering(e, h.sx, h.sy)}
            onDoubleClick={tilbakestill}
            title={`Dra for å endre størrelsen · ${visTast("⌥")} fra midten · ${visTast("⇧")} holder proporsjonene · dobbeltklikk for vanlig størrelse`}
            className={`absolute z-10 h-5 w-5 touch-none ${h.plass}`}
            style={{ cursor: h.sx === h.sy ? "nwse-resize" : "nesw-resize" }}
          >
            {h.id === "nh" && (
              <svg
                viewBox="0 0 10 10"
                className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 text-blekk-svakest"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.2}
                strokeLinecap="round"
              >
                <path d="M9 3L3 9M9 6.5L6.5 9" />
              </svg>
            )}
          </span>
        ))}
        <div className="flex items-center gap-4 px-6 pb-4 pt-5">
          {bilde && visesElevbilder() ? (
            <Elevbilde src={bilde} storrelse={56} hjorne={14} />
          ) : (
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[14px] bg-flate text-tittel font-medium text-blekk-dempet">
              {navn
                .split(" ")
                .filter(Boolean)
                .map((d, i, a) => (i === 0 || i === a.length - 1 ? d[0] : ""))
                .join("")}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-tittel font-medium">{navn}</h2>
            <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-liten text-blekk-dempet">
              <span className="tabular-nums">{tid}</span>
              {oppgave && (
                <>
                  <span aria-hidden>·</span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    {oppgave.nr !== null && (
                      <span
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-[4px] text-mikro font-medium tabular-nums"
                        style={{
                          background: oppgave.farge,
                          color: TEMATEKST,
                        }}
                      >
                        {oppgave.nr}
                      </span>
                    )}
                    <span className="truncate">{oppgave.tema}</span>
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <textarea
          autoFocus
          value={tekst}
          onChange={(e) => {
            setTekst(e.target.value);
            planlegg(e.target.value);
          }}
          placeholder="Notat fra samtalen …"
          className="uten-fokusring min-h-0 flex-1 resize-none border-y border-linje-medium/70 bg-transparent px-6 py-4 text-medium leading-relaxed outline-none placeholder:text-blekk-svak"
        />

        <div className="flex flex-wrap items-center gap-3 px-6 py-3">
          {vurdering ? (
            <Skala
              vurdering={vurdering}
              elevId={elevId}
              skolearFagId={dag.skolearFagId}
            />
          ) : (
            vurderingsvalg.length > 0 && (
              // Uten vurdering finnes det ingen skala. Knyttes trekningen til
              // en her, kommer skalaen fram med en gang.
              <Velger
                verdi=""
                settVerdi={onVelgVurdering}
                etikett="Knytt til en vurdering"
                plassholder="Knytt til en vurdering for å sette resultat …"
                valg={vurderingsvalg.map((v) => ({
                  verdi: v.id,
                  tekst: v.tittel,
                }))}
              />
            )
          )}
          <span
            className={`ml-auto text-liten ${
              status === "feil" ? "text-feil" : "text-blekk-svak"
            }`}
          >
            {status === "lagrer"
              ? "Lagrer …"
              : status === "feil"
                ? "Kunne ikke lagre. Teksten står her ennå"
                : status === "lagret"
                  ? "Lagret"
                  : "Lagres mens du skriver"}
            {" · Esc lukker"}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Resultatet på vurderingen, med skalaen vurderingen har. Et klikk på
 * verdien som står, tar den bort igjen.
 */
function Skala({
  vurdering,
  elevId,
  skolearFagId,
}: {
  vurdering: { id: string; skalaId: string; tittel: string };
  elevId: string;
  skolearFagId: string | null;
}) {
  const [verdier, setVerdier] = useState<Skalaverdi[]>([]);
  const [valgt, setValgt] = useState<string | null>(null);

  useEffect(() => {
    void hentSkalaverdier(vurdering.skalaId).then(setVerdier);
    if (skolearFagId)
      void hentVurderingElever(vurdering.id, skolearFagId).then((rader) =>
        setValgt(rader.find((r) => r.elevId === elevId)?.skalaverdiId ?? null),
      );
  }, [vurdering.id, vurdering.skalaId, elevId, skolearFagId]);

  const tast = taster(verdier);

  return (
    <span
      className="flex flex-wrap items-center gap-1"
      title={vurdering.tittel}
    >
      {verdier.map((v) => {
        const pa = valgt === v.id;
        const farge = v.farge ? skalafarge(v.farge) : null;
        return (
          <button
            key={v.id}
            onClick={async () => {
              setValgt(pa ? null : v.id);
              if (pa) await fjernResultat(vurdering.id, elevId);
              else await settResultat(vurdering.id, elevId, v);
            }}
            title={`${v.kode}${v.etikett ? `: ${v.etikett}` : ""}${
              tast.get(v.id) ? ` (${tast.get(v.id)})` : ""
            }`}
            aria-pressed={pa}
            className={`flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-full border px-2.5 text-brod tabular-nums ${
              pa
                ? "border-aksent bg-valgt font-medium text-aksent"
                : "border-linje text-blekk-dempet hover:bg-[var(--glass-valgt)] hover:text-blekk"
            }`}
          >
            {farge && (
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: farge }}
              />
            )}
            {v.kode}
          </button>
        );
      })}
    </span>
  );
}
