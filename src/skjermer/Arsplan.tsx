import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  formatTimer,
  ukedag,
  type Ark,
  type Arkrad,
  type Kolonne,
} from "../data/arsplanark";
import { KOLONNENAVN } from "../data/arsplaneksport";
import { delISider, MAL, type Arkelement } from "../data/arsplansider";
import { Merke } from "../ui/logo";
import { vurderingstype } from "../ui/Vurderingsikon";
import { fagfarge } from "../ui/farger";

/**
 * Årsplanen på papir, SPEC §4.9 (ARBEIDSLISTE 11.6, lerretet
 * «ArsplanPdf1–3»).
 *
 * Egen visning, ikke utskrift av skjermbildet: A4-sider med toppen på
 * side 1 (fag, faglærer, rom, tid, timene per periode, om faget og
 * kompetansemålene), tabellen med perioder som overskrifter, en smal
 * topplinje og «… fortsetter» på neste sider, og «Side n av N» nederst.
 * Lesbar i svart-hvitt: fargene er bare prikker og streker.
 *
 * Innholdet kommer ferdig bygget fra `byggArk` — det samme som markdown,
 * CSV og Word lages av. Sidene deles i `data/arsplansider.ts`; her måles
 * bare toppen på side 1, før utskriftsdialogen åpnes (målingen skjer i en
 * layout-effekt, som er ferdig når `flushSync` i Økter slipper).
 */
export function Arsplan({ ark }: { ark: Ark[] }) {
  const liggende = ark[0]?.liggende ?? false;
  return (
    <div className="kunutskrift arsplanark">
      {/* Margene står i selve sidene. Liggende gjelder hele utskriften. */}
      <style>
        {`@media print { @page { size: A4 ${liggende ? "landscape" : "portrait"}; margin: 0; } }`}
      </style>
      {ark.map((a) => (
        <Fag key={`${a.fagKode}-${a.skolearNavn}`} ark={a} />
      ))}
    </div>
  );
}

const B = { stende: 794, liggende: 1123 };
const H = { stende: 1123, liggende: 794 };

function Fag({ ark }: { ark: Ark }) {
  const topp = useRef<HTMLDivElement>(null);
  const [hoyde, setHoyde] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (topp.current) setHoyde(topp.current.offsetHeight);
  }, [ark]);

  const bredde = ark.liggende ? B.liggende : B.stende;
  const sider = hoyde === null ? null : delISider(ark, hoyde);
  const kol = kolonnerPaArket(ark.kolonner);

  return (
    <>
      {/*
        Toppen måles i full bredde før sidene deles. Rett i <body>: inne i
        .kunutskrift er alt skjult på skjermen, og da måler det 0.
      */}
      {createPortal(
        <div
          aria-hidden
          style={{
            width: bredde - 112,
            position: "fixed",
            left: -10000,
            top: 0,
            visibility: "hidden",
          }}
        >
          <div ref={topp}>
            <Topp ark={ark} />
          </div>
        </div>,
        document.body,
      )}
      {sider?.map((s, i) => (
        <Ark4 key={i} ark={ark}>
          {i === 0 ? <Topp ark={ark} /> : <Smaltopp ark={ark} />}
          <Kolonnehode kol={kol} />
          {s.elementer.map((e, j) => (
            <Element key={j} e={e} kol={kol} />
          ))}
          <Bunn ark={ark} side={i + 1} av={sider.length} />
        </Ark4>
      ))}
    </>
  );
}

function Ark4({ ark, children }: { ark: Ark; children: ReactNode }) {
  return (
    <section
      className="fagside relative box-border overflow-hidden bg-white text-[#241f33]"
      style={{
        width: ark.liggende ? B.liggende : B.stende,
        height: ark.liggende ? H.liggende : H.stende,
        padding: "44px 56px 70px",
        breakAfter: "page",
        fontFamily: "var(--font-sans)",
      }}
    >
      {children}
    </section>
  );
}

// -------------------------------------------------------------------- topp

