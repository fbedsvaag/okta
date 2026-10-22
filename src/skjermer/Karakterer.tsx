import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Skolear } from "../data/skolear";
import type { FagIAr } from "../data/fag";
import {
  hentKarakterdata,
  iTermin,
  settHalvar,
  settVekt,
  somDesimal,
  vektetSnitt,
  vektFor,
  type Karakterdata,
  type Karaktervurdering,
  type Termin,
} from "../data/karakterer";
import { lesRubrikk, kriterierMedTekst } from "../data/muntlig";
import { lyttVurderinger } from "../data/endringer";
import { iFelt } from "../data/oktkart";
import { useArk } from "../ui/Arkstabel";
import { Bryter } from "../ui/felles";
import { IVerktoylinja } from "../ui/Verktoylinje";
import { Tomside } from "../ui/Tomside";
import { useLagretInnstilling } from "../ui/useLagretInnstilling";
import { kopierKarakterliste, renTekst } from "./muntlig/eksport";

const INNSATS: Record<string, string> = {
  gronn: "#3f9d49",
  gul: "#d9a92f",
  rod: "#c04a3d",
};

/**
 * Karakterer i faget (ARBEIDSLISTE 29.4, lerretet Karakterer): elevene ×
 * vurderingene, med vekting i kolonneoverskriften, innsatsen, beregnet
 * vektet snitt, halvårskarakter og kommentar. Høst · Vår · Hele året.
 * Tast 1–6 setter halvårskarakteren og går videre, ↑↓ bytter elev,
 * Backspace fjerner. Et klikk på karakteren setter forslaget.
 */
