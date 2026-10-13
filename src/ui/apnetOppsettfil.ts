import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/**
 * Oppsettfila som er åpnet med dobbeltklikk i Finder (ARBEIDSLISTE 5.13).
 *
 * macOS kan sende fila før vinduet er klart, så Rust holder stien til appen
 * spør (`ta_apnet_oppsettfil`). Kommer det en ny mens appen kjører, sier
 * Rust fra med hendelsen «oppsettfil-apnet», og da spørres det igjen.
 *
 * Gir innholdet i fila, eller en feil, og en måte å glemme den på når den
 * er lest inn.
 */
export function useApnetOppsettfil(): {
  tekst: string | null;
  feil: string | null;
  glem: () => void;
} {
  const [tekst, setTekst] = useState<string | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  useEffect(() => {
    let avbrutt = false;
    const hent = async () => {
      try {
        const sti = await invoke<string | null>("ta_apnet_oppsettfil");
        if (!sti || avbrutt) return;
        setTekst(await invoke<string>("les_oppsettfil", { sti }));
        setFeil(null);
      } catch (e) {
        if (!avbrutt) setFeil(String(e));
      }
    };
    void hent();
    let slutt: (() => void) | null = null;
    // Utenfor Tauri (tester, nettleser) finnes ingen hendelser.
    void listen("oppsettfil-apnet", () => void hent())
      .then((f) => {
        if (avbrutt) f();
        else slutt = f;
      })
      .catch(() => {});
    return () => {
      avbrutt = true;
      slutt?.();
    };
  }, []);

  return {
    tekst,
    feil,
    glem: () => {
      setTekst(null);
      setFeil(null);
    },
  };
}
