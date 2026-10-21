import { useEffect, useRef, useState, type ReactNode } from "react";
import { hentInnstilling, settInnstilling } from "../data/skolear";

/** Så mange tastetrykk før stripa tones ned (20.4). */
const TERSKEL = 25;

/**
 * Tastestripa (DESIGN.md §6): der en flate har egne taster, står de i en
 * tonet stripe nederst — små rammer rundt tastene, og hovedknappen helt til
 * høyre. Ikke som en egen tasteoversikt.
 *
 * Med `id` lærer stripa (20.4): når tastene er brukt noen ganger, tones den
 * ned. Den kommer fram igjen så lenge ⌘ holdes, og når musa er over. Antallet
 * huskes per stripe i innstillingene.
 */
export function Tastestripe({
  children,
  klasse = "",
  id,
}: {
  children: ReactNode;
  klasse?: string;
  /** stripa som lærer; uten id står den alltid fullt synlig */
  id?: string;
}) {
  const [brukt, setBrukt] = useState(0);
  const [holder, setHolder] = useState(false);
  const antall = useRef(0);

  useEffect(() => {
    if (!id) return;
    const nokkel = `tastestripe:${id}`;
    let lagre = 0;
    void hentInnstilling(nokkel).then((v) => {
      antall.current = Number(v) || 0;
      setBrukt(antall.current);
    });
    const ned = (e: KeyboardEvent) => {
      if (e.key === "Meta") return setHolder(true);
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (["Shift", "Control", "Alt", "CapsLock"].includes(e.key)) return;
      const mal = e.target as HTMLElement;
      if (mal.closest?.("input, textarea, select, [contenteditable]")) return;
      if (antall.current >= TERSKEL) return;
      antall.current++;
      setBrukt(antall.current);
      window.clearTimeout(lagre);
      lagre = window.setTimeout(
        () => void settInnstilling(nokkel, String(antall.current)),
        800,
      );
    };
    const opp = (e: KeyboardEvent) => {
      if (e.key === "Meta") setHolder(false);
    };
    const bort = () => setHolder(false);
    window.addEventListener("keydown", ned);
    window.addEventListener("keyup", opp);
    window.addEventListener("blur", bort);
    return () => {
      window.removeEventListener("keydown", ned);
      window.removeEventListener("keyup", opp);
      window.removeEventListener("blur", bort);
      window.clearTimeout(lagre);
    };
  }, [id]);

  const tonet = !!id && brukt >= TERSKEL && !holder;
  return (
    <div
      className={`flex items-center justify-end gap-3.5 bg-stripe px-3 py-2 text-[calc(11px*var(--tekst-skala))] text-blekk-dempet transition-opacity duration-300 ${
        tonet ? "opacity-30 hover:opacity-100" : ""
      } ${klasse}`}
    >
      {children}
    </div>
  );
}

/** Én tast, eller flere, med hva de gjør. */
export function Tasthint({
  taster,
  children,
}: {
  taster: string[];
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {taster.map((t) => (
        <kbd
          key={t}
          className="inline-flex items-center rounded-[4px] border border-linje bg-ark px-1.5 font-sans leading-4 text-blekk"
        >
          {t}
        </kbd>
      ))}
      {children}
    </span>
  );
}
