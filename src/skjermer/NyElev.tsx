import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  finnEllerOpprettKlasse,
  hentForDuplikatsjekk,
  koblePaFag,
  opprettElev,
  settKlasse,
  settMentor,
  type Klasse,
} from "../data/elever";
import type { FagIAr } from "../data/fag";
import type { EksisterendeElev } from "../import/duplikat";
import { delVed, finnTreff, initialer, nesteSkille } from "./elevnavn";

/** Sirkelens farge følger navnet, så samme navn får samme farge. */
const SIRKEL = [
  "#8a7bc2",
  "#5f9e98",
  "#c0607a",
  "#4f7ac0",
  "#c9922e",
  "#7d6bb0",
  "#3d7a5a",
  "#a2574a",
];
function sirkelfarge(navn: string): string {
  let h = 0;
  for (let i = 0; i < navn.length; i++) h = (h * 31 + navn.charCodeAt(i)) % 997;
  return SIRKEL[h % SIRKEL.length];
}

// Klassen huskes til neste gang kortet åpnes: elever legges gjerne inn
// klassevis.
let sistKlasse: string | null = null;

type Laget = { id: string; navn: string; hvor: string };

/**
 * Ny elev (ARBEIDSLISTE 19.1, lerretet ElevNy). Glasskort under «+ Ny elev»:
 * navn, klasse, fag og mentorelev på ett sted. Navnet deles mens du
 * skriver, og Tab flytter skillet. Navnet sjekkes mot elevene som finnes
 * (§7.1) — samme navn stenger Lagre.
 *
 * ↵ lagrer og åpner elevkortet. ⇧↵ lagrer og tømmer navnet til neste, med
 * klasse og fag stående. Esc lukker.
 */
