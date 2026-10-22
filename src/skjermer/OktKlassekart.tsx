import { useEffect, useState } from "react";
import { DELER, plasserIRom, storrelse } from "../data/klassekart";
import { innenfor, romramme } from "../data/karttegning";
import { hentOktkart, type Oktkart } from "../data/oktkart";
import type { OktElev } from "../data/okter";
import type { Skalaverdi } from "../skala";
import { lyttKlassekart } from "../data/endringer";
import { Bryter } from "../ui/felles";
import { Skarprikk, slagFraVerdi } from "../ui/Skarprikk";
import { useLagretInnstilling } from "../ui/useLagretInnstilling";

type Farge = "ingen" | "skar" | "grupper";

/** Plassen i px, før skalering, som i klassekartet. */
const PB = 100;
const PH = 50;

/**
 * Klassekartet på et blikk i økta (ARBEIDSLISTE 27, lerretet
 * OktKlassekart): fagets kart som et kort over økta, bare til å se på.
 * Fra kateteret som standard (tavla nederst, du står der). De som er borte
 * i denne økta, er overstreket og bleke; dagens skår eller gruppefargene kan
 * vises på pultene. Et klikk på en elev finner raden i lista under.
 */
export function OktKlassekart({
  skolearId,
  skolearFagId,
  fagKode,
  dato,
  elever,
  verdier,
  onVelgElev,
  onLukk,
  onApneFull,
  onLagKart,
}: {
  skolearId: string;
  skolearFagId: string;
  fagKode: string;
  dato: string;
  elever: OktElev[];
  verdier: Skalaverdi[];
  onVelgElev: (elevId: string) => void;
  onLukk: () => void;
  onApneFull: (kartId: string) => void;
  onLagKart: () => void;
}) {
  const [data, setData] = useState<Oktkart | null | undefined>(undefined);
  useEffect(() => {
    const last = () =>
      void hentOktkart(skolearId, skolearFagId, dato).then(setData);
    last();
    return lyttKlassekart(last);
  }, [skolearId, skolearFagId, dato]);

  const [fra, setFra] = useLagretInnstilling<"kateter" | "elever">(
    data ? `okt_kart_fra_${data.kart.id}` : null,
    "kateter",
    (v) => (v === "elever" ? "elever" : "kateter"),
    String,
  );
  const [farge, setFarge] = useLagretInnstilling<Farge>(
    "okt_kart_farge",
    "ingen",
    (v) => (v === "skar" || v === "grupper" ? v : "ingen"),
    String,
  );

  // Esc lukker kortet først (fanges før arket og økta), og det gjør klikk
  // utenfor og K også.
  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onLukk();
    };
    window.addEventListener("keydown", tast, true);
    return () => window.removeEventListener("keydown", tast, true);
  }, [onLukk]);

  const skar = new Map(elever.map((e) => [e.elevId, e.skalaverdiId]));
  const verdiAv = new Map(verdier.map((v) => [v.id, v]));
  const borte = new Set(
    elever
      .filter(
        (e) => e.skalaverdiId && verdiAv.get(e.skalaverdiId)?.teller_ikke === 1,
      )
      .map((e) => e.elevId),
  );
  const skaret = elever.filter(
    (e) => e.skalaverdiId && !borte.has(e.elevId),
  ).length;

  return (
    <>
      <div className="fixed inset-0 z-30" onMouseDown={onLukk} />
      <div
        data-esc-forst
        className="okt-kart-inn absolute left-0 top-[calc(100%+8px)] z-40 w-[720px] max-w-[calc(100vw-80px)] rounded-[18px] bg-ark px-[18px] pb-3.5 pt-4 text-blekk shadow-[0_22px_60px_rgba(36,31,51,.24),0_0_0_1px_rgba(36,31,51,.07)]"
        onClick={(e) => e.stopPropagation()}
      >
        {data === undefined ? null : data === null ? (
          <div className="py-6 text-center text-brod text-blekk-dempet">
            Ingen klassekart for {fagKode} ennå.{" "}
            <button onClick={onLagKart} className="text-aksent hover:underline">
              Lag et
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2.5">
              <b className="whitespace-nowrap text-[13.5px] font-semibold">
                Klassekart{data.kart.romNavn ? ` · ${data.kart.romNavn}` : ""}
              </b>
              <span className="whitespace-nowrap text-etikett tabular-nums text-blekk-svak">
                {elever.length - borte.size} til stede · {borte.size} borte ·{" "}
                {skaret} skåret
              </span>
              <span className="flex-1" />
              <Bryter
                storrelse="liten"
                verdi={fra}
                settVerdi={(v) => setFra(v === "elever" ? "elever" : "kateter")}
                valg={[
                  { id: "kateter", navn: "Fra kateteret" },
                  { id: "elever", navn: "Fra elevene" },
                ]}
              />
            </div>
            <Rommet
              data={data}
              fraKateteret={fra === "kateter"}
              borte={borte}
              farge={farge}
              skar={(id) => {
                const v = skar.get(id);
                return v ? slagFraVerdi(verdiAv.get(v) ?? null) : null;
              }}
              onVelgElev={onVelgElev}
            />
            <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
              <span className="text-etikett text-blekk-svak">Farge</span>
              <Bryter
                storrelse="liten"
                verdi={farge}
                settVerdi={(v) => setFarge(v as Farge)}
                valg={[
                  { id: "ingen", navn: "Ingen" },
                  { id: "skar", navn: "Dagens skår" },
                  { id: "grupper", navn: "Grupper" },
                ]}
              />
              <span className="flex-1" />
              <span className="whitespace-nowrap text-etikett text-blekk-svak">
                Klikk en elev for å finne hen · K lukker
              </span>
              <button
                onClick={() => onApneFull(data.kart.id)}
                className="whitespace-nowrap text-[13px] text-aksent hover:underline"
              >
                Åpne i Plasser og grupper ↗
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Rommet({
  data,
  fraKateteret,
  borte,
  farge,
  skar,
  onVelgElev,
}: {
  data: Oktkart;
  fraKateteret: boolean;
  borte: Set<string>;
  farge: Farge;
  skar: (elevId: string) => ReturnType<typeof slagFraVerdi> | null;
  onVelgElev: (elevId: string) => void;
}) {
  if (data.deler.length === 0)
    return (
      <p className="py-6 text-center text-brod text-blekk-dempet">
        Kartet har ikke noe rom ennå.
      </p>
    );
  const ramme = romramme(data.deler);
  // Så stort som kortet tillater: hele bredden, og høyde etter vinduet.
  const maksH = Math.max(320, Math.min(520, window.innerHeight - 330));
  const skala = Math.min(1.2, 684 / ramme.b, maksH / ramme.h);
  // Fra kateteret står tavla nederst, bak deg; fra elevene øverst.
  const snu = (x: number, y: number, b = 0, h = 0) =>
    fraKateteret
      ? {
          x: ramme.x + ramme.b - (x - ramme.x) - b,
          y: ramme.y + ramme.h - (y - ramme.y) - h,
        }
      : { x, y };
  const px = (x: number) => (x - ramme.x) * skala;
  const py = (y: number) => (y - ramme.y) * skala;
  const elevPa = new Map([...data.plass].map(([id, nr]) => [nr, id]));
  const plasser = plasserIRom(data.deler);

  return (
    <div
      className="relative mx-auto"
      style={{ width: ramme.b * skala, height: ramme.h * skala }}
    >
      {data.deler
        .filter((d) => innenfor(d, ramme))
        .map((d) => {
          const s = storrelse(d);
          const p = snu(d.x, d.y, s.b, s.h);
          const stil = {
            left: px(p.x),
            top: py(p.y),
            width: s.b * skala,
            height: s.h * skala,
          };
          if (DELER[d.type].plasser.length > 0)
            return (
              <div
                key={d.id}
                className="absolute rounded-[10px] bg-flate-svak"
                style={stil}
              />
            );
          if (d.type === "tavle")
            return (
              <div
                key={d.id}
                className="absolute grid place-items-center rounded-md bg-flate text-[10.5px] tracking-[.08em] text-blekk-dempet"
                style={stil}
              >
                {fraKateteret ? "TAVLE · du står her" : "TAVLE"}
              </div>
            );
          if (d.type === "kateter")
            return (
              <div
                key={d.id}
                className="absolute grid place-items-center rounded-md text-[10.5px] text-blekk-svak shadow-[inset_0_0_0_1px_var(--color-linje)]"
                style={stil}
              >
                Kateter
              </div>
            );
          return null;
        })}
      {plasser.map((p) => {
        const q = snu(p.x, p.y);
        const id = elevPa.get(p.nr);
        const e = id ? data.navn.get(id) : undefined;
        const b = !!id && borte.has(id);
        const pf = farge === "grupper" ? data.pultfarge.get(p.nr) : undefined;
        const s = id && farge === "skar" && !b ? skar(id) : null;
        const w = (PB - 6) * skala;
        const h = (PH - 6) * skala;
        return (
          <button
            key={p.nr}
            disabled={!e}
            onClick={() => id && onVelgElev(id)}
            title={e ? `${e.fornavn} ${e.etternavn}` : "Ledig"}
            className={`absolute flex items-center overflow-hidden whitespace-nowrap rounded-[7px] pl-2 pr-1.5 text-[calc(12px*var(--tekst-skala))] ${
              e
                ? b
                  ? "bg-flate-svak text-blekk-svakest line-through"
                  : "bg-ark text-blekk shadow-[0_1px_2px_rgba(36,31,51,.06)] hover:shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
                : "cursor-default text-blekk-svakest shadow-[inset_0_0_0_1px_var(--color-linje)]"
            }`}
            style={{
              left: px(q.x) - w / 2,
              top: py(q.y) - h / 2,
              width: w,
              height: h,
              // Grupper: hele pulten i gruppens farge, så gruppene står ut.
              ...(pf && {
                background: pf,
                color: lys(pf) ? "#241f33" : "#fff",
                boxShadow: "none",
                opacity: b ? 0.45 : 1,
              }),
            }}
          >
            <span className="min-w-0 truncate">
              {e
                ? `${e.fornavn} ${e.etternavn ? `${e.etternavn[0]}.` : ""}`
                : "Ledig"}
            </span>
            {s && s !== "t" && (
              <Skarprikk slag={s} storrelse={7} klasse="ml-auto shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Om en farge er så lys at teksten på den må være mørk. */
function lys(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 165;
}
