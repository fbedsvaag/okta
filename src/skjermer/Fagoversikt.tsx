import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Skarprikk } from "../ui/Skarprikk";
import type { FagIAr } from "../data/fag";
import type { Skolear } from "../data/skolear";
import {
  hentOkter,
  hentOktVurderinger,
  type Okt,
  type OktVurdering,
} from "../data/okter";
import { hentElever, type ElevRad } from "../data/elever";
import {
  hentAllePerioder,
  hentOktmalForFag,
  hentPeriodemal,
  type Periode,
} from "../data/perioder";
import { hentVurderinger, type Vurdering } from "../data/vurderinger";
import { finnFag, type GrepFag } from "../data/grep";
import {
  fravaer,
  fravaersmerke,
  GRENSE,
  glipper,
  hentFravaersgrunnlag,
  hentOktrader,
  rute as tilRute,
  snitt,
  timer,
  type Fagfravaer,
  type Oktrad,
  type Rute,
} from "../data/oktrader";
import {
  fasteTider,
  holdteMinutter,
  kortDag,
  maldekning,
  oppramsing,
  periodestolper,
  tempo,
  tempotekst,
} from "../data/fagside";
import { lytt, lyttOktvisning } from "../data/endringer";
import { useArk } from "../ui/Arkstabel";
import { Elevfoto } from "../ui/Elevfoto";
import { Vurderingsikon } from "../ui/Vurderingsikon";
import { Markdown } from "../ui/Notattekst";
import { fagfarge } from "../ui/farger";
import { IVerktoylinja } from "../ui/Verktoylinje";

/**
 * Fagsiden — Oversikt i Økter når et fag er valgt (ARBEIDSLISTE 11.2,
 * lerretet «Fagside»). Alt om faget på ett ark: timene mot årstimetallet,
 * hva som kommer, klassen økt for økt, hvem som går godt og hvem som
 * trenger oppfølging, fraværet mot 10 %-grensen, kompetansemålene og
 * øktloggene.
 *
 * Bare visning. Det som endres, endres der det bor: økta, eleven,
 * vurderingen og faget åpnes som ark herfra.
 */
