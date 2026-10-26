import { useCallback, useEffect, useMemo, useState } from "react";
import { hentMentorklasse } from "../data/samtalerunde";
import type { Skolear } from "../data/skolear";
import type { FagIAr } from "../data/fag";
import { hentOktrader } from "../data/oktrader";
import { hentElever, type ElevRad } from "../data/elever";
import {
  byggFolgOpp,
  GRUNNAVN,
  hentAvtalerTilFolgOpp,
  hentFrister,
  hentFulgt,
  settFulgtOpp,
  siden,
  type Folgopprad,
  type Grunnslag,
  samtaletekst,
} from "../data/folgopp";
import { leggTilMal } from "../data/samtalerunde";
import { lyttElever, lyttVurderinger } from "../data/endringer";
import { idag } from "../db";
import { useArk } from "../ui/Arkstabel";
import { Fagfirkant } from "../ui/felles";
import { Elevfoto } from "../ui/Elevfoto";
import { IVerktoylinja } from "../ui/Verktoylinje";
import { Tomside } from "../ui/Tomside";
import { MENTORORD } from "../data/mentorord";

const GRUNNFARGE: Record<Grunnslag, string> = {
  rod: "#c04a3d",
  ikkesett: "#9a90b8",
  borte: "#645d7a",
  frist: "#c9922e",
  avtale: "var(--color-aksent)",
};

const INNSATS: Record<string, string> = {
  gronn: "#3f9d49",
  gul: "#d9a92f",
  rod: "#c04a3d",
};

/**
 * Følg opp som egen liste (ARBEIDSLISTE 29.7, lerretet FolgOpp), fra «Se
 * alle» på I dag. Filtre for grunnene. Notat og navnet åpner elevkortet
 * over lista; «Til samtale» legger punktet på neste mentorsamtale;
 * «Fulgt opp ✓» glir rolig ut og kommer tilbake om noe nytt skjer.
 */
