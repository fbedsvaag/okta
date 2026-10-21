import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BILDE_B,
  BILDE_H,
  navnelister,
  tegnGruppebilde,
  type Gruppesett,
  type Navnevalg,
} from "../data/gruppebilde";
import { lagreFil } from "../data/filer";
import { Bryter } from "../ui/felles";
import { useLagretInnstilling } from "../ui/useLagretInnstilling";

/** Elevene i en gruppe slik bildet trenger dem: bare navnet. */
export type Bildegruppe = {
  farge: string;
  elever: { fornavn: string; etternavn: string }[];
};

/** Navnevalget for bilde og Teams; det samme begge steder, og huskes. */
export function useNavnevalg() {
  return useLagretInnstilling<Navnevalg>(
    "gruppe_navnevalg",
    "fe",
    (v) => (v === "fullt" || v === "f" ? v : "fe"),
    String,
  );
}

/** Settet slik bildet og Teams får det: nummer, farge og ferdige navn. */
export function somSett(
  overskrift: string,
  grupper: Bildegruppe[],
  valg: Navnevalg,
  ekstra: { undertittel?: string; dato?: string } = {},
): Gruppesett {
  const navn = navnelister(
    grupper.map((g) =>
      g.elever.map((e) => ({ fornavn: e.fornavn, etternavn: e.etternavn })),
    ),
    valg,
  );
  return {
    overskrift,
    ...ekstra,
    grupper: grupper.map((g, i) => ({
      nr: i + 1,
      farge: g.farge,
      navn: navn[i],
    })),
  };
}

const idag = () =>
  new Date().toLocaleDateString("nb-NO", { day: "numeric", month: "long" });

/**
 * «Bilde til elevene» (25.9, lerretet PlasserGrupper): forhåndsvisning av
 * PNG-en (1920 × 1080), overskrift, navnevalg og dato i hjørnet. Bare
 * gruppene og navnene — aldri innsats, fravær, notater eller hvordan
 * gruppene ble laget.
 */
export function Gruppebilde({
  kode,
  grupper,
  startOverskrift,
  onLagret,
  onLukk,
}: {
  /** «MFL2», til undertittelen og filnavnet */
  kode: string;
  grupper: Bildegruppe[];
  startOverskrift: string;
  /** settet lagres i historikken, som ved Kopier til Teams */
  onLagret?: () => Promise<void> | void;
  onLukk: () => void;
}) {
  const [overskrift, setOverskrift] = useState(startOverskrift);
  const [valg, setValg] = useNavnevalg();
  const [dato, setDato] = useState(true);
  const lerret = useRef<HTMLCanvasElement>(null);

  const sett = somSett(overskrift, grupper, valg, {
    undertittel: `${kode} · ${grupper.length} grupper`,
    dato: dato ? idag() : undefined,
  });

  useEffect(() => {
    const tegn = () => {
      const x = lerret.current?.getContext("2d");
      if (x) tegnGruppebilde(x, sett);
    };
    tegn();
    // Skriften kan komme etter første tegning.
    void document.fonts?.ready.then(tegn);
  });

  async function lagre() {
    const c = lerret.current;
    if (!c) return;
    const blob = await new Promise<Blob | null>((r) =>
      c.toBlob(r, "image/png"),
    );
    if (!blob) return;
    const sti = await lagreFil({
      filnavn: `${kode} ${overskrift.trim() || "Grupper"}.png`,
      filternavn: "PNG",
      endelse: "png",
      innhold: new Uint8Array(await blob.arrayBuffer()),
    });
    if (sti) {
      await onLagret?.();
      onLukk();
    }
  }

  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if (e.key === "Escape") onLukk();
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, [onLukk]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(36,31,51,.32)] p-8"
      onClick={(e) => e.target === e.currentTarget && onLukk()}
    >
      <div className="w-full max-w-[1100px] rounded-2xl bg-ark p-6 shadow-[0_24px_70px_rgba(36,31,51,.3)]">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-[calc(22px*var(--tekst-skala))] font-light tracking-overskrift">
            Bilde til elevene
          </h2>
          <span className="text-etikett text-blekk-svak">
            PNG · 1920 × 1080 · til skjerm, Teams eller utskrift
          </span>
        </div>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_230px] gap-[22px]">
          <canvas
            ref={lerret}
            width={BILDE_B}
            height={BILDE_H}
            className="block aspect-video w-full rounded-[10px] shadow-[0_0_0_1px_var(--color-linje-svak),0_8px_24px_rgba(36,31,51,.10)]"
          />
          <div className="flex flex-col gap-3.5 text-[13px]">
            <label className="flex flex-col gap-1.5">
              <span className="text-etikett font-semibold text-blekk-dempet">
                Overskrift
              </span>
              <input
                value={overskrift}
                onChange={(e) => setOverskrift(e.target.value)}
                placeholder="F.eks. Veggavis"
                className="h-8 rounded-lg border border-linje bg-ark px-2.5 outline-none focus:border-aksent"
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-etikett font-semibold text-blekk-dempet">
                Navn
              </span>
              <Bryter
                storrelse="liten"
                verdi={valg}
                settVerdi={(v) => setValg(v as Navnevalg)}
                valg={[
                  { id: "fullt", navn: "Fullt" },
                  { id: "fe", navn: "Fornavn + E." },
                  { id: "f", navn: "Fornavn" },
                ]}
              />
              <span className="text-etikett text-blekk-svak">
                {valg === "fullt"
                  ? "Aksel Solberg"
                  : valg === "fe"
                    ? "Aksel S."
                    : "Aksel (Aksel S. hvis to heter det)"}
              </span>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={dato}
                onChange={(e) => setDato(e.target.checked)}
                className="h-[15px] w-[15px] accent-[var(--color-aksent)]"
              />
              Dato i hjørnet
            </label>
            <p className="rounded-lg bg-flate-svak px-2.5 py-2 text-etikett leading-normal text-blekk-dempet">
              Bare gruppene og navnene. Aldri innsats, fravær, notater eller
              hvordan gruppene ble laget.
            </p>
            <span className="flex-1" />
            <div className="flex justify-end gap-2">
              <button
                onClick={onLukk}
                className="h-8 rounded-full border border-linje-sterk px-3.5 hover:bg-flate"
              >
                Avbryt
              </button>
              <button
                onClick={() => void lagre()}
                className="h-8 rounded-full bg-aksent px-3.5 font-medium text-ark hover:bg-aksent-mork"
              >
                Lagre bilde …
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