function Topp({ ark }: { ark: Ark }) {
  const farge = ark.farge ? fagfarge(ark.farge) : "#241f33";
  const r = ark.regnskap;
  const stolper = ark.bolker.filter((b) => b.navn && b.timer > 0);
  return (
    <div className="pb-[18px]">
      <header className="flex items-center gap-2 text-[11.5px] text-[#5d566f]">
        <Merke storrelse={18} />
        <span className="font-semibold text-[#241f33]">Årsplan</span>
        <span>· skoleåret {ark.skolearNavn}</span>
        <span className="flex-1" />
        {ark.sistOppdatert && (
          <span>Sist oppdatert {langDato(ark.sistOppdatert)}</span>
        )}
      </header>

      <div className="mt-[30px] flex items-end gap-[18px]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[9px]">
            <span
              className="h-3 w-3 rounded-[3px]"
              style={{ background: farge }}
            />
            <span
              className="text-[15px] font-semibold tracking-[0.02em]"
              style={{ color: farge }}
            >
              {ark.fagKode}
              {ark.offisiellKode && (
                <span className="font-normal text-[#6b6480]">
                  {" "}
                  ({ark.offisiellKode})
                </span>
              )}
            </span>
          </div>
          <h1 className="mt-1.5 text-[38px] font-light leading-[1.05] tracking-[-0.02em]">
            {ark.fagNavn}
          </h1>
        </div>
        <div className="text-right text-[12px] leading-[1.6] text-[#3a3450]">
          {ark.laerer && (
            <div>
              <span className="text-[#6b6480]">Faglærer</span> {ark.laerer}
            </div>
          )}
          {ark.rom && (
            <div>
              <span className="text-[#6b6480]">Rom</span> {ark.rom}
            </div>
          )}
          {ark.tider && (
            <div>
              <span className="text-[#6b6480]">Tid</span>{" "}
              {ark.tider.replace(" og ", " · ")}
            </div>
          )}
        </div>
      </div>

      {r && (
        <div className="mt-[18px] rounded-lg border border-[#e3dfeb] px-3.5 py-3">
          <div className="flex items-baseline gap-2 text-[12.5px]">
            <b className="font-semibold">
              {r.arstimetall
                ? `${formatTimer(r.timer)} av ${r.arstimetall} timer`
                : `${formatTimer(r.timer)} timer`}
            </b>
            <span className="text-[#5d566f]">
              · {r.antallOkter} {r.antallOkter === 1 ? "økt" : "økter"}
              {r.arstimetall &&
                (r.timer >= r.arstimetall
                  ? " · hele timetallet i læreplanen er dekket"
                  : ` · ${formatTimer(r.arstimetall - r.timer)} timer er ikke planlagt ennå`)}
              {r.samtaletimer > 0 &&
                `, pluss ${formatTimer(r.samtaletimer)} til muntlig vurdering`}
            </span>
          </div>
          {stolper.length > 0 && (
            <>
              <div className="mt-2 flex gap-[2px] overflow-hidden rounded-[3px]">
                {stolper.map((b, i) => (
                  <span
                    key={i}
                    className="h-1.5"
                    style={{ flex: b.timer, background: b.farge ?? "#9a90b8" }}
                  />
                ))}
              </div>
              <div className="mt-[5px] flex gap-[2px]">
                {stolper.map((b, i) => (
                  <span
                    key={i}
                    className="truncate text-[10.5px] text-[#5d566f]"
                    style={{ flex: b.timer }}
                  >
                    {b.navn}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {(ark.arknotat ||
        ark.kompetansemal.length > 0 ||
        ark.kompetansemalFritekst) && (
        <div className="mt-[18px] grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-[26px]">
          <div>
            {ark.arknotat && (
              <>
                <div className="mb-[5px] text-[12px] font-semibold">
                  Om faget i år
                </div>
                <p className="whitespace-pre-line text-[12.5px] leading-[1.55] text-[#2e2840]">
                  {ark.arknotat}
                </p>
              </>
            )}
          </div>
          <div>
            {(ark.kompetansemal.length > 0 || ark.kompetansemalFritekst) && (
              <>
                <div className="mb-[5px] text-[12px] font-semibold">
                  Kompetansemål
                  {ark.laereplan && (
                    <span className="font-normal text-[#5d566f]">
                      {" "}
                      (hentet fra{" "}
                      <a
                        href={`https://www.udir.no/lk20/${ark.laereplan.toLowerCase()}`}
                        className="text-[#3a3450] underline decoration-[#b9b0d3] underline-offset-2"
                      >
                        udir.no/lk20/{ark.laereplan.toLowerCase()}
                      </a>
                      )
                    </span>
                  )}
                </div>
                {ark.kompetansemal.length > 0 ? (
                  <div className="flex flex-col gap-[2px]">
                    {ark.kompetansemal.map((m, i) => (
                      <div
                        key={m.kode}
                        className="grid grid-cols-[20px_minmax(0,1fr)] text-[11.5px] leading-[1.4] text-[#2e2840]"
                      >
                        <span className="tabular-nums text-[#6b6480]">
                          {i + 1}
                        </span>
                        <span>{m.tekst}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="whitespace-pre-line text-[11.5px] leading-[1.4]">
                    {ark.kompetansemalFritekst}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Smaltopp({ ark }: { ark: Ark }) {
  return (
    <header
      className="flex items-start gap-2 text-[11.5px] text-[#5d566f]"
      style={{ height: MAL.topp }}
    >
      <span
        className="mt-[3px] h-[9px] w-[9px] rounded-[2px]"
        style={{ background: ark.farge ? fagfarge(ark.farge) : "#241f33" }}
      />
      <span className="font-semibold text-[#241f33]">
        {ark.fagKode} · {ark.fagNavn}
      </span>
      <span>· årsplan {ark.skolearNavn}</span>
      <span className="flex-1" />
      <Merke storrelse={16} />
    </header>
  );
}

function Bunn({ ark, side, av }: { ark: Ark; side: number; av: number }) {
  return (
    <footer className="absolute inset-x-14 bottom-[30px] flex border-t border-[#e3dfeb] pt-2.5 text-[10.5px] text-[#5d566f]">
      <span>
        <b className="font-semibold text-[#241f33]">Årsplan {ark.fagKode}</b> ·
        skoleåret {ark.skolearNavn}
      </span>
      <span className="flex-1" />
      <span className="tabular-nums">
        Side {side} av {av}
      </span>
    </footer>
  );
}

// ------------------------------------------------------------------ tabell

/**
 * Kolonnene på papiret. Dato blir Dag og Dato, som i lerretet; de valgfrie
 * (klokkeslett, timer, rom, agenda, mål) får plass når de er valgt.
 */
type Papirkolonne = Kolonne | "dag";

function kolonnerPaArket(kol: Kolonne[]): Papirkolonne[] {
  return kol.flatMap((k): Papirkolonne[] =>
    k === "dato" ? ["dag", "dato"] : [k],
  );
}

const SPOR: Record<Papirkolonne, string> = {
  uke: "26px",
  dag: "26px",
  dato: "44px",
  tid: "40px",
  varighet: "34px",
  tema: "minmax(0,1fr)",
  sted: "48px",
  agenda: "minmax(0,0.8fr)",
  lekse: "minmax(0,0.62fr)",
  maal: "minmax(0,0.8fr)",
  vurdering: "86px",
};

function rutenett(kol: Papirkolonne[]): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: kol.map((k) => SPOR[k]).join(" "),
    columnGap: 14,
    alignItems: "center",
  };
}

function Kolonnehode({ kol }: { kol: Papirkolonne[] }) {
  return (
    <div
      className="border-b border-[#241f33] text-[11px] font-semibold tracking-[0.03em] text-[#3a3450]"
      style={{
        ...rutenett(kol),
        height: MAL.kolonnehode,
        alignItems: "end",
        paddingBottom: 5,
        boxSizing: "border-box",
      }}
    >
      {kol.map((k) => (
        <span
          key={k}
          className={
            k === "dato" ? "text-right" : k === "tema" ? "pl-[21px]" : ""
          }
        >
          {k === "dag" ? "Dag" : KOLONNENAVN[k]}
        </span>
      ))}
    </div>
  );
}

function Element({ e, kol }: { e: Arkelement; kol: Papirkolonne[] }) {
  if (e.type === "periode") {
    const b = e.bolk;
    if (e.fortsetter)
      return (
        <div
          className="box-border flex items-end gap-2 pb-1 text-[12px] text-[#5d566f]"
          style={{ height: MAL.fortsetter }}
        >
          <Prikk farge={b.farge} />
          <span className="font-semibold text-[#241f33]">{b.navn}</span>
          fortsetter
        </div>
      );
    const uker = [...new Set(b.rader.map((r) => r.uke))];
    return (
      <div
        className="box-border flex items-end gap-2 border-b border-[#241f33] pb-1.5 text-[12px] text-[#5d566f]"
        style={{ height: MAL.periode }}
      >
        <Prikk farge={b.farge} />
        <span className="text-[14px] font-semibold text-[#241f33]">
          {b.navn}
        </span>
        <span>
          {uker.length > 0 &&
            `uke ${uker[0]}${uker.length > 1 ? `–${uker[uker.length - 1]}` : ""} · `}
          {b.rader.length} {b.rader.length === 1 ? "økt" : "økter"} ·{" "}
          {formatTimer(b.timer)} t
        </span>
        <span className="flex-1" />
        {b.malNr.length > 0 && <span>Mål {b.malNr.join(", ")}</span>}
      </div>
    );
  }
  if (e.type === "ferie")
    return (
      <div
        className="box-border border-b border-[#e3dfeb] text-[12.5px]"
        style={{ ...rutenett(kol), height: MAL.rad }}
      >
        {kol.map((k) => (
          <span
            key={k}
            className={
              k === "uke"
                ? "tabular-nums text-[#5d566f]"
                : k === "tema"
                  ? "pl-[21px] italic text-[#5d566f]"
                  : ""
            }
          >
            {k === "uke" ? e.uke : k === "tema" ? e.navn : ""}
          </span>
        ))}
      </div>
    );
  return <Rad r={e.rad} kol={kol} />;
}

function Rad({ r, kol }: { r: Arkrad; kol: Papirkolonne[] }) {
  const vurdering = r.vurderinger.length > 0;
  return (
    <div
      className={`box-border border-b border-[#e3dfeb] text-[12.5px] ${r.utenfor ? "text-[#9a90b8]" : ""}`}
      style={{
        ...rutenett(kol),
        height: MAL.rad,
        background: vurdering ? "#faf5ea" : undefined,
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {kol.map((k) => (
        <Celle key={k} k={k} r={r} vurdering={vurdering} />
      ))}
    </div>
  );
}

function Celle({
  k,
  r,
  vurdering,
}: {
  k: Papirkolonne;
  r: Arkrad;
  vurdering: boolean;
}) {
  switch (k) {
    case "uke":
      return <span className="tabular-nums text-[#5d566f]">{r.uke}</span>;
    case "dag":
      return <span className="text-[#5d566f]">{ukedag(r.dato)}</span>;
    case "dato": {
      const [, m, d] = r.dato.split("-").map(Number);
      return (
        <span className="whitespace-nowrap text-right tabular-nums">
          {d}.{m}.
        </span>
      );
    }
    case "tid":
      return <span className="tabular-nums">{r.klokkeslett ?? ""}</span>;
    case "varighet":
      return (
        <span className="tabular-nums">
          {formatTimer(r.varighetMin / 60)} t
        </span>
      );
    case "tema":
      return (
        <span className="relative flex min-w-0 items-center pl-[21px]">
          {vurdering && (
            <span className="absolute left-0 inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-[#b8862a]">
              <svg
                viewBox="0 0 12 12"
                className="h-[10px] w-[10px]"
                fill="none"
                stroke="#fff"
                strokeWidth={1.3}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {r.vurderingType === "muntlig" ? (
                  <path d="M2 3.2c0-.7.5-1.2 1.2-1.2h5.6c.7 0 1.2.5 1.2 1.2v3.6c0 .7-.5 1.2-1.2 1.2H5.2L3 9.8V8h0c-.6 0-1-.5-1-1.1z" />
                ) : (
                  <>
                    <path d="M7.6 2.2l2.2 2.2-5.4 5.4H2.2V7.6z" />
                    <path d="M6.6 3.2l2.2 2.2" />
                  </>
                )}
              </svg>
            </span>
          )}
          <span className={`truncate ${vurdering ? "font-semibold" : ""}`}>
            {r.tema ?? ""}
          </span>
        </span>
      );
    case "sted":
      return <span className="truncate">{r.sted ?? ""}</span>;
    case "agenda":
      return <span className="truncate text-[#3a3450]">{r.agenda ?? ""}</span>;
    case "lekse":
      return <span className="truncate text-[#3a3450]">{r.lekse ?? ""}</span>;
    case "maal":
      return (
        <span className="truncate text-[11px] text-[#3a3450]">
          {r.mal.join("; ")}
        </span>
      );
    case "vurdering":
      return vurdering ? (
        <span
          className="truncate font-semibold text-[#6b4a10]"
          title={r.vurderinger.join(", ")}
        >
          {vurderingstype(r.vurderingType)}
        </span>
      ) : (
        <span />
      );
  }
}

function Prikk({ farge }: { farge: string | null }) {
  return (
    <span
      className="mb-[4px] h-2 w-2 shrink-0 rounded-full"
      style={{ background: farge ?? "#9a90b8", printColorAdjust: "exact" }}
    />
  );
}

function langDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
