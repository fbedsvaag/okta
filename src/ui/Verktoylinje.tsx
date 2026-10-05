import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Plassen i verktøylinja som skjermen selv fyller (DESIGN.md §6–7).
 *
 * Verktøylinja er en glasskapsel øverst i arket, og den eies av App. En
 * skjerm som har noe der — samtaletrekkeren har trekningens navn og
 * eksporten — legger det inn med `<IVerktoylinja>`, som tegnes inn i
 * kapselen med en portal. Skjermer uten noe å legge der, trenger ingenting.
 */
export const Verktoylinjespor = createContext<HTMLElement | null>(null);

export function IVerktoylinja({ children }: { children: ReactNode }) {
  const spor = useContext(Verktoylinjespor);
  return spor ? createPortal(children, spor) : null;
}