export function Fagoversikt({
  skolear,
  fag,
  onRedigerFag,
}: {
  skolear: Skolear;
  fag: FagIAr;
  /** «Rediger fag» i verktøylinja: fagets innstillinger */
  onRedigerFag: () => void;
}) {
  const ark = useArk();
  const idag = iDag();
  const [okter, setOkter] = useState<Okt[]>([]);
  const [elever, setElever] = useState<ElevRad[]>([]);
  const [rader, setRader] = useState<Oktrad[]>([]);
  const [grunnlag, setGrunnlag] = useState<Map<string, number | null>>(
    new Map(),
  );
  const [perioder, setPerioder] = useState<Periode[]>([]);
  const [periodemal, setPeriodemal] = useState<Map<string, string[]>>(
    new Map(),
  );
  const [oktmal, setOktmal] = useState<Map<string, string[]>>(new Map());
  const [vurderinger, setVurderinger] = useState<Vurdering[]>([]);
  const [oktvurd, setOktvurd] = useState<Map<string, OktVurdering[]>>(
    new Map(),
  );
  const [grep, setGrep] = useState<GrepFag | null>(null);

  useEffect(() => {
    let avbrutt = false;
    const last = async () => {
      const [o, e, r, g, p, pm, om, v, ov] = await Promise.all([
        hentOkter(skolear.id),
        hentElever(skolear.id),
        hentOktrader(skolear.id),
        hentFravaersgrunnlag(skolear.id),
        hentAllePerioder(skolear.id),
        hentPeriodemal(fag.id),
        hentOktmalForFag(fag.id),
        hentVurderinger(skolear.id),
        hentOktVurderinger(skolear.id),
      ]);
      if (avbrutt) return;
      setOkter(
        o.filter(
          (x) =>
            x.skolearFagId === fag.id &&
            x.dato >= skolear.start &&
            x.dato <= skolear.slutt,
        ),
      );
      setElever(e.filter((x) => x.fagIder.includes(fag.id)));
      setRader(r.filter((x) => x.skolearFagId === fag.id));
      setGrunnlag(g);
      setPerioder(p.filter((x) => x.skolearFagId === fag.id));
      setPeriodemal(pm);
      setOktmal(om);
      setVurderinger(v.filter((x) => x.skolearFagId === fag.id));
      setOktvurd(ov);
    };
    void last();
    const a = lytt(() => void last());
    const b = lyttOktvisning(() => void last());
    return () => {
      avbrutt = true;
      a();
      b();
    };
  }, [skolear.id, skolear.start, skolear.slutt, fag.id]);

  useEffect(() => {
    void finnFag(fag.grepKode ?? fag.fagkode).then(setGrep);
  }, [fag.grepKode, fag.fagkode]);

  // ------------------------------------------------------------ utregninger

  const klasser = useMemo(
    () =>
      [
        ...new Set(elever.map((e) => e.klasseNavn).filter(Boolean) as string[]),
      ].sort((a, b) => a.localeCompare(b, "nb-NO")),
    [elever],
  );
  const tider = useMemo(() => fasteTider(okter, idag), [okter, idag]);
  const holdtMin = holdteMinutter(okter, idag);
  const stolper = useMemo(
    () => periodestolper(okter, perioder, idag),
    [okter, perioder, idag],
  );
  const neste = okter.filter((o) => o.dato >= idag).slice(0, 3);
  const kommende = vurderinger
    .filter((v) => (v.frist ? v.frist >= idag : v.fort < v.elever))
    .sort((a, b) => (a.frist ?? "9999").localeCompare(b.frist ?? "9999"))
    .slice(0, 3);

  // De siste øktene som er holdt, eldst først.
  const avholdte = useMemo(() => {
    const sett = new Map<string, Oktrad>();
    for (const r of rader) if (!sett.has(r.oktId)) sett.set(r.oktId, r);
    return [...sett.values()];
  }, [rader]);

  const perElev = useMemo(() => {
    const kart = new Map<string, Map<string, Rute>>();
    for (const r of rader) {
      const m = kart.get(r.elevId) ?? new Map<string, Rute>();
      m.set(r.oktId, tilRute(r));
      kart.set(r.elevId, m);
    }
    return kart;
  }, [rader]);

  const siste16 = avholdte.slice(-16);
  const siste6 = avholdte.slice(-6);

  const heatmap = useMemo(
    () =>
      elever
        .map((e) => {
          const m = perElev.get(e.id);
          const ruter = siste16.map((o) => m?.get(o.oktId) ?? null);
          return {
            elev: e,
            ruter,
            snitt: snitt(ruter.filter(Boolean) as Rute[]),
          };
        })
        .sort(
          (a, b) =>
            (b.snitt ?? -1) - (a.snitt ?? -1) ||
            a.elev.fornavn.localeCompare(b.elev.fornavn, "nb-NO"),
        ),
    [elever, perElev, siste16],
  );

  const naa = useMemo(() => {
    const liste = elever.map((e) => {
      const m = perElev.get(e.id);
      const ruter = siste6
        .map((o) => m?.get(o.oktId))
        .filter(Boolean) as Rute[];
      return { elev: e, ruter, snitt: snitt(ruter) };
    });
    const medSnitt = liste.filter((x) => x.snitt !== null);
    const godt = [...medSnitt]
      .filter((x) => (x.snitt ?? 0) >= 0.75)
      .sort((a, b) => (b.snitt ?? 0) - (a.snitt ?? 0))
      .slice(0, 3);
    const oppfolging = [...medSnitt]
      .filter((x) => (x.snitt ?? 1) < 0.5 || glipper(x.ruter))
      .sort((a, b) => (a.snitt ?? 0) - (b.snitt ?? 0))
      .slice(0, 3);
    return { godt, oppfolging };
  }, [elever, perElev, siste6]);

  const fraver = useMemo(
    () =>
      elever
        .map((e) => ({
          elev: e,
          f:
            fravaer(rader, e.id, grunnlag).find(
              (x) => x.skolearFagId === fag.id,
            ) ?? null,
        }))
        .filter(
          (x): x is { elev: ElevRad; f: Fagfravaer } =>
            !!x.f && x.f.borteMin > 0,
        )
        .sort((a, b) => b.f.borteMin - a.f.borteMin)
        .slice(0, 6),
    [elever, rader, grunnlag, fag.id],
  );
  const grunnlagMin = grunnlag.get(fag.id) ?? null;

  const mal = useMemo(() => {
    if (grep?.kompetansemaal.length) {
      const d = maldekning(
        grep.kompetansemaal.map((k) => k.kode),
        okter,
        periodemal,
        oktmal,
        idag,
      );
      return grep.kompetansemaal.map((k) => ({
        tekst: k.tekst,
        dekning: d.get(k.kode)!,
      }));
    }
    return (fag.kompetansemal ?? "")
      .split("\n")
      .map((l) => l.replace(/^\s*([-*]|\d+[.)])\s*/, "").trim())
      .filter(Boolean)
      .map((tekst) => ({ tekst, dekning: null }));
  }, [grep, okter, periodemal, oktmal, idag, fag.kompetansemal]);

  const logg = useMemo(
    () =>
      okter
        .filter((o) => o.dato <= idag && (o.logg ?? "").trim() !== "")
        .sort((a, b) => b.dato.localeCompare(a.dato))
        .map((o) => ({
          okt: o,
          fordeling: rader
            .filter((r) => r.oktId === o.id)
            .map(tilRute)
            .sort((a, b) => RANG[a] - RANG[b]),
        })),
    [okter, rader, idag],
  );

  // ------------------------------------------------------------------ visning

  const udir = grep?.laereplan
    ? `udir.no/lk20/${grep.laereplan.toLowerCase()}`
    : null;
  const meta = [
    klasser.length ? oppramsing(klasser) : null,
    `${elever.length} ${elever.length === 1 ? "elev" : "elever"}`,
    fag.rom,
    tider || null,
  ].filter(Boolean);

  const t = fag.arstimetall
    ? tempotekst(
        tempo(holdtMin, fag.arstimetall, skolear.start, skolear.slutt, idag),
      )
    : null;

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <IVerktoylinja>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            onClick={onRedigerFag}
            className="flex h-8 items-center rounded-full px-3 text-liten text-blekk-dempet hover:text-blekk"
          >
            Rediger fag
          </button>
        </span>
      </IVerktoylinja>
      <div className="mx-auto max-w-6xl px-2 pb-8 pt-1">
        <h1 className="text-[calc(32px*var(--tekst-skala))] font-light leading-tight tracking-overskrift">
          {fag.navn}
        </h1>
        <p className="mt-1 text-[calc(13px*var(--tekst-skala))] text-blekk-dempet">
          {meta.join(" · ")}
          {udir && (
            <>
              {" · "}
              <button
                onClick={() =>
                  void import("@tauri-apps/plugin-opener").then((o) =>
                    o.openUrl(`https://www.${udir}`),
                  )
                }
                title="Læreplanen hos Udir (åpnes i nettleseren)"
                className="text-aksent hover:underline"
              >
                {udir}
              </button>
            </>
          )}
        </p>

        <div className="mt-[18px] grid grid-cols-[1fr_1.2fr_1.2fr] gap-3.5">
          <Kort tittel="Timer">
            <div className="flex items-baseline gap-2">
              <span className="text-[calc(30px*var(--tekst-skala))] font-light leading-none tracking-[-0.02em] tabular-nums">
                {Math.round(holdtMin / 60)}
              </span>
              <span className="text-[calc(13px*var(--tekst-skala))] text-blekk-dempet">
                {fag.arstimetall
                  ? `av ${fag.arstimetall} timer`
                  : "timer holdt"}
              </span>
            </div>
            {stolper.length > 0 && (
              <div className="mt-2.5 flex gap-[2px]">
                {stolper.map((s) => {
                  // Nøytrale; perioden står i verktøytipset (20.2).
                  const f = "var(--color-blekk-svak)";
                  return (
                    <span
                      key={s.id}
                      title={`${s.navn}: ${timer(s.planlagt * s.holdt)} av ${timer(s.planlagt)}`}
                      className="h-2 rounded-[2px]"
                      style={{
                        flex: s.planlagt,
                        background: `linear-gradient(90deg, ${f} ${s.holdt * 100}%, color-mix(in srgb, ${f} 20%, transparent) ${s.holdt * 100}%)`,
                      }}
                    />
                  );
                })}
              </div>
            )}
            <p
              className={`mt-2 text-[calc(12px*var(--tekst-skala))] ${t?.bak ? "text-varsel" : "text-god"}`}
            >
              {t
                ? t.tekst
                : "Legg inn årstimetall under Rediger fag for å se tempoet."}
            </p>
          </Kort>

          <Kort tittel="Neste økter">
            {neste.length === 0 ? (
              <Tom>Ingen planlagte økter igjen.</Tom>
            ) : (
              neste.map((o) => (
                <button
                  key={o.id}
                  onClick={() => ark.apneOkt(o.id)}
                  className="grid w-full grid-cols-[74px_minmax(0,1fr)] gap-2 border-b border-linje-svak py-[5px] text-left text-[calc(13px*var(--tekst-skala))] hover:bg-flate-svak"
                >
                  <span className="tabular-nums text-blekk-dempet">
                    {kortDag(o.dato)}
                  </span>
                  <span className="truncate">
                    {o.tema ?? (
                      <span className="text-blekk-svak">uten tema</span>
                    )}
                  </span>
                </button>
              ))
            )}
          </Kort>

          <Kort tittel="Kommende vurderinger">
            {kommende.length === 0 ? (
              <Tom>Ingen vurderinger med frist framover.</Tom>
            ) : (
              <div className="flex flex-col gap-2">
                {kommende.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => ark.apneVurdering(v.id)}
                    className="flex items-center gap-[9px] text-left text-[calc(13px*var(--tekst-skala))]"
                  >
                    <Vurderingsikon type={v.type} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate font-semibold">{v.tittel}</b>
                      <span className="block text-[calc(12px*var(--tekst-skala))] text-varsel">
                        {[
                          v.frist ? langDato(v.frist) : "uten frist",
                          `${v.fort} av ${v.elever} ført`,
                        ].join(" · ")}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Kort>
        </div>

        <div className="mt-3.5 grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-start gap-3.5">
          <Kort
            tittel="Klassen, økt for økt"
            under={`siste ${siste16.length || 16} økter · sortert etter snitt`}
          >
            {heatmap.length === 0 || siste16.length === 0 ? (
              <Tom>
                {elever.length === 0
                  ? "Ingen elever i faget ennå."
                  : "Ingen økter er skåret ennå."}
              </Tom>
            ) : (
              <>
                {heatmap.map(({ elev, ruter }) => (
                  <button
                    key={elev.id}
                    onClick={() =>
                      ark.apneElev(elev.id, {
                        liste: heatmap.map((h) => h.elev.id),
                        startFag: fag.id,
                      })
                    }
                    className="grid h-6 w-full grid-cols-[22px_150px_minmax(0,1fr)] items-center gap-x-2.5 text-left hover:bg-flate-svak"
                  >
                    <Elevfoto elevId={elev.id} storrelse={22} />
                    <span className="truncate text-[calc(13px*var(--tekst-skala))]">
                      <span className="font-medium">{elev.fornavn}</span>{" "}
                      {elev.etternavn}
                    </span>
                    <span className="flex gap-[2px]">
                      {ruter.map((r, i) => (
                        <span
                          key={i}
                          title={`${kortDag(siste16[i].dato)}${siste16[i].tema ? ` · ${siste16[i].tema}` : ""}${r ? ` · ${RUTENAVN[r]}` : ""}`}
                        >
                          {/* Ingen rad: eleven var ikke i faget da. */}
                          <Skarprikk
                            slag={r ?? "k"}
                            form="firkant"
                            storrelse={14}
                          />
                        </span>
                      ))}
                    </span>
                  </button>
                ))}
                <p className="mt-3 text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
                  Klikk en elev for elevkortet · hold over en rute for dato og
                  tema
                </p>
              </>
            )}
          </Kort>

          <div className="flex flex-col gap-3.5">
            <Kort tittel="Elevene nå" under="siste 6 økter">
              <div className="grid grid-cols-2 gap-4">
                <Gruppe tittel="Går godt" farge="text-god" liste={naa.godt} />
                <Gruppe
                  tittel="Trenger oppfølging"
                  farge="text-feil"
                  liste={naa.oppfolging}
                />
              </div>
              <div className="mt-3 border-t border-linje-svak pt-3">
                <div className="mb-2 flex items-baseline gap-2">
                  <b className="text-[calc(12px*var(--tekst-skala))] font-semibold">
                    Fravær mot 10 %-grensen
                  </b>
                  {grunnlagMin && (
                    <span className="text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
                      {timer(grunnlagMin * GRENSE)} av{" "}
                      {timer(grunnlagMin).replace(" t", "")}
                    </span>
                  )}
                </div>
                {fraver.length === 0 ? (
                  <Tom>Ingen fravær registrert i faget.</Tom>
                ) : (
                  fraver.map(({ elev, f }) => (
                    <Fravaerslinje
                      key={elev.id}
                      elev={elev}
                      f={f}
                      onApne={() => ark.apneElev(elev.id, { startFag: fag.id })}
                    />
                  ))
                )}
                <p className="mt-1.5 text-[calc(11.5px*var(--tekst-skala))] leading-[1.45] text-blekk-svak">
                  Udokumentert fravær over 10 % av timene i faget kan gi IV.
                  InSchool er fasit; her regnes «ikke i økta».
                </p>
              </div>
            </Kort>

            <Kort tittel="Kompetansemål" under="økter som dekker målet">
              {mal.length === 0 ? (
                <Tom>
                  Faget har ingen kompetansemål. Legg inn Udir-kode eller mål
                  under Rediger fag.
                </Tom>
              ) : (
                mal.map((m, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[18px_minmax(0,1fr)_120px_70px] items-center gap-x-2.5 border-b border-linje-svak py-1.5 text-[calc(12.5px*var(--tekst-skala))]"
                  >
                    <span className="tabular-nums text-blekk-svak">
                      {i + 1}
                    </span>
                    <span className="truncate" title={m.tekst}>
                      {m.tekst}
                    </span>
                    <Malstolpe okter={m.dekning?.okter ?? null} />
                    <span
                      className={`text-right text-[calc(12px*var(--tekst-skala))] ${
                        m.dekning?.status === "dekket"
                          ? "text-god"
                          : m.dekning?.status === "pabegynt"
                            ? "text-varsel"
                            : "text-blekk-svak"
                      }`}
                    >
                      {m.dekning
                        ? m.dekning.status === "dekket"
                          ? "Dekket"
                          : m.dekning.status === "pabegynt"
                            ? "Påbegynt"
                            : "Ikke ennå"
                        : ""}
                    </span>
                  </div>
                ))
              )}
            </Kort>
          </div>
        </div>

        <div className="mt-3.5">
          <Kort
            tittel="Logg"
            under="øktloggene, nyeste først · fordeling av skåringene til høyre"
          >
            {logg.length === 0 ? (
              <Tom>Ingen øktlogger ennå. De skrives nederst i økta.</Tom>
            ) : (
              <div className="relative">
                <span className="absolute bottom-2 left-[3.5px] top-2 w-px bg-linje" />
                {logg.map(({ okt, fordeling }) => (
                  <div
                    key={okt.id}
                    className="relative flex gap-4 pb-5 pl-[22px]"
                  >
                    <span
                      className="absolute left-0 top-[5px] h-2 w-2 rounded-[2px]"
                      style={{
                        background: fag.farge
                          ? fagfarge(fag.farge)
                          : "var(--color-linje-sterk)",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => ark.apneOkt(okt.id)}
                        className="flex items-center gap-2 text-left hover:underline"
                      >
                        <span className="text-[calc(12.5px*var(--tekst-skala))] tabular-nums text-blekk-dempet">
                          {kortDag(okt.dato)}
                        </span>
                        {(oktvurd.get(okt.id) ?? []).slice(0, 1).map((v) => (
                          <Vurderingsikon key={v.id} type={v.type} />
                        ))}
                        <b className="text-[calc(14px*var(--tekst-skala))] font-semibold">
                          {okt.tema ?? "Uten tema"}
                        </b>
                      </button>
                      <div className="mt-0.5 text-[calc(13.5px*var(--tekst-skala))]">
                        <Markdown tekst={okt.logg ?? ""} />
                      </div>
                    </div>
                    <span className="mt-1 flex h-2 w-[110px] shrink-0 gap-px">
                      {fordeling.map((r, i) => (
                        <span
                          key={i}
                          className="flex-1 rounded-[1px]"
                          style={{
                            background:
                              r === "t" ? "var(--color-stripe)" : RUTEFARGE[r],
                          }}
                        />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Kort>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- deler

function Kort({
  tittel,
  under,
  children,
}: {
  tittel: string;
  under?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[14px] bg-ark px-[18px] py-4 shadow-[inset_0_0_0_1px_var(--color-linje-svak)]">
      <div className="mb-2.5 flex items-baseline gap-2">
        <h2 className="text-[calc(13px*var(--tekst-skala))] font-semibold">
          {tittel}
        </h2>
        {under && (
          <span className="text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
            {under}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * Øktene som dekker et mål: én strek per økt, fylt når den er holdt. Med
 * mange økter blir strekene for tynne til å lese; da er det én stolpe som
 * fylles med andelen som er holdt.
 */
function Malstolpe({ okter }: { okter: boolean[] | null }) {
  if (okter === null) return <span />;
  const fylt = "var(--color-aksent)";
  const tom = "color-mix(in srgb, var(--color-aksent) 14%, transparent)";
  if (okter.length === 0)
    return <span className="h-1.5 rounded-[2px] bg-flate" />;
  if (okter.length > 10) {
    const andel = okter.filter(Boolean).length / okter.length;
    return (
      <span
        title={`${okter.filter(Boolean).length} av ${okter.length} økter holdt`}
        className="h-1.5 rounded-[2px]"
        style={{
          background: `linear-gradient(90deg, ${fylt} ${andel * 100}%, ${tom} ${andel * 100}%)`,
        }}
      />
    );
  }
  return (
    <span className="flex gap-[2px]">
      {okter.map((holdt, j) => (
        <span
          key={j}
          className="h-1.5 flex-1 rounded-[2px]"
          style={{ background: holdt ? fylt : tom }}
        />
      ))}
    </span>
  );
}

function Tom({ children }: { children: ReactNode }) {
  return (
    <p className="text-[calc(13px*var(--tekst-skala))] text-blekk-svak">
      {children}
    </p>
  );
}

function Gruppe({
  tittel,
  farge,
  liste,
}: {
  tittel: string;
  farge: string;
  liste: { elev: ElevRad; ruter: Rute[] }[];
}) {
  const ark = useArk();
  return (
    <div className="min-w-0">
      <div
        className={`mb-1.5 text-[calc(12px*var(--tekst-skala))] font-semibold ${farge}`}
      >
        {tittel}
      </div>
      {liste.length === 0 ? (
        <Tom>Ingen akkurat nå.</Tom>
      ) : (
        liste.map(({ elev, ruter }) => (
          <button
            key={elev.id}
            onClick={() => ark.apneElev(elev.id)}
            className="flex w-full items-center gap-2 py-[3px] text-left text-[calc(13px*var(--tekst-skala))] hover:bg-flate-svak"
          >
            <Elevfoto elevId={elev.id} storrelse={22} />
            <span className="min-w-0 flex-1 truncate">
              {elev.fornavn} {elev.etternavn}
            </span>
            <span className="flex shrink-0 gap-[2px]">
              {ruter.map((r, i) => (
                <Skarprikk
                  key={i}
                  slag={r}
                  form="firkant"
                  storrelse={10}
                  tittel={RUTENAVN[r]}
                />
              ))}
            </span>
          </button>
        ))
      )}
    </div>
  );
}

function Fravaerslinje({
  elev,
  f,
  onApne,
}: {
  elev: ElevRad;
  f: Fagfravaer;
  onApne: () => void;
}) {
  const merke = fravaersmerke(f.andel);
  const avGrensen = f.andel === null ? 0 : f.andel / GRENSE;
  const farge =
    avGrensen > 1
      ? "var(--color-lys-rod)"
      : avGrensen >= 0.5
        ? "var(--color-lys-gul)"
        : "var(--color-blekk-svak)";
  return (
    <button
      onClick={onApne}
      title={`${f.borte} av ${f.okter} økter · ${timer(f.borteMin)}`}
      className="grid h-[26px] w-full grid-cols-[22px_108px_minmax(0,1fr)_62px_82px] items-center gap-x-2 text-left text-[calc(12.5px*var(--tekst-skala))] hover:bg-flate-svak"
    >
      <Elevfoto elevId={elev.id} storrelse={20} />
      <span className="truncate">
        {elev.fornavn} {elev.etternavn.slice(0, 1)}.
      </span>
      <span className="relative h-1.5 rounded-[3px] bg-flate">
        <span
          className="absolute inset-y-0 left-0 rounded-[3px]"
          style={{
            width: `${Math.min(100, avGrensen * 100)}%`,
            background: farge,
          }}
        />
      </span>
      <span
        className={`text-right tabular-nums ${avGrensen > 1 ? "font-semibold text-feil" : ""}`}
      >
        {timer(f.borteMin)}
      </span>
      <span
        className={`text-right text-[calc(11.5px*var(--tekst-skala))] ${
          merke?.niva === "rod" ? "text-feil" : "text-varsel"
        }`}
      >
        {merke?.tekst ?? ""}
      </span>
    </button>
  );
}

// ------------------------------------------------------------------ hjelp

const RUTEFARGE: Record<Rute, string> = {
  g: "var(--color-lys-gronn)",
  y: "var(--color-lys-gul)",
  r: "var(--color-lys-rod)",
  o: "var(--color-lys-borte)",
  n: "var(--color-linje-sterk)",
  // Ikke skåret (19.4): til stede, ikke sett. Tom rute med kant.
  t: "transparent",
};
const RUTENAVN: Record<Rute, string> = {
  g: "grønn",
  y: "gul",
  r: "rød",
  o: "ikke i økta",
  n: "skåret",
  t: "ikke skåret",
};
const RANG: Record<Rute, number> = { g: 0, y: 1, r: 2, n: 3, t: 4, o: 5 };

function iDag(): string {
  const d = new Date();
  const to = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${to(d.getMonth() + 1)}-${to(d.getDate())}`;
}

function langDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
  });
}
