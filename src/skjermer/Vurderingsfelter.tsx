import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useArk } from "../ui/Arkstabel";
import { Ikon } from "../ui/felles";
import { Velger } from "../ui/Velger";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  endreVurdering,
  hentOktvalg,
  knyttOkt,
  losOkt,
  settFrist,
  type Oktvalg,
  type Vurdering,
  type Vurderingstype,
} from "../data/vurderinger";
import type { Skala } from "../skala";
import { Vurderingsikon } from "../ui/Vurderingsikon";

/**
 * Feltene på en vurdering (SPEC §4.6): tittel, type, frist, skala og
 * øktene den holdes i. Brukes under «Oppsett» i føringsarket og i
 * Planlegg for muntlig.
 */

const TYPER: { verdi: Vurderingstype; navn: string }[] = [
  { verdi: "skriftlig", navn: "Skriftlig" },
  { verdi: "muntlig", navn: "Muntlig" },
  { verdi: "innlevering", navn: "Innlevering" },
  { verdi: "praktisk", navn: "Praktisk" },
];

export function Felter({
  vurdering,
  skalaer,
  okter,
  onEndret,
  onApneSamtaler,
  utenOkt,
}: {
  /** muntlig: øktene velges i tidsplanen, ikke her (én plass) */
  utenOkt?: boolean;
  vurdering: Vurdering;
  skalaer: Skala[];
  /** øktene i faget, til «Økt»-valget */
  okter: Oktvalg[];
  onEndret: () => void;
  onApneSamtaler?: (skolearFagId: string) => void;
}) {
  return (
    <div className="space-y-2 px-5 py-3">
      <Linje etikett="Tittel">
        <input
          defaultValue={vurdering.tittel}
          key={vurdering.tittel}
          onBlur={async (e) => {
            const t = e.target.value.trim();
            if (t && t !== vurdering.tittel) {
              await endreVurdering(vurdering.id, { tittel: t });
              onEndret();
            }
          }}
          className={feltStil}
        />
      </Linje>

      {/* Rutenett, ikke flex: i et smalt ark brekker feltene til to rader i
          stedet for at «Økt» klemmes til én bokstav. */}
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
        <Linje etikett="Type">
          <Velger
            verdi={vurdering.type ?? ""}
            settVerdi={async (v) => {
              await endreVurdering(vurdering.id, {
                type: (v || null) as Vurderingstype | null,
              });
              onEndret();
            }}
            bredde="w-full"
            etikett="Type"
            valg={[
              { verdi: "", tekst: "Ingen type", dempet: true },
              ...TYPER.map((t) => ({
                verdi: t.verdi,
                tekst: t.navn,
                ikon: <Vurderingsikon type={t.verdi} />,
              })),
            ]}
          />
          {/*
            En muntlig vurdering trekkes i Samtaler. Inngangen står her, der
            man er når man vet at den skal trekkes (§4.10).
          */}
          {vurdering.type === "muntlig" && onApneSamtaler && (
            <button
              onClick={() => onApneSamtaler(vurdering.skolearFagId)}
              className="mt-1 text-liten text-blekk-dempet hover:text-blekk"
            >
              Trekk rekkefølge og tema <Ikon navn="pil" />
            </button>
          )}
        </Linje>

        <Linje etikett="Frist">
          <input
            type="date"
            defaultValue={vurdering.frist ?? ""}
            key={vurdering.frist ?? ""}
            onBlur={async (e) => {
              const ny = e.target.value || null;
              if (ny === vurdering.frist) return;
              // Økta følger fristen når det finnes en økt den dagen.
              await settFrist(vurdering.id, ny);
              onEndret();
            }}
            className={feltStil}
          />
        </Linje>

        {/*
          Økta vurderingen holdes i. Settes av seg selv når fristen faller
          på en øktdag; velges her når det er en annen — innleveringen som
          gis ut i én time og leveres senere. Vises på årsplanen.
        */}
        {!utenOkt && (
          <Oktkobling vurdering={vurdering} okter={okter} onEndret={onEndret} />
        )}

        <Linje etikett="Skala">
          <Velger
            verdi={vurdering.skalaId}
            settVerdi={async (v) => {
              if (
                !(await bekreft(
                  "Bytte skala? Resultater som allerede er ført peker på verdier " +
                    "i den gamle skalaen og må føres på nytt.",
                ))
              )
                return;
              await endreVurdering(vurdering.id, { skala_id: v });
              onEndret();
            }}
            bredde="w-full"
            etikett="Skala"
            valg={skalaer.map((s) => ({ verdi: s.id, tekst: s.navn }))}
          />
        </Linje>
      </div>

      <Linje etikett="Beskrivelse">
        <textarea
          defaultValue={vurdering.beskrivelse ?? ""}
          key={vurdering.beskrivelse ?? ""}
          rows={2}
          placeholder="Hva går oppgaven ut på?"
          onBlur={async (e) => {
            await endreVurdering(vurdering.id, {
              beskrivelse: e.target.value.trim() || null,
            });
            onEndret();
          }}
          className={feltStil}
        />
      </Linje>
    </div>
  );
}

const feltStil =
  "w-full rounded border border-linje bg-ark px-2 py-1 text-brod tabular-nums outline-none placeholder:text-blekk-svak focus:border-aksent";

