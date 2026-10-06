import type { ReactNode } from "react";

/**
 * Innhold som foldes ut og inn med en myk, litt sprettende bevegelse — ikke
 * et hopp. Høyden animeres med grid-raden (0fr → 1fr), så innholdet ikke
 * trenger en kjent høyde. Følger Innstillinger › Utseende › Bevegelse:
 * dempet er kortere og uten sprett, av er umiddelbart.
 *
 * Innholdet står i treet også når det er lagt sammen (inert, så Tab
 * hopper over det). Da beholder felt og lister det du har skrevet.
 *
 * `rolig` er undermenyen i sidemenyen (DESIGN.md §6): 260 ms med
 * `--ease-inn`, ingen sprett, og innholdet går fra litt uskarpt til skarpt.
 */
export function Utfold({
  apen,
  variant = "leken",
  children,
}: {
  apen: boolean;
  variant?: "leken" | "rolig";
  children: ReactNode;
}) {
  return (
    <div
      className="utfold"
      data-apen={apen}
      data-variant={variant}
      inert={!apen}
    >
      <div className="utfold-innhold">{children}</div>
    </div>
  );
}
