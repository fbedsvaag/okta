import { useEffect, useState } from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import { hentRom, plasserIRom, slettRom, type Rom } from "../data/klassekart";
import { IVerktoylinja } from "../ui/Verktoylinje";
import { KlassekartRom } from "./KlassekartRom";

/**
 * Klassekart (SPEC §4.11). `id` sier hva som vises:
 * - ingen: oversikten over kart og rom
 * - «rom:ny» eller «rom:<id>»: rom-editoren
 * - ellers: kartet med den id-en
 */
export function Klassekart({
  skolearId,
  id,
  onGa,
  onTilbake,
}: {
  skolearId: string;
  id: string | null;
  onGa: (id: string | null) => void;
  onTilbake: () => void;
}) {
  if (id?.startsWith("rom:")) {
    const romId = id.slice(4);
    return (
      <KlassekartRom
        key={id}
        romId={romId === "ny" ? null : romId}
        skolearId={skolearId}
        onFerdig={() => onTilbake()}
      />
    );
  }
  return <Oversikt skolearId={skolearId} onGa={onGa} />;
}

function Oversikt({
  onGa,
}: {
  skolearId: string;
  onGa: (id: string | null) => void;
}) {
  const [rom, setRom] = useState<Rom[]>([]);
  const last = () => void hentRom().then(setRom);
  useEffect(last, []);

  return (
    <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-auto">
      <IVerktoylinja>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => onGa("rom:ny")}
            className="flex h-8 items-center rounded-full border border-linje-sterk bg-ark/70 px-3.5 text-brod hover:bg-ark"
          >
            Nytt rom
          </button>
        </span>
      </IVerktoylinja>

      <h1 className="text-[calc(26px*var(--tekst-skala))] font-light leading-tight tracking-overskrift">
        Klassekart
      </h1>
      <p className="mb-5 mt-1 text-liten text-blekk-dempet">
        Rommene tegnes én gang og brukes av alle kartene.
      </p>

      <section>
        <h2 className="flex items-baseline gap-2 border-b border-linje pb-1.5">
          <span className="text-brod font-semibold">Rom</span>
          <span className="text-liten tabular-nums text-blekk-svak">
            {rom.length}
          </span>
        </h2>
        {rom.length === 0 && (
          <p className="py-6 text-center text-brod text-blekk-dempet">
            Ingen rom ennå.{" "}
            <button
              onClick={() => onGa("rom:ny")}
              className="text-aksent hover:underline"
            >
              Tegn det første
            </button>
          </p>
        )}
        <ul>
          {rom.map((r) => (
            <li
              key={r.id}
              className="group flex h-10 items-center gap-3 border-b border-linje-svak text-brod"
            >
              <button
                onClick={() => onGa(`rom:${r.id}`)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left hover:underline"
              >
                <span className="truncate font-medium">{r.navn}</span>
              </button>
              <span className="w-24 text-blekk-dempet tabular-nums">
                {plasserIRom(r.deler).length} plasser
              </span>
              <span className="w-28 text-blekk-dempet">
                {r.brukesAv === 0
                  ? "Ikke i bruk"
                  : `${r.brukesAv} ${r.brukesAv === 1 ? "kart" : "kart"}`}
              </span>
              <button
                onClick={async () => {
                  if (
                    !(await bekreft(
                      r.brukesAv > 0
                        ? `Slette ${r.navn}? ${r.brukesAv} kart bruker rommet. De beholder elevene og historikken, men mister rommet.`
                        : `Slette ${r.navn}?`,
                    ))
                  )
                    return;
                  await slettRom(r.id);
                  last();
                }}
                className="text-liten text-blekk-svak opacity-0 hover:text-feil group-hover:opacity-100"
              >
                Slett
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
