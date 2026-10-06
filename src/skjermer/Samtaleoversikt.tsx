import type { FagIAr } from "../data/fag";
import type { Trekning } from "../data/samtale";
import { fagfarge } from "../ui/farger";
import { IVerktoylinja } from "../ui/Verktoylinje";

/**
 * Samtaler — oversikten (DESIGN.md §6, lerretet A): det et klikk på selve
 * «Samtaler» i sidemenyen gir. Alle trekningene i skoleåret, gruppert:
 *
 * - **Planlagt** — trukket, og har dager som ikke er passert
 * - **Utkast** — satt opp, men ikke trukket ennå
 * - **Gjennomført** — trukket, og alle dagene er passert
 *
 * Et klikk på en rad åpner trekningen.
 */
export function Samtaleoversikt({
  skolearNavn,
  trekninger,
  vurderingsnavn,
  fag,
  onApne,
}: {
  skolearNavn: string;
  trekninger: Trekning[];
  vurderingsnavn: Map<string, string>;
  fag: FagIAr[];
  /** fag-id, «mentor» eller «ny» */
  onApne: (id: string) => void;
}) {
  const idag = isoIDag();
  const grupper: { navn: string; rader: Trekning[] }[] = [
    { navn: "Planlagt", rader: [] },
    { navn: "Utkast", rader: [] },
    { navn: "Gjennomført", rader: [] },
  ];
  for (const t of trekninger) grupper[status(t, idag)].rader.push(t);

  return (
    <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-auto">
      <IVerktoylinja>
        <span className="ml-auto" />
        <button
          onClick={() => onApne("ny")}
          className="flex h-8 items-center rounded-full bg-aksent px-3.5 text-brod font-medium text-ark hover:bg-aksent-mork"
        >
          Ny trekning
        </button>
      </IVerktoylinja>

      <h1 className="text-[calc(26px*var(--tekst-skala))] font-light leading-tight tracking-overskrift">
        Samtaler
      </h1>
      <p className="mb-5 mt-1 text-liten text-blekk-dempet">
        Alle trekningene dine i {skolearNavn}
      </p>

      {trekninger.length === 0 && (
        <div className="border border-dashed border-linje px-4 py-8 text-center text-brod text-blekk-dempet">
          <p>Ingen samtaler er satt opp ennå.</p>
          <button
            onClick={() => onApne("ny")}
            className="mt-3 text-aksent underline-offset-2 hover:underline"
          >
            Sett opp den første trekningen
          </button>
        </div>
      )}

      {grupper
        .filter((g) => g.rader.length > 0)
        .map((g, gi) => (
          <section key={g.navn} className={gi > 0 ? "mt-6" : ""}>
            <h2 className="flex items-baseline gap-2 border-b border-linje pb-1.5">
              <span className="text-brod font-semibold">{g.navn}</span>
              <span className="text-liten tabular-nums text-blekk-svak">
                {g.rader.length}
              </span>
            </h2>
            <ul>
              {g.rader.map((t) => {
                const id = t.skolearFagId ?? "mentor";
                const f = fag.find((x) => x.id === t.skolearFagId);
                const vurdering = t.dager.find(
                  (d) => d.vurderingId,
                )?.vurderingId;
                const navn =
                  t.skolearFagId === null
                    ? "Mentorsamtaler"
                    : ((vurdering && vurderingsnavn.get(vurdering)) ??
                      `Fagsamtale ${t.fagKode ?? ""}`);
                const datoer = datotekst(t);
                const st = status(t, idag);
                return (
                  <li key={id}>
                    <button
                      onClick={() => onApne(id)}
                      className={`grid h-10 w-full grid-cols-[10px_minmax(0,1fr)_3.5rem_10rem_9rem_7rem] items-center gap-x-3 border-b border-linje-svak text-left text-brod tabular-nums hover:bg-flate-svak ${
                        st === 2 ? "opacity-60" : ""
                      }`}
                    >
                      {t.skolearFagId === null ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-aksent" />
                      ) : (
                        <span
                          className="h-2.5 w-2.5 rounded-[2px]"
                          style={{
                            background: f?.farge
                              ? fagfarge(f.farge)
                              : "var(--color-linje-sterk)",
                          }}
                        />
                      )}
                      <span className="truncate font-medium">{navn}</span>
                      <span className="truncate text-blekk-dempet">
                        {t.skolearFagId === null ? "Mentor" : t.fagKode}
                      </span>
                      <span
                        className={`truncate ${datoer ? "" : "text-blekk-svak"}`}
                      >
                        {datoer ?? "Ingen dager valgt"}
                      </span>
                      <span className="truncate">
                        {t.antall > 0 ? `${t.antall} elever` : "Ikke trukket"}
                      </span>
                      <span>
                        <span
                          className={`inline-flex h-5 items-center rounded-full px-2 text-etikett ${
                            st === 0
                              ? "bg-valgt text-aksent"
                              : st === 1
                                ? "bg-flate text-blekk-dempet"
                                : "bg-[color-mix(in_srgb,var(--color-lys-gronn)_14%,var(--color-ark))] text-[color-mix(in_srgb,var(--color-lys-gronn),black_30%)]"
                          }`}
                        >
                          {["Generert", "Utkast", "Ferdig"][st]}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </div>
  );
}

/** 0 = planlagt, 1 = utkast, 2 = gjennomført. */
function status(t: Trekning, idag: string): 0 | 1 | 2 {
  if (t.antall === 0) return 1;
  const datoer = t.dager.map((d) => d.dato).filter(Boolean);
  if (datoer.length > 0 && datoer.every((d) => d < idag)) return 2;
  return 0;
}

/** «15. og 19. okt», «26.–28. okt», «Juni 2026», eller null uten dager. */
function datotekst(t: Trekning): string | null {
  const datoer = [
    ...new Set(t.dager.map((d) => d.dato).filter(Boolean)),
  ].sort();
  if (datoer.length === 0) return null;
  const d = (s: string) => new Date(`${s}T00:00:00`);
  const mnd = (s: string) =>
    d(s).toLocaleDateString("nb-NO", { month: "short" }).replace(/\.$/, "");
  const forste = datoer[0];
  const siste = datoer[datoer.length - 1];
  if (datoer.length === 1) return `${d(forste).getDate()}. ${mnd(forste)}`;
  if (forste.slice(0, 7) !== siste.slice(0, 7))
    return `${d(forste).getDate()}. ${mnd(forste)}–${d(siste).getDate()}. ${mnd(siste)}`;
  if (datoer.length === 2)
    return `${d(forste).getDate()}. og ${d(siste).getDate()}. ${mnd(siste)}`;
  return `${d(forste).getDate()}.–${d(siste).getDate()}. ${mnd(siste)}`;
}

function isoIDag(): string {
  const n = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}
