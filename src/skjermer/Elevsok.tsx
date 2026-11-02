import { useEffect, useState } from "react";
import { hentElevvalg, hentKlasser, opprettElevMed } from "../data/elever";
import { delNavn } from "../import/parser";
import { Velger } from "../ui/Velger";

type Elevvalg = Awaited<ReturnType<typeof hentElevvalg>>[number];

/**
 * Elevsøket i «Trives med» (31.2): alle elevene, på tvers av klasser og fag,
 * med klassen ved navnet. Finnes ikke eleven, lages den rett her: «+ Ny elev
 * «Navn»», med klasse om du vil. Brukes på elevkortet og i mentorsamtalen.
 */
export function Elevsok({
  skolearId,
  utenom,
  onVelg,
  tekst = "+ Legg til",
  startApen = false,
  onLukk,
}: {
  skolearId: string;
  /** elever som ikke skal kunne velges (eleven selv, de som alt er valgt) */
  utenom: Set<string>;
  onVelg: (elevId: string) => void | Promise<void>;
  tekst?: string;
  startApen?: boolean;
  onLukk?: () => void;
}) {
  const [sok, setSok] = useState<string | null>(startApen ? "" : null);
  const [alle, setAlle] = useState<Elevvalg[]>([]);
  // Ny elev: navnet som ble skrevet, og klassen (valgfri).
  const [ny, setNy] = useState<{ navn: string; klasseId: string } | null>(null);
  const [klasser, setKlasser] = useState<{ id: string; navn: string }[]>([]);
  useEffect(() => {
    if (sok === null && !ny) return;
    void hentElevvalg(skolearId).then(setAlle);
  }, [skolearId, sok === null, ny === null]);
  useEffect(() => {
    if (ny) void hentKlasser(skolearId).then(setKlasser);
  }, [ny === null, skolearId]);

  const lukk = () => {
    setSok(null);
    setNy(null);
    onLukk?.();
  };

  async function lag() {
    if (!ny) return;
    const { fornavn, etternavn } = delNavn(ny.navn);
    if (!fornavn) return;
    const id = await opprettElevMed({
      fornavn,
      etternavn,
      skolearId,
      klasseId: ny.klasseId || null,
      fagIder: [],
      mentor: false,
    });
    await onVelg(id);
    lukk();
  }

  if (ny)
    return (
      <div className="w-full rounded-lg bg-ark p-2 shadow-[0_0_0_1px_var(--color-linje)]">
        <p className="mb-1.5 text-[13px]">
          Ny elev: <b className="font-semibold">{ny.navn}</b>
        </p>
        <div className="flex items-center gap-1.5">
          <Velger
            verdi={ny.klasseId}
            settVerdi={(klasseId) => setNy({ ...ny, klasseId })}
            variant="liten"
            bredde="min-w-0 flex-1"
            etikett="Klasse"
            valg={[
              { verdi: "", tekst: "Ingen klasse", dempet: true },
              ...klasser.map((k) => ({ verdi: k.id, tekst: k.navn })),
            ]}
          />
          <button
            onClick={lukk}
            className="h-7 rounded-full px-2.5 text-liten text-blekk-dempet hover:bg-flate"
          >
            Avbryt
          </button>
          <button
            autoFocus
            onClick={() => void lag()}
            className="h-7 rounded-full bg-aksent px-3 text-liten font-medium text-ark hover:bg-aksent-mork"
          >
            Lag ↵
          </button>
        </div>
        <p className="mt-1.5 text-etikett text-blekk-svak">
          Fag og resten setter du på elevkortet senere.
        </p>
      </div>
    );

  if (sok === null)
    return (
      <button
        onClick={() => setSok("")}
        className="rounded-full px-2.5 py-0.5 text-[12.5px] text-aksent shadow-[inset_0_0_0_1px_var(--color-linje)] hover:bg-flate-svak"
      >
        {tekst}
      </button>
    );

  const q = sok.trim().toLocaleLowerCase("nb-NO");
  const treff = alle
    .filter((k) => !utenom.has(k.id))
    .filter((k) =>
      `${k.fornavn} ${k.etternavn}`.toLocaleLowerCase("nb-NO").includes(q),
    )
    .slice(0, 6);
  const eksakt = alle.some(
    (k) => `${k.fornavn} ${k.etternavn}`.toLocaleLowerCase("nb-NO") === q,
  );
  const kanLage = sok.trim().length >= 2 && !eksakt;

  return (
    <div className="w-full">
      <input
        autoFocus
        value={sok}
        onChange={(e) => setSok(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") lukk();
          if (e.key === "Enter") {
            if (treff[0]) {
              void onVelg(treff[0].id);
              lukk();
            } else if (kanLage) setNy({ navn: sok.trim(), klasseId: "" });
          }
        }}
        onBlur={() =>
          window.setTimeout(() => setSok((s) => (ny ? s : null)), 150)
        }
        placeholder="Skriv et navn …"
        className="h-[28px] w-full rounded-lg border border-linje bg-ark px-2 text-[13px] outline-none focus:border-aksent"
      />
      {q && (
        <div className="mt-1 flex flex-col rounded-lg bg-ark p-1 shadow-[0_0_0_1px_var(--color-linje)]">
          {treff.map((k) => (
            <button
              key={k.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                void onVelg(k.id);
                lukk();
              }}
              className="flex items-baseline gap-2 rounded px-2 py-1 text-left text-[13px] hover:bg-flate"
            >
              <span className="truncate">
                {k.fornavn} {k.etternavn}
              </span>
              <span className="ml-auto shrink-0 text-etikett text-blekk-svak">
                {k.klasse ?? "uten klasse"}
              </span>
            </button>
          ))}
          {kanLage && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setNy({ navn: sok.trim(), klasseId: "" })}
              className={`rounded px-2 py-1 text-left text-[13px] text-aksent hover:bg-flate ${
                treff.length ? "mt-0.5 border-t border-linje-svak pt-1.5" : ""
              }`}
            >
              + Ny elev «{sok.trim()}»
            </button>
          )}
          {!treff.length && !kanLage && (
            <span className="px-2 py-1 text-etikett text-blekk-svak">
              Ingen treff
            </span>
          )}
        </div>
      )}
    </div>
  );
}
