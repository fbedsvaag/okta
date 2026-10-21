import { useMemo, useRef, useState } from "react";
import type { FagIAr } from "../data/fag";
import { endreOkt, type Okt, type OktVurdering } from "../data/okter";
import type { Periode } from "../data/perioder";
import { nyPeriode, tildel, type Endring, type Plass } from "../data/aret";
import { flyttInnhold, kilder, kolonner } from "../data/tavle";
import { visToast } from "../ui/Toast";
import { leggTilAngring } from "../ui/angre";
import { Vurderingsikon } from "../ui/Vurderingsikon";

/** En periode som legges inn fra tavla, får så mange økter. */
const STANDARD = 8;

const kort = (dato: string) =>
  new Date(`${dato}T12:00:00`)
    .toLocaleDateString("nb-NO", {
      weekday: "short",
      day: "numeric",
      month: "numeric",
    })
    .replace(".", "")
    .replace(/\.$/, "");

/**
 * Skoleåret som tavle (ARBEIDSLISTE 21.1, lerretet ArsTavle): én kolonne
 * per periode, ett kort per økt. Temaet skrives rett inn (↵/↓ neste, ↑
 * forrige). Et kort dras til en ny plass, også over i en annen periode:
 * datoene står, temaene imellom rykker ett hakk, og vurderingen følger
 * temaet (data/tavle.ts). «− økt / + økt» flytter grensen mot neste
 * kolonne. Alt kan angres med ⌘Z.
 */