export function FolgOpp({
  skolear,
  fag,
  onTilbake,
}: {
  skolear: Skolear;
  fag: FagIAr[];
  onTilbake: () => void;
}) {
  const [rader, setRader] = useState<Folgopprad[] | null>(null);
  const [elever, setElever] = useState<Map<string, ElevRad>>(new Map());
  const [filter, setFilter] = useState<Grunnslag | "alle">("alle");
  const [ut, setUt] = useState<Set<string>>(new Set());
  const ark = useArk();
  // Mentoravtaler viser klassen når hele gruppa går i samme (29.7).
  const [mentorklasse, setMentorklasse] = useState<string | null>(null);
  useEffect(() => {
    void hentMentorklasse(skolear.id).then(setMentorklasse);
  }, [skolear.id]);

  const last = useCallback(async () => {
    const [o, f, a, fulgt, e] = await Promise.all([
      hentOktrader(skolear.id),
      hentFrister(skolear.id),
      hentAvtalerTilFolgOpp(),
      hentFulgt(),
      hentElever(skolear.id),
    ]);
    setElever(new Map(e.map((x) => [x.id, x])));
    setRader(byggFolgOpp({ rader: o, frister: f, avtaler: a, fulgt }));
  }, [skolear.id]);
  useEffect(() => {
    void last();
  }, [last]);
  useEffect(() => lyttVurderinger(() => void last()), [last]);
  useEffect(() => lyttElever(() => void last()), [last]);

  const fagAv = useMemo(() => new Map(fag.map((f) => [f.id, f])), [fag]);
  if (!rader) return null;
  const synlige = rader.filter(
    (r) => filter === "alle" || r.grunner.some((g) => g.slag === filter),
  );
  const antall = (s: Grunnslag | "alle") =>
    s === "alle"
      ? rader.length
      : rader.filter((r) => r.grunner.some((g) => g.slag === s)).length;
  const i = idag();
  const nokkel = (r: Folgopprad) => `${r.elevId}|${r.skolearFagId ?? ""}`;

  async function ferdig(r: Folgopprad) {
    // Raden glir ut først (DESIGN §8: rolig, ingen sprett), så lagres det.
    setUt((s) => new Set(s).add(nokkel(r)));
    await new Promise((x) => window.setTimeout(x, 380));
    await settFulgtOpp(
      r.elevId,
      r.grunner.map((g) => g.nokkel),
    );
    setUt((s) => {
      const n = new Set(s);
      n.delete(nokkel(r));
      return n;
    });
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-auto">
      <IVerktoylinja>
        <span className="text-liten text-blekk-svak">
          {rader.length} {rader.length === 1 ? "elev" : "elever"}
        </span>
        <span className="ml-auto" />
        <button
          onClick={onTilbake}
          className="h-8 rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate"
        >
          ‹ Tilbake til I dag
        </button>
      </IVerktoylinja>

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        {(["alle", ...Object.keys(GRUNNAVN)] as (Grunnslag | "alle")[]).map(
          (s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              aria-pressed={filter === s}
              className={`inline-flex h-[30px] items-center gap-[7px] rounded-full px-3 text-[13px] transition-colors duration-200 ${
                filter === s
                  ? "bg-blekk text-ark"
                  : "bg-ark text-blekk-dempet shadow-[inset_0_0_0_1px_var(--color-linje)] hover:text-blekk"
              }`}
            >
              {s === "alle" ? "Alle" : GRUNNAVN[s]}
              <small className="text-[11.5px] tabular-nums opacity-60">
                {antall(s)}
              </small>
            </button>
          ),
        )}
        <span className="flex-1" />
        <span className="text-liten text-blekk-svak">
          Alle fag · nyeste først
        </span>
      </div>

      {synlige.length === 0 ? (
        <Tomside
          tegning="folgopp"
          tittel="Ingen å følge opp her"
          tekst="Godt jobbet. Lista fylles av seg selv når noe dukker opp."
          hoved={{ tekst: "Tilbake til I dag", onKlikk: onTilbake }}
          hint="Rød sist, ikke sett, borte, frister og avtaler havner her."
        />
      ) : (
        synlige.map((r) => {
          const e = elever.get(r.elevId);
          const f = r.skolearFagId ? fagAv.get(r.skolearFagId) : undefined;
          const gar = ut.has(nokkel(r));
          return (
            <div
              key={nokkel(r)}
              className={`folg-rad mb-2 grid grid-cols-[38px_160px_minmax(0,1fr)_70px_70px_auto] items-center gap-3.5 rounded-[14px] bg-ark px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--color-linje-svak)] ${
                gar ? "folg-ut" : ""
              }`}
            >
              <Elevfoto
                elevId={r.elevId}
                storrelse={38}
                navn={e ? `${e.fornavn} ${e.etternavn}` : undefined}
              />
              <div className="min-w-0">
                <button
                  onClick={() => ark.apneElev(r.elevId)}
                  className="block truncate text-left text-[14px] font-medium hover:text-aksent"
                >
                  {e ? `${e.fornavn} ${e.etternavn}` : "Elev"}
                </button>
                <div className="mt-0.5 flex items-center gap-1.5 text-liten text-blekk-svak">
                  {f ? (
                    <>
                      <Fagfirkant farge={f.farge} />
                      {f.kode}
                    </>
                  ) : mentorklasse ? (
                    <>
                      <span className="h-2 w-2 shrink-0 rounded-[2px] bg-aksent" />
                      {mentorklasse}
                    </>
                  ) : (
                    MENTORORD.rolle
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set(r.grunner.map((g) => g.slag))].map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1.5 rounded-full bg-flate px-2 py-0.5 text-liten"
                    >
                      <i
                        className="inline-block h-[7px] w-[7px] rounded-full"
                        style={{ background: GRUNNFARGE[s] }}
                      />
                      {GRUNNAVN[s]}
                    </span>
                  ))}
                </div>
                <div className="mt-[5px] truncate text-[13px] text-blekk-dempet">
                  {r.grunner.map((g) => g.tekst).join(" · ")}
                </div>
              </div>
              <div className="flex gap-[3px]">
                {r.innsats.map((x, j) => (
                  <span
                    key={j}
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: (x && INNSATS[x]) || "#d5d8dd" }}
                  />
                ))}
              </div>
              <span className="text-liten text-blekk-svak">
                {r.dato ? siden(r.dato, i) : ""}
              </span>
              <div className="flex gap-1.5">
                <Knapp onKlikk={() => ark.apneElev(r.elevId)}>Notat</Knapp>
                <Knapp
                  tittel={`Legges som punkt på neste ${MENTORORD.samtale}`}
                  onKlikk={async () => {
                    const tekst = samtaletekst(r.grunner);
                    if (tekst) await leggTilMal(r.elevId, null, tekst);
                    await ferdig(r);
                  }}
                >
                  Til samtale
                </Knapp>
                <Knapp hoved onKlikk={() => void ferdig(r)}>
                  Fulgt opp ✓
                </Knapp>
              </div>
            </div>
          );
        })
      )}
      <p className="mx-1 my-[18px] max-w-[640px] text-liten leading-relaxed text-blekk-svak">
        «Fulgt opp» fjerner eleven fra lista til noe nytt skjer. «Til samtale»
        legger punktet på neste {MENTORORD.samtale}. Klikk navnet for
        elevkortet, som åpnes over lista, så du blir værende her.
      </p>
    </div>
  );
}

function Knapp({
  children,
  onKlikk,
  hoved,
  tittel,
}: {
  children: React.ReactNode;
  onKlikk: () => void;
  hoved?: boolean;
  tittel?: string;
}) {
  return (
    <button
      onClick={onKlikk}
      title={tittel}
      className={`h-[28px] whitespace-nowrap rounded-full px-2.5 text-[12.5px] ${
        hoved
          ? "bg-aksent font-medium text-ark hover:bg-aksent-mork"
          : "border border-linje-sterk bg-ark hover:bg-flate"
      }`}
    >
      {children}
    </button>
  );
}
