import { useEffect, useMemo, useState } from "react";
import type { FagIAr } from "../data/fag";
import type { Okt } from "../data/okter";
import type { Periode } from "../data/perioder";
import { brukMal, lagMalplan, type Fjorar, type Malvalg } from "../data/mal";
import { visToast } from "../ui/Toast";
import { leggTilAngring } from "../ui/angre";

const kort = (dato: string) =>
  new Date(`${dato}T12:00:00`)
    .toLocaleDateString("nb-NO", {
      weekday: "short",
      day: "numeric",
      month: "numeric",
    })
    .replace(".", "")
    .replace(/\.$/, "");

const VALG: [keyof Malvalg, string, string][] = [
  ["perioder", "Perioder", "navn, farge og lengde"],
  ["mal", "Kompetansemål", "koblingene til periodene"],
  ["tema", "Tema på øktene", "i rekkefølge, der årets økt er tom"],
  ["vurderinger", "Vurderinger", "på nærmeste økt"],
  ["plan", "Plan og agenda", "aktivitetene inne i øktene"],
];

/**
 * «Bruk 2025/26 som mal» (ARBEIDSLISTE 20.7, lerretet Arsplanlegger): hver
 * periode med datoene i fjor og i år og antall økter, og hva som skal være
 * med. Ingenting om elevene. Erstatter årets perioder og kan angres.
 */
export function Malark({
  fjor,
  skolear,
  fag,
  okter,
  perioder,
  onLukk,
}: {
  fjor: Fjorar;
  skolear: { start: string };
  fag: FagIAr;
  okter: Okt[];
  perioder: Periode[];
  onLukk: () => void;
}) {
  const [valg, setValg] = useState<Malvalg>({
    perioder: true,
    mal: true,
    tema: true,
    vurderinger: true,
    plan: false,
  });
  const [jobber, setJobber] = useState(false);
  const plan = useMemo(
    () => lagMalplan(fjor, skolear, okter),
    [fjor, skolear, okter],
  );
  const medTema = fjor.okter.filter((o) => o.tema).length;

  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onLukk();
      }
    };
    window.addEventListener("keydown", tast, true);
    return () => window.removeEventListener("keydown", tast, true);
  }, [onLukk]);

  async function legg() {
    setJobber(true);
    try {
      const angre = await brukMal(plan, fjor, fag.id, okter, perioder, valg);
      const temaer = valg.tema
        ? plan.par.filter((x) => x.fra.tema && !x.til.tema).length
        : 0;
      const tekst = `${valg.perioder ? `${plan.perioder.length} perioder` : "Malen"}${
        temaer ? ` og ${temaer} økttemaer` : ""
      } lagt inn fra ${fjor.navn}`;
      const angring = { tekst, angre };
      leggTilAngring(angring);
      visToast(tekst, { angring });
      onLukk();
    } finally {
      setJobber(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-teppe/20 backdrop-blur-[2px]"
      onClick={onLukk}
    >
      <div
        role="dialog"
        aria-label={`Bruk ${fjor.navn} som mal`}
        className="glass-meny w-[640px] max-w-[calc(100vw-32px)] rounded-[22px] px-[26px] pb-5 pt-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline gap-2.5">
          <span className="text-[calc(22px*var(--tekst-skala))] font-light">
            Bruk {fjor.navn} som mal
          </span>
          <span className="text-liten text-blekk-dempet">
            {fag.kode} · {plan.perioder.length} perioder · {medTema} økter med
            tema
          </span>
        </div>
        <p className="mt-1.5 text-liten leading-normal text-blekk-dempet">
          Periodene legges på de samme ukene i år, og øktene følger med i
          rekkefølge. Ferier og helligdager er flyttet, så noen perioder får en
          økt mer eller mindre. Ingenting om elevene blir med.
        </p>

        <div className="mt-4 overflow-hidden rounded-xl shadow-[inset_0_0_0_1px_var(--color-linje-medium)]">
          <div className="malrad bg-flate-svak text-[11px] uppercase tracking-[0.05em] text-blekk-svak">
            <span>Periode</span>
            <span>I fjor</span>
            <span>I år</span>
            <span>Økter</span>
          </div>
          {plan.perioder.map((mp) => {
            const diff = mp.okter.length - mp.fjor.antall;
            return (
              <div
                key={mp.periode.id}
                className="malrad border-t border-linje-svak"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <i
                    className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ background: mp.periode.farge ?? undefined }}
                  />
                  <span className="truncate">{mp.periode.navn}</span>
                </span>
                <span className="tabular-nums text-blekk-svak">
                  {kort(mp.fjor.fra)} → {kort(mp.fjor.til)}
                </span>
                <span className="tabular-nums">
                  {mp.okter.length
                    ? `${kort(mp.okter[0].dato)} → ${kort(mp.okter[mp.okter.length - 1].dato)}`
                    : "ingen økter"}
                </span>
                <span
                  className={`tabular-nums ${diff > 0 ? "text-god" : diff < 0 ? "text-varsel" : ""}`}
                >
                  {mp.okter.length}
                  {diff !== 0 && ` (${diff > 0 ? "+" : "−"}${Math.abs(diff)})`}
                </span>
              </div>
            );
          })}
          {plan.perioder.length === 0 && (
            <p className="border-t border-linje-svak px-3.5 py-2.5 text-liten text-blekk-dempet">
              {fag.kode} hadde ingen perioder i {fjor.navn}.
            </p>
          )}
        </div>

        <div className="mb-2 mt-[18px] text-[11px] uppercase tracking-[0.06em] text-blekk-svak">
          Ta med
        </div>
        <div className="grid grid-cols-2 gap-x-[18px] gap-y-1.5">
          {VALG.map(([k, navn, under]) => (
            <label
              key={k}
              className="flex cursor-pointer items-start gap-2.5 py-1 text-[calc(13px*var(--tekst-skala))]"
            >
              <input
                type="checkbox"
                checked={valg[k]}
                disabled={k === "mal" && !valg.perioder}
                onChange={() => setValg((v) => ({ ...v, [k]: !v[k] }))}
                className="mt-0.5 accent-[var(--color-aksent)]"
              />
              <span>
                <b className="font-medium">{navn}</b>
                <span className="block text-etikett text-blekk-svak">
                  {under}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2.5 border-t border-linje-medium pt-3.5">
          <span className="text-etikett text-blekk-svak">
            {valg.perioder
              ? "Erstatter periodene du har lagt inn i år. Kan angres."
              : "Kan angres."}
          </span>
          <span className="grow" />
          <button
            onClick={onLukk}
            className="h-[30px] rounded-full border border-linje px-3.5 text-liten"
          >
            Avbryt
          </button>
          <button
            onClick={() => void legg()}
            disabled={jobber || !Object.values(valg).some(Boolean)}
            className="h-[30px] rounded-full bg-aksent px-3.5 text-liten font-medium text-ark disabled:opacity-45"
          >
            Legg inn
          </button>
        </div>
      </div>
    </div>
  );
}
