import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useInngang } from "./bevegelse";

/**
 * Nedtrekksmenyen (ARBEIDSLISTE 15.9, lerretet Nedtrekk). Erstatter alle
 * <select> i appen: systemets egen meny så annerledes ut på Mac og Windows,
 * og kunne verken vise farge, hint eller grupper slik resten av appen gjør.
 *
 * Feltet er en knapp; menyen er glass som kontekstmenyene, med de samme
 * radene og markøren som glir. Tastaturet virker som i en vanlig liste:
 * ↓, ↵ eller mellomrom åpner, ↑↓ flytter, ↵ velger, esc lukker, og en
 * bokstav hopper. Over åtte valg får menyen et søkefelt.
 */

export type Valg = {
  verdi: string;
  tekst: string;
  /** til høyre, dempet: «uke 34–46», «12.11» */
  hint?: string;
  /** en prikk i fargen foran teksten (perioder), eller en firkant (fag) */
  farge?: string | null;
  firkant?: boolean;
  ikon?: ReactNode;
  /** «Ingen …»: står først, dempet */
  dempet?: boolean;
  /** overskriften for gruppa valget hører til */
  gruppe?: string;
};

/** Over så mange valg får menyen et søkefelt. */
const SOK_FRA = 8;
/** Avstanden mellom feltet og menyen, og til vinduskanten. */
const LUFT = 6;
const KANT = 8;

export function Velger({
  verdi,
  settVerdi,
  valg,
  plassholder = "Velg …",
  bredde = "",
  variant = "vanlig",
  deaktivert,
  handling,
  etikett,
  tittel,
  startApen,
  onLukk,
}: {
  verdi: string;
  settVerdi: (v: string) => void;
  valg: Valg[];
  /** det som står i feltet når ingen valg passer verdien */
  plassholder?: string;
  /** klasser for bredden på feltet, f.eks. «w-full» */
  bredde?: string;
  /** liten: 26 px, i tabeller og lister. stille: uten ramme. */
  variant?: "vanlig" | "liten" | "stille";
  deaktivert?: boolean;
  /** en handling nederst i aksent, f.eks. «+ Ny periode …» */
  handling?: { tekst: string; onKlikk: () => void };
  /** aria-label, når det ikke står en etikett ved feltet */
  etikett?: string;
  tittel?: string;
  /** åpen fra start, f.eks. når feltet dukker opp etter et klikk */
  startApen?: boolean;
  /** kalles når menyen lukkes, valgt eller ikke */
  onLukk?: () => void;
}) {
  const [apen, setApen] = useState(false);
  const felt = useRef<HTMLButtonElement>(null);
  const valgt = valg.find((v) => v.verdi === verdi);

  function lukk(fokus = true) {
    setApen(false);
    if (fokus) felt.current?.focus();
    onLukk?.();
  }

  // Menyen trenger feltet for å vite hvor den skal stå, så den åpnes
  // først når feltet finnes.
  useLayoutEffect(() => {
    if (!startApen) return;
    felt.current?.focus();
    setApen(true);
  }, []);

  const id = useId();

  return (
    <>
      <button
        ref={felt}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={apen}
        aria-controls={apen ? `${id}-liste` : undefined}
        aria-label={etikett}
        title={tittel}
        disabled={deaktivert}
        onMouseDown={(e) => {
          // Musa åpner på mousedown, som systemets meny; et nytt trykk
          // lukker. Fokus blir på feltet.
          if (e.button !== 0 || deaktivert) return;
          e.preventDefault();
          felt.current?.focus();
          if (apen) lukk();
          else setApen(true);
        }}
        onClick={(e) => {
          // En etikett rundt feltet, eller hjelpemidler, klikker uten mus.
          if (e.detail === 0 && !apen) setApen(true);
        }}
        onKeyDown={(e) => {
          if (apen) return;
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
            e.preventDefault();
            setApen(true);
          }
        }}
        className={`velger ${variant === "vanlig" ? "" : variant} ${bredde}`}
      >
        {valgt && <Merke valg={valgt} />}
        <span
          className={`min-w-0 flex-1 truncate ${valgt && !valgt.dempet ? "" : "text-blekk-dempet"}`}
        >
          {valgt ? valgt.tekst : plassholder}
        </span>
        <span className="velger-pil" aria-hidden>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M2 3.6l3 3 3-3"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {apen && felt.current && (
        <Meny
          id={id}
          felt={felt.current}
          valg={valg}
          verdi={verdi}
          handling={handling}
          onVelg={(v) => {
            lukk();
            if (v !== verdi) settVerdi(v);
          }}
          onHandling={() => {
            lukk(false);
            handling?.onKlikk();
          }}
          onLukk={lukk}
        />
      )}
    </>
  );
}