function Linje({
  etikett,
  children,
}: {
  etikett: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block w-full">
      <span className="mb-0.5 block text-etikett uppercase tracking-etikett text-blekk-dempet">
        {etikett}
      </span>
      {children}
    </label>
  );
}

/**
 * Øktene vurderingen holdes i. En muntlig vurdering som ikke får plass i én
 * økt, strekkes over flere — da står den på alle i årsplanen.
 *
 * Ikke en <label>: den har flere knapper i seg.
 */
function Oktkobling({
  vurdering,
  okter,
  onEndret,
}: {
  vurdering: Vurdering;
  okter: Oktvalg[];
  onEndret: () => void;
}) {
  const her = okter.filter((o) => vurdering.oktIder.includes(o.id));
  const andre = okter.filter((o) => !vurdering.oktIder.includes(o.id));
  const ark = useArk();

  return (
    <div>
      <span className="mb-0.5 block text-etikett uppercase tracking-etikett text-blekk-dempet">
        {her.length > 1 ? "Økter" : "Økt"}
      </span>
      {her.map((o) => (
        <div key={o.id} className="flex items-baseline gap-2 text-brod">
          <button
            onClick={() => ark.apneOkt(o.id)}
            className="min-w-0 flex-1 truncate text-left hover:text-aksent hover:underline"
          >
            {oktetikett(o)}
          </button>
          <button
            onClick={async () => {
              await losOkt(vurdering.id, o.id);
              onEndret();
            }}
            className="shrink-0 text-liten text-blekk-svak hover:text-blekk"
          >
            Løs
          </button>
        </div>
      ))}
      <span className={`block ${her.length > 0 ? "mt-1" : ""}`}>
        <Velger
          verdi=""
          settVerdi={async (v) => {
            await knyttOkt(vurdering.id, v);
            onEndret();
          }}
          bredde="w-full"
          etikett="Knytt til en økt"
          plassholder={
            her.length > 0 ? "Legg til en økt til …" : "Knytt til en økt …"
          }
          valg={andre.map((o) => ({ verdi: o.id, tekst: oktetikett(o) }))}
        />
      </span>
    </div>
  );
}

/** «tir 06.10 · Markedsanalyse» */
export function oktetikett(o: Oktvalg): string {
  const d = new Date(`${o.dato}T12:00:00`);
  const dag = d
    .toLocaleDateString("nb-NO", { weekday: "short" })
    .replace(".", "");
  const dato = d.toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
  });
  const tid = o.klokkeslett ? ` ${o.klokkeslett}` : "";
  return `${dag} ${dato}${tid}${o.tema ? ` · ${o.tema}` : ""}`;
}

/**
 * Øktene vurderingen holdes i, som en brikke øverst i arket: «I økta tor
 * 5.11» eller «Knytt til en økt». Et klikk åpner en liten meny med øktene
 * den ligger i (åpne, løs) og valget av en ny. Samme kobling som under
 * Oppsett, bare der du ser den.
 */
export function Oktbrikke({
  vurdering,
  onEndret,
}: {
  vurdering: Vurdering;
  onEndret: () => void;
}) {
  const [okter, setOkter] = useState<Oktvalg[]>([]);
  const [apen, setApen] = useState<{ top: number; left: number } | null>(null);
  const boks = useRef<HTMLDivElement>(null);
  const ark = useArk();
  useEffect(() => {
    void hentOktvalg(vurdering.skolearFagId).then(setOkter);
  }, [vurdering.skolearFagId, vurdering.oktIder.join()]);
  useEffect(() => {
    if (!apen) return;
    const ut = (e: MouseEvent) => {
      const m = e.target as HTMLElement;
      if (boks.current?.contains(m) || m.closest?.('[data-inngang="meny"]'))
        return;
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

  const her = okter.filter((o) => vurdering.oktIder.includes(o.id));
  const forste = her[0];
  const tekst = forste
    ? `I økta ${oktetikett(forste).split(" · ")[0]}${her.length > 1 ? ` +${her.length - 1}` : ""}`
    : "Knytt til en økt";
  return (
    <>
      <button
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setApen((a) => (a ? null : { top: r.bottom + 6, left: r.left }));
        }}
        aria-expanded={!!apen}
        title="Øktene vurderingen holdes i"
        className={`inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[12.5px] ${
          forste
            ? "bg-flate text-blekk hover:bg-valgt"
            : "text-aksent shadow-[inset_0_0_0_1px_var(--color-linje)] hover:bg-flate-svak"
        }`}
      >
        {tekst}
        <span className="text-[10px] opacity-60">⌄</span>
      </button>
      {apen &&
        createPortal(
          <div
            ref={boks}
            className="glass-meny ny-meny-inn fixed z-[70] w-[320px] rounded-[14px] p-3"
            style={{ top: apen.top, left: apen.left }}
          >
            <Oktkobling
              vurdering={vurdering}
              okter={okter}
              onEndret={() => {
                onEndret();
                void hentOktvalg(vurdering.skolearFagId).then(setOkter);
              }}
            />
            {her.length > 0 && (
              <button
                onClick={() => {
                  setApen(null);
                  ark.apneOkt(her[0].id);
                }}
                className="mt-2 text-liten text-aksent hover:underline"
              >
                Åpne økta ›
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