export function Karakterer({
  skolear,
  fag,
}: {
  skolear: Skolear;
  fag: FagIAr;
}) {
  const [data, setData] = useState<Karakterdata | null>(null);
  const [termin, setTermin] = useLagretInnstilling<Termin>(
    "karakterer_termin",
    new Date().getMonth() >= 7 ? "host" : "var",
    (v) => (v === "var" || v === "aar" ? v : "host"),
    String,
  );
  const [valgt, setValgt] = useState(0);
  const [pop, setPop] = useState<{
    x: number;
    y: number;
    tittel: string;
    tekst: string;
  } | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const ark = useArk();
  const boks = useRef<HTMLDivElement>(null);

  const last = useCallback(
    async () => setData(await hentKarakterdata(fag.id)),
    [fag.id],
  );
  useEffect(() => {
    void last();
  }, [last]);
  useEffect(() => lyttVurderinger(() => void last()), [last]);

  const vurderinger = useMemo(
    () =>
      (data?.vurderinger ?? []).filter((v) =>
        iTermin(v.dato, termin, skolear.slutt),
      ),
    [data, termin, skolear.slutt],
  );

  async function sett(elevId: string, karakter: string | null) {
    setData((d) => {
      if (!d) return d;
      const h = new Map(d.halvar);
      const k = `${termin}:${elevId}`;
      h.set(k, { karakter, kommentar: h.get(k)?.kommentar ?? null });
      return { ...d, halvar: h };
    });
    await settHalvar(elevId, fag.id, termin, { karakter });
  }

  const fersk = useRef({ data, valgt, sett });
  fersk.current = { data, valgt, sett };
  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      const f = fersk.current;
      if (!f.data || e.metaKey || e.ctrlKey || e.altKey || iFelt(e.target))
        return;
      const n = f.data.elever.length;
      const elev = f.data.elever[f.valgt];
      if (/^[1-6]$/.test(e.key) && elev) {
        e.preventDefault();
        void f.sett(elev.elevId, e.key);
        setValgt(Math.min(n - 1, f.valgt + 1));
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setValgt((i) =>
          Math.max(0, Math.min(n - 1, i + (e.key === "ArrowDown" ? 1 : -1))),
        );
      } else if (e.key === "Backspace" && elev) {
        e.preventDefault();
        void f.sett(elev.elevId, null);
      }
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, []);

  if (!data) return null;
  if (data.vurderinger.length === 0)
    return (
      <Tomside
        tegning="karakterer"
        tittel="Karakterene samles her"
        tekst={`Når du har ført en vurdering i ${fag.kode}, får du alle elevene og karakterene i én tabell, med forslag til halvårskarakter.`}
        hoved={{
          tekst: "Lag første vurdering",
          onKlikk: () => ark.gaTil("vurderinger"),
        }}
      />
    );
  const teller = vurderinger.filter((v) => vektFor(v) > 0).length;
  const halvar = (id: string) => data.halvar.get(`${termin}:${id}`);
  const antallSatt = data.elever.filter(
    (e) => halvar(e.elevId)?.karakter,
  ).length;
  const snitt = (xs: (number | null)[]) => {
    const t = xs.filter((x): x is number => x !== null);
    return t.length ? t.reduce((a, b) => a + b, 0) / t.length : null;
  };
  const beregnet = (id: string) =>
    vektetSnitt(id, vurderinger, data.resultater);

  function visPop(
    e: React.PointerEvent,
    v: Karaktervurdering,
    elev: { elevId: string; fornavn: string; etternavn: string },
  ) {
    const r = data!.resultater.get(`${v.id}:${elev.elevId}`);
    const o = boks.current?.getBoundingClientRect();
    const c = e.currentTarget.getBoundingClientRect();
    if (!o) return;
    const deler: string[] = [];
    if (!r?.kode) deler.push("Ikke ført ennå.");
    else deler.push(`Karakter ${r.kode}.`);
    const rub = lesRubrikk(v.rubrikk);
    if (rub && r) {
      const valgte = kriterierMedTekst(rub)
        .map((k) => {
          const n = rub.nivaer.find((x) => x.id === r.rubrikkvalg[k.id]);
          return n ? `${k.tekst} ${n.navn}` : null;
        })
        .filter(Boolean);
      if (valgte.length) deler.push(`Rubrikk: ${valgte.join(", ")}.`);
    }
    if (r?.kommentar) deler.push(`Kommentar: ${renTekst(r.kommentar)}`);
    setPop({
      x: c.left - o.left - 60,
      y: c.bottom - o.top + 6,
      tittel: `${elev.fornavn} ${elev.etternavn} · ${v.tittel}`,
      tekst: deler.join(" "),
    });
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <IVerktoylinja>
        <span className="ml-auto" />
        <Bryter
          storrelse="liten"
          verdi={termin}
          settVerdi={(t) => setTermin(t as Termin)}
          valg={[
            { id: "host", navn: "Høst" },
            { id: "var", navn: "Vår" },
            { id: "aar", navn: "Hele året" },
          ]}
        />
        <button
          onClick={async () => {
            await kopierKarakterliste(
              `${fag.kode} · ${termin === "host" ? "høst" : termin === "var" ? "vår" : "hele året"}`,
              data.elever.map((e) => ({
                navn: `${e.fornavn} ${e.etternavn}`,
                oppgave: "",
                karakter: halvar(e.elevId)?.karakter ?? "",
                notat: halvar(e.elevId)?.kommentar ?? "",
              })),
              true,
            );
            setKopiert(true);
            window.setTimeout(() => setKopiert(false), 1500);
          }}
          className="h-8 shrink-0 rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate"
        >
          {kopiert ? "Kopiert ✓" : "Kopier karakterlista"}
        </button>
      </IVerktoylinja>

      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <span className="text-liten text-blekk-dempet">
          {data.elever.length} elever · {antallSatt} halvårskarakterer satt ·{" "}
          {teller} {teller === 1 ? "vurdering teller" : "vurderinger teller"}
        </span>
        <span className="flex-1" />
        <span className="text-liten text-blekk-svak">
          Trykk 1–6 for halvårskarakter, ↓ for neste elev · klikk en elev for
          elevkortet
        </span>
      </div>

      <div ref={boks} className="relative min-h-0 flex-1">
        <div className="h-full overflow-auto rounded-xl px-2 shadow-[inset_0_0_0_1px_var(--color-linje-svak)]">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-[2] bg-ark">
              <tr className="text-left align-bottom">
                <Th venstre bredde="min-w-[150px]">
                  Elev
                </Th>
                {vurderinger.map((v) => (
                  <Th key={v.id}>
                    <span
                      className="block max-w-[120px] truncate"
                      title={v.tittel}
                    >
                      {v.tittel}
                    </span>
                    <small className="block font-normal text-blekk-svak">
                      {v.dato ? dag(v.dato) : "uten dato"}
                    </small>
                    <Vekt
                      v={v}
                      onSett={async (x) => {
                        await settVekt(v.id, x);
                        await last();
                      }}
                    />
                  </Th>
                ))}
                <Th>
                  Innsats
                  <small className="block font-normal text-blekk-svak">
                    siste 10 økter
                  </small>
                </Th>
                <Th>
                  Beregnet
                  <small className="block font-normal text-blekk-svak">
                    vektet snitt
                  </small>
                </Th>
                <Th>Halvår</Th>
                <Th venstre bredde="min-w-[220px]">
                  Kommentar
                </Th>
              </tr>
            </thead>
            <tbody>
              {data.elever.map((e, i) => {
                const b = beregnet(e.elevId);
                const h = halvar(e.elevId);
                return (
                  <tr
                    key={e.elevId}
                    onClick={() => setValgt(i)}
                    className={`border-t border-linje-svak ${i === valgt ? "bg-flate-svak" : ""}`}
                  >
                    <td className="py-1.5 pr-3">
                      <button
                        onClick={() =>
                          ark.apneElev(e.elevId, {
                            liste: data.elever.map((x) => x.elevId),
                            startFag: fag.id,
                          })
                        }
                        className="whitespace-nowrap text-left hover:text-aksent"
                      >
                        {e.fornavn} {e.etternavn}
                      </button>
                    </td>
                    {vurderinger.map((v) => {
                      const r = data.resultater.get(`${v.id}:${e.elevId}`);
                      const ikke = r?.leveranse === "ikke";
                      return (
                        <td
                          key={v.id}
                          className="py-1.5 text-center"
                          onPointerEnter={(ev) => visPop(ev, v, e)}
                          onPointerLeave={() => setPop(null)}
                        >
                          <span
                            className={`inline-grid h-[26px] min-w-[26px] place-items-center rounded-[7px] px-1 text-[12.5px] ${
                              r?.kode
                                ? "bg-flate font-semibold"
                                : ikke
                                  ? "text-liten text-feil"
                                  : "text-blekk-svakest"
                            } ${vektFor(v) === 0 ? "opacity-60" : ""}`}
                          >
                            {r?.kode ?? (ikke ? "ikke levert" : "–")}
                          </span>
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap py-1.5 text-center">
                      {(data.innsats.get(e.elevId) ?? []).map((f, j) => (
                        <span
                          key={j}
                          className="mx-px inline-block h-[7px] w-[7px] rounded-full"
                          style={{ background: (f && INNSATS[f]) || "#d5d8dd" }}
                        />
                      ))}
                    </td>
                    <td className="py-1.5 text-center font-semibold tabular-nums">
                      {somDesimal(b)}
                    </td>
                    <td className="py-1.5 text-center">
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setValgt(i);
                          void sett(
                            e.elevId,
                            h?.karakter
                              ? null
                              : b
                                ? String(Math.round(b))
                                : null,
                          );
                        }}
                        title={
                          h?.karakter
                            ? "Klikk for å fjerne"
                            : "Klikk for å sette forslaget"
                        }
                        className={`h-[30px] w-[34px] rounded-lg text-[14px] font-semibold tabular-nums transition-colors duration-200 ${
                          h?.karakter
                            ? "bg-aksent text-ark"
                            : i === valgt
                              ? "text-blekk-svak shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
                              : "text-blekk-svakest shadow-[inset_0_0_0_1px_var(--color-linje)]"
                        }`}
                      >
                        {h?.karakter ?? (b ? Math.round(b) : "·")}
                      </button>
                    </td>
                    <td className="py-1.5">
                      <input
                        key={`${termin}-${h?.kommentar ?? ""}`}
                        defaultValue={h?.kommentar ?? ""}
                        placeholder="Kort kommentar …"
                        onBlur={(ev) => {
                          const t = ev.target.value.trim() || null;
                          if (t !== (h?.kommentar ?? null))
                            void settHalvar(e.elevId, fag.id, termin, {
                              kommentar: t,
                            }).then(last);
                        }}
                        onKeyDown={(ev) =>
                          ev.key === "Enter" && ev.currentTarget.blur()
                        }
                        className="w-full rounded-md bg-transparent px-1.5 py-1 outline-none placeholder:text-blekk-svakest hover:bg-flate-svak focus:bg-ark focus:shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-linje-medium text-blekk-dempet">
                <td className="h-10 text-liten text-blekk-svak">Snitt</td>
                {vurderinger.map((v) => (
                  <td
                    key={v.id}
                    className="text-center font-semibold tabular-nums"
                  >
                    {vektFor(v) === 0 && !v.tall
                      ? `${
                          data.elever.filter(
                            (e) =>
                              data.resultater.get(`${v.id}:${e.elevId}`)
                                ?.leveranse === "levert",
                          ).length
                        } levert`
                      : somDesimal(
                          snitt(
                            data.elever.map(
                              (e) =>
                                data.resultater.get(`${v.id}:${e.elevId}`)
                                  ?.tall ?? null,
                            ),
                          ),
                        )}
                  </td>
                ))}
                <td />
                <td className="text-center font-semibold tabular-nums">
                  {somDesimal(
                    snitt(data.elever.map((e) => beregnet(e.elevId))),
                  )}
                </td>
                <td className="text-center font-semibold tabular-nums">
                  {antallSatt
                    ? somDesimal(
                        snitt(
                          data.elever.map((e) => {
                            const k = halvar(e.elevId)?.karakter;
                            return k ? Number(k) : null;
                          }),
                        ),
                      )
                    : ""}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
          {data.elever.length === 0 && (
            <p className="py-8 text-center text-brod text-blekk-dempet">
              Ingen elever i {fag.kode} ennå.
            </p>
          )}
        </div>
        {pop && (
          <div
            className="pointer-events-none absolute z-10 w-[260px] rounded-xl bg-ark px-3 py-2.5 text-liten shadow-[0_12px_32px_rgba(36,31,51,.18),0_0_0_1px_rgba(36,31,51,.07)]"
            style={{ left: Math.max(0, pop.x), top: pop.y }}
          >
            <b className="font-medium">{pop.tittel}</b>
            <div className="mt-1 text-blekk-dempet">{pop.tekst}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({
  children,
  venstre,
  bredde = "",
}: {
  children: React.ReactNode;
  venstre?: boolean;
  bredde?: string;
}) {
  return (
    <th
      className={`px-1.5 pb-2 pt-3 text-[12px] font-medium ${venstre ? "text-left" : "text-center"} ${bredde}`}
    >
      {children}
    </th>
  );
}

/** − ×2 + i kolonneoverskriften; 0 er «teller ikke». */
function Vekt({
  v,
  onSett,
}: {
  v: Karaktervurdering;
  onSett: (x: number | null) => void;
}) {
  const w = vektFor(v);
  const k =
    "grid h-5 w-5 place-items-center rounded-full text-blekk-dempet hover:bg-flate hover:text-blekk";
  return (
    <span className="mt-1 inline-flex items-center gap-0.5 rounded-full px-0.5 text-[11px] font-normal text-blekk-dempet shadow-[inset_0_0_0_1px_var(--color-linje-svak)]">
      <button
        onClick={() => onSett(Math.max(0, w - 1))}
        className={k}
        aria-label="Teller mindre"
      >
        −
      </button>
      <span className="min-w-[44px] text-center tabular-nums">
        {w === 0 ? "teller ikke" : `×${w}`}
      </span>
      <button
        onClick={() => onSett(Math.min(5, w + 1))}
        className={k}
        aria-label="Teller mer"
      >
        +
      </button>
    </span>
  );
}

function dag(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}
