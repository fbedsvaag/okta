import { invoke } from "@tauri-apps/api/core";

/**
 * Lagrer en eksportfil (issue #1). Rust åpner lagre-dialogen og skriver
 * fila selv, så stien aldri går via webvisningen. Gir stien tilbake, eller
 * null hvis dialogen ble avbrutt.
 */
export async function lagreFil(f: {
  filnavn: string;
  /** navnet på filtypen i dialogen, f.eks. «PNG» */
  filternavn: string;
  /** uten punktum: md, csv, docx, png, okta */
  endelse: string;
  innhold: Uint8Array;
}): Promise<string | null> {
  return invoke<string | null>("lagre_fil", {
    ...f,
    innhold: Array.from(f.innhold),
  });
}

/** Bare filnavnet fra en sti, med / på Mac og \ på Windows. */
export function filnavnAv(sti: string): string {
  return sti.split(/[\\/]/).pop() ?? sti;
}