export function NyElev({
  skolearId,
  klasser,
  fag,
  arvFag,
  onLukk,
  onLaget,
  onApne,
}: {
  skolearId: string;
  klasser: Klasse[];
  fag: FagIAr[];
  /** faget i filteret, forhåndsvalgt (§4.3) */
  arvFag: string | null;
  onLukk: () => void;
  /** apne: ↵ — lukk og åpne elevkortet; ellers står kortet videre */
  onLaget: (id: string, apne: boolean) => void;
  /** «Åpne» på duplikatlinja */
  onApne: (id: string) => void;
}) {
  const [navn, setNavn] = useState("");
  const [skille, setSkille] = useState<number | null>(null);
  const [klasse, setKlasse] = useState<string | null>(
    sistKlasse && klasser.some((k) => k.id === sistKlasse) ? sistKlasse : null,
  );
  const [nyKlasse, setNyKlasse] = useState<string | null>(null);
  const [valgteFag, setValgteFag] = useState<Set<string>>(
    new Set(arvFag ? [arvFag] : []),
  );
  const [kontakt, setKontakt] = useState(false);
  const [laget, setLaget] = useState<Laget[]>([]);
  const [likevel, setLikevel] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [eksisterende, setEksisterende] = useState<EksisterendeElev[]>([]);
  const lagrer = useRef(false);
  const boks = useRef<HTMLDivElement>(null);
  const felt = useRef<HTMLInputElement>(null);

  // Kortet legges i body og festes under knappen. Inne i verktøylinja ble
  // det klipt bort (linja har fast høyde og skjuler det som stikker ut).
  const [plass, setPlass] = useState<{ topp: number; hoyre: number } | null>(
    null,
  );
  useLayoutEffect(() => {
    const finn = () => {
      const knapp = document.querySelector<HTMLElement>("[data-ny-elev]");
      if (!knapp) return;
      const r = knapp.getBoundingClientRect();
      setPlass({ topp: r.bottom + 8, hoyre: window.innerWidth - r.right });
    };
    finn();
    window.addEventListener("resize", finn);
    return () => window.removeEventListener("resize", finn);
  }, []);

  useEffect(() => {
    void hentForDuplikatsjekk(skolearId).then(setEksisterende);
  }, [skolearId, laget.length]);

  useEffect(() => {
    const ute = (e: MouseEvent) => {
      const mal = e.target as HTMLElement;
      // Knappen som åpnet kortet lukker det selv, med sitt eget klikk.
      if (mal.closest?.("[data-ny-elev]")) return;
      if (!boks.current?.contains(mal)) onLukk();
    };
    window.addEventListener("mousedown", ute);
    return () => window.removeEventListener("mousedown", ute);
  }, [onLukk]);

  const { fornavn, etternavn } = delVed(navn, skille);
  const treff = finnTreff(fornavn, etternavn, eksisterende);
  const stengt =
    !fornavn || !etternavn || (treff?.slag === "finnes" && !likevel);
  const ini = initialer(fornavn, etternavn);

  async function lagre(apne: boolean) {
    if (stengt || lagrer.current) return;
    lagrer.current = true;
    try {
      const id = await opprettElev(fornavn, etternavn);
      if (klasse) await settKlasse(id, skolearId, klasse);
      for (const f of valgteFag) await koblePaFag(id, f);
      if (kontakt && klasse) await settMentor(id, skolearId, true);
      sistKlasse = klasse;
      const hvor = [
        klasser.find((k) => k.id === klasse)?.navn,
        fag
          .filter((f) => valgteFag.has(f.id))
          .map((f) => f.kode)
          .join(", "),
      ]
        .filter(Boolean)
        .join(" · ");
      setLaget((l) => [{ id, navn: `${fornavn} ${etternavn}`, hvor }, ...l]);
      setNavn("");
      setSkille(null);
      setLikevel(false);
      setFeil(null);
      felt.current?.focus();
      onLaget(id, apne);
    } catch (e) {
      setFeil(`Kunne ikke opprette eleven: ${String(e)}`);
    } finally {
      lagrer.current = false;
    }
  }

  async function lagKlasse() {
    const n = nyKlasse?.trim();
    setNyKlasse(null);
    if (!n) return;
    const id = await finnEllerOpprettKlasse(skolearId, n);
    setKlasse(id);
    felt.current?.focus();
  }

  if (!plass) return null;
  return createPortal(
    <div
      ref={boks}
      role="dialog"
      aria-label="Ny elev"
      style={{
        top: plass.topp,
        right: plass.hoyre,
        maxHeight: `calc(100vh - ${plass.topp + 16}px)`,
      }}
      className="nyelev glass-meny fixed z-50 w-[440px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-[20px]"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onLukk();
        }
      }}
    >
      <div className="px-[22px] pt-5">
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[17px] font-semibold text-white transition-[background] duration-300"
            style={{
              background: ini
                ? sirkelfarge(`${fornavn} ${etternavn}`)
                : "var(--color-linje)",
            }}
          >
            {ini || "+"}
          </span>
          <input
            ref={felt}
            autoFocus
            value={navn}
            aria-label="Navn"
            placeholder="Fornavn Etternavn"
            onChange={(e) => {
              setNavn(e.target.value);
              setSkille(null);
              setLikevel(false);
              setFeil(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void lagre(!e.shiftKey);
              } else if (e.key === "Tab") {
                const s = nesteSkille(navn, skille, e.shiftKey);
                if (s === null) return;
                e.preventDefault();
                setSkille(s);
              }
            }}
            className="uten-fokusring min-w-0 flex-1 bg-transparent text-[calc(22px*var(--tekst-skala))] font-light tracking-[-0.01em] text-blekk outline-none placeholder:text-blekk-svakest"
          />
        </div>

        <div className="ml-[62px] mt-2.5 flex min-h-[22px] flex-wrap items-center gap-1.5">
          {fornavn && etternavn ? (
            <>
              <span className="nyelev-del">
                Fornavn <b>{fornavn}</b>
              </span>
              <span className="nyelev-del">
                Etternavn <b>{etternavn}</b>
              </span>
              {nesteSkille(navn, skille) !== null && (
                <span className="text-[11.5px] text-blekk-svak">
                  Tab bytter
                </span>
              )}
            </>
          ) : (
            <span className="text-etikett text-blekk-svak">
              Siste ord blir etternavn. Skriv «van der Berg» og trykk Tab for å
              flytte skillet.
            </span>
          )}
        </div>

        {treff && (
          <div
            className={`ml-[62px] mt-2.5 flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-[calc(12.5px*var(--tekst-skala))] ${
              treff.slag === "finnes"
                ? "bg-kladd text-varsel shadow-[inset_0_0_0_1px_var(--color-kladd-kant)]"
                : "bg-flate text-blekk-dempet"
            }`}
          >
            <span className="min-w-0">
              {treff.slag === "finnes"
                ? `${treff.elev.fornavn} ${treff.elev.etternavn} finnes allerede`
                : `Ligner på ${treff.elev.fornavn} ${treff.elev.etternavn}`}
              {treff.elev.klasse ? ` i ${treff.elev.klasse}` : ""}.
            </span>
            <span className="grow" />
            {treff.slag === "finnes" && !likevel && (
              <button
                onClick={() => {
                  setLikevel(true);
                  felt.current?.focus();
                }}
                title="To elever med samme navn"
                className="shrink-0 hover:underline"
              >
                Ny likevel
              </button>
            )}
            <button
              onClick={() => onApne(treff.elev.id)}
              className="shrink-0 font-semibold hover:underline"
            >
              Åpne
            </button>
          </div>
        )}

        <div className="nyelev-lbl">Klasse</div>
        <div className="flex flex-wrap gap-1.5">
          {klasser.map((k) => (
            <button
              key={k.id}
              aria-pressed={klasse === k.id}
              onClick={() => {
                setKlasse(klasse === k.id ? null : k.id);
                if (klasse === k.id) setKontakt(false);
              }}
              className="nyelev-ch"
            >
              {k.navn}
            </button>
          ))}
          {nyKlasse === null ? (
            <button
              onClick={() => setNyKlasse("")}
              className="nyelev-ch nyelev-ch-ny"
            >
              + Ny klasse
            </button>
          ) : (
            <input
              autoFocus
              value={nyKlasse}
              aria-label="Ny klasse"
              placeholder="Navn"
              onChange={(e) => setNyKlasse(e.target.value)}
              onBlur={() => void lagKlasse()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void lagKlasse();
                } else if (e.key === "Escape") {
                  e.stopPropagation();
                  setNyKlasse(null);
                  felt.current?.focus();
                }
              }}
              className="nyelev-ch w-24 outline-none"
            />
          )}
        </div>

        {fag.length > 0 && (
          <>
            <div className="nyelev-lbl">
              Fag{" "}
              <span className="normal-case tracking-normal">
                · eleven får plass i lista for faget
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {fag.map((f) => {
                const pa = valgteFag.has(f.id);
                return (
                  <button
                    key={f.id}
                    aria-pressed={pa}
                    onClick={() =>
                      setValgteFag((v) => {
                        const n = new Set(v);
                        if (pa) n.delete(f.id);
                        else n.add(f.id);
                        return n;
                      })
                    }
                    className="nyelev-fc"
                    style={
                      {
                        "--f": f.farge ?? "var(--color-aksent)",
                      } as React.CSSProperties
                    }
                  >
                    <i aria-hidden>
                      <svg width="9" height="9" viewBox="0 0 10 10">
                        <path
                          d="M1.5 5.2l2.2 2.2L8.5 2.6"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </i>
                    {f.kode}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-4 flex items-center gap-2.5 border-t border-linje-medium py-3">
          <span className="text-[calc(13.5px*var(--tekst-skala))]">
            Mentorelev
          </span>
          <span className="text-etikett text-blekk-svak">
            {klasse ? "du er mentor" : "velg klasse først"}
          </span>
          <span className="grow" />
          <button
            role="switch"
            aria-checked={kontakt}
            aria-label="Mentorelev"
            disabled={!klasse}
            onClick={() => setKontakt((k) => !k)}
            className="nyelev-bryt"
          />
        </div>

        {laget.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-linje-medium pb-0.5 pt-2.5">
            <div className="text-[11px] uppercase tracking-[0.06em] text-blekk-svak">
              Lagt til nå · {laget.length}
            </div>
            {laget.map((l) => (
              <div key={l.id} className="nyelev-laget">
                <span
                  aria-hidden
                  className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-semibold text-white"
                  style={{ background: sirkelfarge(l.navn) }}
                >
                  {initialer(
                    l.navn.split(" ")[0],
                    l.navn.split(" ").slice(1).join(" "),
                  )}
                </span>
                {l.navn}
                <span className="text-blekk-svak">{l.hvor}</span>
              </div>
            ))}
          </div>
        )}

        {feil && <p className="pb-1 text-etikett text-feil">{feil}</p>}
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 rounded-b-[20px] border-t border-linje-medium bg-flate-svak/70 py-3 pl-[22px] pr-4">
        <span className="flex items-center gap-[5px] text-[11.5px] text-blekk-svak">
          <span className="nyelev-kb">esc</span>lukk
        </span>
        <span className="grow" />
        <button
          disabled={stengt}
          onClick={() => void lagre(false)}
          className="flex h-[34px] items-center gap-2 rounded-full px-3 text-liten text-aksent hover:bg-[color-mix(in_srgb,var(--color-aksent)_8%,transparent)] disabled:opacity-45"
        >
          Lagre og ny<span className="nyelev-kb">⇧↵</span>
        </button>
        <button
          disabled={stengt}
          onClick={() => void lagre(true)}
          className="flex h-[34px] items-center gap-2 rounded-full bg-aksent px-3.5 text-liten font-medium text-ark shadow-[0_6px_16px_color-mix(in_srgb,var(--color-aksent)_30%,transparent)] hover:bg-aksent-mork disabled:opacity-45 disabled:shadow-none"
        >
          Lagre og åpne<span className="nyelev-kb nyelev-kb-m">↵</span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