/** Prikken, firkanten eller ikonet foran teksten, i feltet og i menyen. */
function Merke({ valg }: { valg: Valg }) {
  if (valg.ikon)
    return <span className="inline-flex flex-none">{valg.ikon}</span>;
  if (!valg.farge) return null;
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 flex-none ${valg.firkant ? "rounded-[2px]" : "rounded-full"}`}
      style={{ background: valg.farge }}
    />
  );
}

type Rad =
  | { type: "valg"; valg: Valg; nr: number }
  | { type: "gruppe"; tekst: string }
  | { type: "skille" };

/** Valgene som rader, med gruppeoverskrifter og skiller imellom. */
export function rader(valg: Valg[]): Rad[] {
  const ut: Rad[] = [];
  let forrige: string | undefined;
  valg.forEach((v, nr) => {
    if (nr > 0 && v.gruppe !== forrige) {
      if (v.gruppe) ut.push({ type: "gruppe", tekst: v.gruppe });
      else ut.push({ type: "skille" });
    } else if (nr === 0 && v.gruppe) {
      ut.push({ type: "gruppe", tekst: v.gruppe });
    }
    forrige = v.gruppe;
    ut.push({ type: "valg", valg: v, nr });
  });
  return ut;
}

/** Valgene som passer søket: i teksten, hintet eller gruppenavnet. */
export function sok(valg: Valg[], tekst: string): Valg[] {
  const s = tekst.trim().toLowerCase();
  if (!s) return valg;
  return valg.filter((v) =>
    [v.tekst, v.hint, v.gruppe].some((x) => x?.toLowerCase().includes(s)),
  );
}

/** Neste valg som begynner på bokstaven, etter det som er markert. */
export function hopp(valg: Valg[], fra: number, bokstav: string): number {
  const b = bokstav.toLowerCase();
  for (let i = 1; i <= valg.length; i++) {
    const j = (fra + i) % valg.length;
    if (valg[j].tekst.toLowerCase().startsWith(b)) return j;
  }
  return fra;
}

function Meny({
  id,
  felt,
  valg,
  verdi,
  handling,
  onVelg,
  onHandling,
  onLukk,
}: {
  id: string;
  felt: HTMLElement;
  valg: Valg[];
  verdi: string;
  handling?: { tekst: string };
  onVelg: (verdi: string) => void;
  onHandling: () => void;
  /** fokus: tilbake til feltet (esc, valg), ikke ved klikk utenfor */
  onLukk: (fokus?: boolean) => void;
}) {
  const meny = useRef<HTMLDivElement>(null);
  const liste = useRef<HTMLDivElement>(null);
  const inne = useInngang();
  const medSok = valg.length > SOK_FRA;
  const [soketekst, setSoketekst] = useState("");
  const synlige = useMemo(() => sok(valg, soketekst), [valg, soketekst]);
  const radliste = useMemo(() => rader(synlige), [synlige]);
  // Handlingen nederst kan også nås med piltastene, som siste rad.
  const antall = synlige.length + (handling ? 1 : 0);
  const [aktiv, setAktiv] = useState(() =>
    Math.max(
      synlige.findIndex((v) => v.verdi === verdi),
      0,
    ),
  );
  const forsteSok = useRef(true);
  useEffect(() => {
    if (forsteSok.current) forsteSok.current = false;
    else setAktiv(0);
  }, [soketekst]);

  // Plassen: under feltet, eller over når det ikke er plass under.
  const [plass, setPlass] = useState<{
    venstre: number;
    topp: number;
    bredde: number;
    hoyde: number;
    opp: boolean;
  } | null>(null);
  useLayoutEffect(() => {
    const el = meny.current;
    if (!el) return;
    const r = felt.getBoundingClientRect();
    const naturlig = el.scrollHeight;
    const under = window.innerHeight - r.bottom - LUFT - KANT;
    const over = r.top - LUFT - KANT;
    const opp = naturlig > under && over > under;
    const hoyde = Math.min(naturlig, opp ? over : under, 420);
    const bredde = Math.max(r.width, el.offsetWidth);
    setPlass({
      venstre: Math.max(
        KANT,
        Math.min(r.left, window.innerWidth - bredde - KANT),
      ),
      topp: opp ? r.top - LUFT - hoyde : r.bottom + LUFT,
      bredde: r.width,
      hoyde,
      opp,
    });
  }, [felt]);

  // Lukkes av et trykk utenfor, rulling utenfor menyen og et smalere vindu.
  useEffect(() => {
    const utenfor = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!meny.current?.contains(t) && !felt.contains(t)) onLukk(false);
    };
    const rull = (e: Event) => {
      if (!meny.current?.contains(e.target as Node)) onLukk(false);
    };
    const vindu = () => onLukk(false);
    window.addEventListener("mousedown", utenfor);
    window.addEventListener("scroll", rull, true);
    window.addEventListener("resize", vindu);
    window.addEventListener("blur", vindu);
    return () => {
      window.removeEventListener("mousedown", utenfor);
      window.removeEventListener("scroll", rull, true);
      window.removeEventListener("resize", vindu);
      window.removeEventListener("blur", vindu);
    };
  }, [felt, onLukk]);

  // Tastene, på feltet eller i søkefeltet. Fanges før appens egne
  // snarveier, så esc lukker menyen og ikke arket under.
  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      const stopp = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === "Escape") {
        stopp();
        onLukk();
      } else if (e.key === "Tab") {
        onLukk(false);
      } else if (e.key === "ArrowDown") {
        stopp();
        setAktiv((a) => Math.min(a + 1, antall - 1));
      } else if (e.key === "ArrowUp") {
        stopp();
        setAktiv((a) => Math.max(a - 1, 0));
      } else if (e.key === "Home" || e.key === "End") {
        stopp();
        setAktiv(e.key === "Home" ? 0 : antall - 1);
      } else if (e.key === "Enter" || (e.key === " " && !medSok)) {
        stopp();
        if (aktiv < synlige.length) onVelg(synlige[aktiv].verdi);
        else if (handling) onHandling();
      } else if (
        !medSok &&
        e.key.length === 1 &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        stopp();
        setAktiv((a) => hopp(synlige, Math.min(a, synlige.length - 1), e.key));
      }
    };
    window.addEventListener("keydown", tast, true);
    return () => window.removeEventListener("keydown", tast, true);
  }, [aktiv, antall, synlige, medSok, handling, onVelg, onHandling, onLukk]);

  // Markøren glir til raden som er markert, med mus eller piltaster.
  const [markor, setMarkor] = useState<{ y: number; h: number } | null>(null);
  const [glir, setGlir] = useState(false);
  useLayoutEffect(() => {
    const el = meny.current?.querySelector<HTMLElement>(`[data-nr="${aktiv}"]`);
    if (!el) {
      setMarkor(null);
      return;
    }
    setMarkor({ y: el.offsetTop, h: el.offsetHeight });
    el.scrollIntoView({ block: "nearest" });
  }, [aktiv, radliste, plass]);
  useEffect(() => {
    if (!markor || glir) return;
    const r = requestAnimationFrame(() =>
      requestAnimationFrame(() => setGlir(true)),
    );
    return () => cancelAnimationFrame(r);
  }, [markor, glir]);

  const radId = (nr: number) => `${id}-${nr}`;
  // Fokus står i feltet, eller i søkefeltet når det finnes. Den som har
  // fokus, sier hvilken rad som er markert.
  useEffect(() => {
    if (medSok) return;
    felt.setAttribute("aria-activedescendant", radId(aktiv));
    return () => felt.removeAttribute("aria-activedescendant");
  }, [felt, aktiv, medSok]);

  return createPortal(
    <div
      ref={meny}
      data-inngang="meny"
      data-inne={inne && plass !== null}
      data-opp={plass?.opp ?? false}
      onMouseDown={(e) => {
        // Fokus blir i feltet (eller søkefeltet) når man klikker en rad.
        if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault();
      }}
      style={{
        left: plass?.venstre ?? -9999,
        top: plass?.topp ?? 0,
        minWidth: plass?.bredde,
        maxHeight: plass?.hoyde,
        visibility: plass ? undefined : "hidden",
      }}
      className="glass-meny fixed z-[60] flex flex-col rounded-[14px] p-[5px]"
    >
      {medSok && (
        <label className="menysok">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <circle
              cx="5"
              cy="5"
              r="3.6"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
            />
            <path
              d="M7.8 7.8L10.5 10.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <input
            autoFocus
            value={soketekst}
            onChange={(e) => setSoketekst(e.target.value)}
            placeholder="Søk …"
            aria-controls={`${id}-liste`}
            aria-activedescendant={radId(aktiv)}
            className="min-w-0 flex-1 bg-transparent text-blekk outline-none placeholder:text-blekk-svak"
          />
        </label>
      )}
      <div
        ref={liste}
        id={`${id}-liste`}
        role="listbox"
        className="relative min-h-0 overflow-y-auto"
      >
        {markor && (
          <span
            aria-hidden
            className="hovermarkor markor-meny pointer-events-none absolute left-0 right-0 top-0"
            data-glir={glir}
            data-synlig="true"
            style={{
              height: markor.h,
              transform: `translateY(${markor.y}px)`,
            }}
          />
        )}
        {radliste.map((r, i) =>
          r.type === "gruppe" ? (
            <div key={`g${i}`} className="menygruppe">
              {r.tekst}
            </div>
          ) : r.type === "skille" ? (
            <div key={`s${i}`} className="menyskille" />
          ) : (
            <div
              key={`v${r.nr}`}
              id={radId(r.nr)}
              data-nr={r.nr}
              role="option"
              aria-selected={r.valg.verdi === verdi}
              onPointerMove={() => aktiv !== r.nr && setAktiv(r.nr)}
              onClick={() => onVelg(r.valg.verdi)}
              className={`menyrad ${r.valg.dempet ? "text-blekk-dempet" : "text-blekk"} ${
                r.valg.verdi === verdi ? "font-medium" : ""
              }`}
            >
              <span className="menyrad-hake">
                {r.valg.verdi === verdi && (
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                    <path
                      d="M2.2 6.3l2.5 2.5L9.8 3.4"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <Merke valg={r.valg} />
              <span className="min-w-0 truncate">{r.valg.tekst}</span>
              {r.valg.hint && (
                <span className="menyrad-hint">{r.valg.hint}</span>
              )}
            </div>
          ),
        )}
        {synlige.length === 0 && (
          <div className="menyrad text-blekk-svak">Ingen treff</div>
        )}
        {handling && (
          <>
            <div className="menyskille" />
            <div
              id={radId(synlige.length)}
              data-nr={synlige.length}
              role="option"
              aria-selected={false}
              onPointerMove={() =>
                aktiv !== synlige.length && setAktiv(synlige.length)
              }
              onClick={onHandling}
              className="menyrad text-aksent"
            >
              {handling.tekst}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