export function ArsTavle({
  fag,
  stripe,
  perioder,
  koblinger,
  vurderinger,
}: {
  fag: FagIAr;
  stripe: Plass[];
  perioder: Periode[];
  /** kompetansemålene per periode */
  koblinger: Map<string, string[]>;
  vurderinger: Map<string, OktVurdering[]>;
}) {
  const kol = useMemo(() => kolonner(stripe, perioder), [stripe, perioder]);
  const rekke = useMemo(() => kol.flatMap((k) => k.okter), [kol]);
  const uplassert = perioder.filter(
    (p) => !kol.some((k) => k.periode?.id === p.id),
  );
  const fylt = rekke.filter((o) => o.tema).length;

  const [dra, setDra] = useState<{ fra: number; mal: number } | null>(null);
  const [nyNavn, setNyNavn] = useState("");
  const tavle = useRef<HTMLDivElement>(null);

  /** Hvor innholdet på hver plass kommer fra mens et kort dras. */
  const vis = useMemo(
    () => (dra && dra.fra !== dra.mal ? kilder(dra.fra, dra.mal) : null),
    [dra],
  );
  const innhold = (nr: number): Okt => rekke[vis?.get(nr) ?? nr];

  function fokus(nr: number) {
    tavle.current
      ?.querySelector<HTMLInputElement>(`[data-tavle-nr="${nr}"]`)
      ?.focus();
  }

  async function flytt(fra: number, til: number) {
    const ok = await flyttInnhold(rekke, fra, til);
    if (!ok) {
      visToast("En skåret økt ligger i veien. Skårede økter ligger fast.");
      return;
    }
    const tekst = `Flyttet til ${kort(rekke[til].dato)}. Temaene imellom har rykket ett hakk.`;
    // Etter flyttingen er rekka den samme (datoene står), så det motsatte
    // draget angrer.
    const angring = {
      tekst,
      angre: async () => {
        await flyttInnhold(rekke, til, fra);
      },
    };
    leggTilAngring(angring);
    visToast(tekst, { angring });
  }

  function begynnDra(e: React.PointerEvent, nr: number) {
    if (rekke[nr].skaret > 0) return;
    e.preventDefault();
    const x0 = e.clientX;
    const y0 = e.clientY;
    let flyttet = false;
    let mal = nr;
    const flytt_ = (ev: PointerEvent) => {
      if (!flyttet && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 4)
        return;
      flyttet = true;
      // Nær kanten ruller tavla sidelengs.
      const t = tavle.current;
      if (t) {
        const r = t.getBoundingClientRect();
        if (ev.clientX > r.right - 60) t.scrollLeft += 14;
        else if (ev.clientX < r.left + 60) t.scrollLeft -= 14;
      }
      const under = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest<HTMLElement>("[data-tavle-kort]");
      if (under) mal = Number(under.dataset.tavleKort);
      setDra({ fra: nr, mal });
    };
    const slipp = () => {
      window.removeEventListener("pointermove", flytt_);
      window.removeEventListener("pointerup", slipp);
      setDra(null);
      if (flyttet && mal !== nr) void flytt(nr, mal);
    };
    window.addEventListener("pointermove", flytt_);
    window.addEventListener("pointerup", slipp);
  }

  async function grense(i: number, retning: "minus" | "pluss") {
    const a = kol[i];
    const b = kol[i + 1];
    if (!b) return;
    const okt = retning === "minus" ? a.okter[a.okter.length - 1] : b.okter[0];
    if (retning === "minus" ? a.okter.length <= 1 : b.okter.length <= 1) return;
    const til =
      retning === "minus" ? (b.periode?.id ?? null) : (a.periode?.id ?? null);
    const e: Endring = { oktId: okt.id, fra: okt.periodeId, til };
    await tildel([e], stripe);
    const navn = a.periode?.navn ?? "Uten periode";
    const siste =
      retning === "minus" ? a.okter[a.okter.length - 2] : b.okter[0];
    const tekst = `«${navn}» slutter nå ${kort(siste.dato)}`;
    const angring = {
      tekst,
      angre: () =>
        tildel([{ oktId: okt.id, fra: til, til: okt.periodeId }], stripe),
    };
    leggTilAngring(angring);
    visToast(tekst, { angring });
  }

  /** Legger perioden på de første øktene uten periode. */
  async function plasser(p: { id: string; navn: string }) {
    const ledig = kol.find((k) => !k.periode);
    if (!ledig) {
      visToast("Alle økter har periode. Gi plass med − økt først.");
      return;
    }
    const endringer = ledig.okter
      .slice(0, STANDARD)
      .map((o) => ({ oktId: o.id, fra: null, til: p.id }));
    await tildel(endringer, stripe);
    visToast(`«${p.navn}» har fått ${endringer.length} økter`);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-end gap-4">
        <div>
          <h1 className="text-[calc(30px*var(--tekst-skala))] font-light tracking-overskrift">
            Skoleåret i {fag.kode} · tavle
          </h1>
          <p className="mt-0.5 text-liten text-blekk-dempet">
            Hver periode er en kolonne, hver økt et kort. Skriv tema rett inn,
            dra kort for å flytte innhold. Datoene står, temaene flytter seg.
          </p>
        </div>
        <span className="grow" />
        <span className="text-[calc(12.5px*var(--tekst-skala))] tabular-nums text-blekk-dempet">
          {fylt} av {rekke.length} økter har tema
        </span>
      </div>

      <div
        ref={tavle}
        className="flex min-h-0 flex-1 gap-3.5 overflow-x-auto pb-2"
      >
        {kol.map((k, i) => {
          const farge = k.periode?.farge ?? "var(--color-linje-sterk)";
          const mal = k.periode ? (koblinger.get(k.periode.id) ?? []) : [];
          const forste = k.okter[0];
          const siste = k.okter[k.okter.length - 1];
          return (
            <section
              key={`${k.periode?.id ?? "uten"}-${forste.id}`}
              className="flex min-h-0 w-[262px] shrink-0 flex-col rounded-2xl bg-flate-svak shadow-[inset_0_0_0_1px_var(--color-linje-svak)]"
            >
              <header className="border-b border-linje-svak px-3 pb-2 pt-3">
                <div
                  className="mb-2 h-1 rounded-sm"
                  style={{ background: farge }}
                />
                <b
                  className={`text-brod font-semibold ${k.periode ? "" : "text-blekk-dempet"}`}
                >
                  {k.periode?.navn ?? "Uten periode"}
                </b>
                <div className="mt-0.5 text-etikett tabular-nums text-blekk-svak">
                  {kort(forste.dato)} → {kort(siste.dato)}
                </div>
                {mal.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-[3px]">
                    {mal.map((m) => (
                      <span
                        key={m}
                        className="rounded-[5px] bg-ark px-1.5 text-[calc(10.5px*var(--tekst-skala))] tabular-nums text-blekk-dempet shadow-[inset_0_0_0_1px_var(--color-linje-svak)]"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </header>

              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2">
                {k.plasser.map((p, j) => {
                  if (p.slag === "ferie")
                    return (
                      <div
                        key={`f-${j}`}
                        className="px-2 py-0.5 text-etikett italic text-blekk-svak"
                      >
                        {p.navn}
                      </div>
                    );
                  const { okt, nr } = p;
                  const o = innhold(nr);
                  const v = (vurderinger.get(o.id) ?? [])[0];
                  const loftet = dra && dra.mal === nr && dra.fra !== dra.mal;
                  const fast = okt.skaret > 0;
                  return (
                    <div
                      key={okt.id}
                      data-tavle-kort={nr}
                      className={`grid grid-cols-[10px_58px_minmax(0,1fr)_14px] items-center gap-1.5 rounded-[10px] bg-ark px-2 py-[7px] text-[calc(12.5px*var(--tekst-skala))] ${
                        loftet
                          ? "relative z-[5] shadow-[0_12px_28px_rgba(36,31,51,.22)]"
                          : "shadow-[0_1px_2px_rgba(36,31,51,.06),inset_0_0_0_1px_var(--color-linje-svak)]"
                      }`}
                      style={
                        loftet
                          ? {
                              boxShadow: `0 12px 28px rgba(36,31,51,.22), inset 0 0 0 1.5px ${farge}`,
                            }
                          : undefined
                      }
                    >
                      <span
                        onPointerDown={(e) => begynnDra(e, nr)}
                        title={
                          fast
                            ? "Skåret: ligger fast"
                            : "Dra til en annen plass"
                        }
                        className={`select-none text-[11px] tracking-[-1px] ${
                          fast
                            ? "text-transparent"
                            : "cursor-grab touch-none text-blekk-svakest active:cursor-grabbing"
                        }`}
                      >
                        ⋮⋮
                      </span>
                      <span className="whitespace-nowrap text-etikett tabular-nums text-blekk-svak">
                        {kort(okt.dato)}
                      </span>
                      <input
                        key={`${o.id}-${o.tema ?? ""}`}
                        data-tavle-nr={nr}
                        defaultValue={o.tema ?? ""}
                        readOnly={!!vis}
                        placeholder={v?.tittel ?? "Skriv tema …"}
                        onBlur={(e) => {
                          const t = e.currentTarget.value.trim();
                          if (t !== (okt.tema ?? ""))
                            void endreOkt(okt.id, { tema: t || null });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "ArrowDown") {
                            e.preventDefault();
                            fokus(nr + 1);
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            fokus(nr - 1);
                          } else if (e.key === "Escape") {
                            e.currentTarget.value = okt.tema ?? "";
                            e.currentTarget.blur();
                          }
                        }}
                        className="min-w-0 truncate bg-transparent text-blekk outline-none placeholder:text-blekk-svakest"
                      />
                      <span>
                        {v && (
                          <Vurderingsikon
                            type={v.type}
                            utkast={v.utkast === 1}
                            klasse="!h-3.5 !w-3.5"
                          />
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              <footer className="flex items-center gap-1.5 border-t border-linje-svak px-2.5 py-2 text-etikett text-blekk-dempet">
                <span className="tabular-nums">{k.okter.length} økter</span>
                <span className="grow" />
                {kol[i + 1] && (
                  <>
                    <button
                      onClick={() => void grense(i, "minus")}
                      disabled={k.okter.length <= 1}
                      title="Gi siste økt til neste kolonne"
                      className="h-[22px] rounded-full bg-ark px-2 shadow-[inset_0_0_0_1px_var(--color-linje)] hover:bg-flate disabled:opacity-40"
                    >
                      − økt
                    </button>
                    <button
                      onClick={() => void grense(i, "pluss")}
                      disabled={kol[i + 1].okter.length <= 1}
                      title="Ta første økt fra neste kolonne"
                      className="h-[22px] rounded-full bg-ark px-2 shadow-[inset_0_0_0_1px_var(--color-linje)] hover:bg-flate disabled:opacity-40"
                    >
                      + økt
                    </button>
                  </>
                )}
              </footer>
            </section>
          );
        })}

        <section className="flex w-[200px] shrink-0 flex-col gap-2 rounded-2xl p-3.5 text-liten text-blekk-dempet shadow-[inset_0_0_0_1.5px_var(--color-linje)]">
          <b className="text-brod font-semibold text-blekk">+ Ny periode</b>
          <span>
            Får de første {STANDARD} øktene uten periode. Gjør plass med − økt.
          </span>
          {uplassert.map((p) => (
            <button
              key={p.id}
              onClick={() => void plasser(p)}
              className="flex items-center gap-2 rounded-[10px] bg-ark px-2.5 py-2 text-left text-blekk shadow-[inset_0_0_0_1px_var(--color-linje-svak)] hover:bg-flate"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: p.farge ?? "var(--color-linje-sterk)" }}
              />
              <span className="truncate">{p.navn}</span>
            </button>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const navn = nyNavn.trim();
              if (!navn) return;
              const id = await nyPeriode(fag.id, navn, null);
              setNyNavn("");
              await plasser({ id, navn });
            }}
          >
            <input
              value={nyNavn}
              onChange={(e) => setNyNavn(e.target.value)}
              placeholder="Navn på ny periode ↵"
              className="w-full rounded-[10px] bg-ark px-2.5 py-2 text-blekk shadow-[inset_0_0_0_1px_var(--color-linje-svak)] outline-none placeholder:text-blekk-svakest focus:shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
            />
          </form>
        </section>
      </div>
    </div>
  );
}
