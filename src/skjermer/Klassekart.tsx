import { useEffect, useState } from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  endreKart,
  hentKart,
  hentRom,
  opprettKart,
  plasserIRom,
  slettKart,
  slettRom,
  type Kart,
  type Kildetype,
  type Rom,
} from "../data/klassekart";
import { hentFagIAr, type FagIAr } from "../data/fag";
import { hentKlasser, type Klasse } from "../data/elever";
import { Fagfirkant } from "../ui/felles";
import { KlassekartKart } from "./KlassekartKart";
import { IVerktoylinja } from "../ui/Verktoylinje";
import { KlassekartRom } from "./KlassekartRom";

/**
 * Klassekart (SPEC §4.11). `id` sier hva som vises:
 * - ingen: oversikten over kart og rom
 * - «nytt»: å lage et kart
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
    // «rom:<id>», «rom:ny», eller «rom:ny:<kart>» — et nytt rom til et kart
    // som ikke har noe, og som skal få det.
    const [, romId, tilKart] = id.split(":");
    return (
      <KlassekartRom
        key={id}
        romId={romId === "ny" ? null : romId}
        skolearId={skolearId}
        onFerdig={async (lagret) => {
          if (lagret && tilKart) await endreKart(tilKart, { romId: lagret });
          onTilbake();
        }}
      />
    );
  }
  if (id === "nytt")
    return (
      <NyttKart
        skolearId={skolearId}
        onLaget={(kartId) => onGa(kartId)}
        onAvbryt={onTilbake}
      />
    );
  if (id)
    return (
      <KlassekartKart
        key={id}
        kartId={id}
        skolearId={skolearId}
        onRedigerRom={(romId) => onGa(romId ? `rom:${romId}` : `rom:ny:${id}`)}
      />
    );
  return <Oversikt skolearId={skolearId} onGa={onGa} />;
}

function Oversikt({
  skolearId,
  onGa,
}: {
  skolearId: string;
  onGa: (id: string | null) => void;
}) {
  const [rom, setRom] = useState<Rom[]>([]);
  const [kart, setKart] = useState<Kart[]>([]);
  const last = () => {
    void hentRom().then(setRom);
    void hentKart(skolearId).then(setKart);
  };
  useEffect(last, [skolearId]);

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
          <button
            onClick={() => onGa("nytt")}
            className="flex h-8 items-center rounded-full bg-aksent px-3.5 text-brod font-medium text-ark hover:bg-aksent-mork"
          >
            Nytt kart
          </button>
        </span>
      </IVerktoylinja>

      <h1 className="text-[calc(26px*var(--tekst-skala))] font-light leading-tight tracking-overskrift">
        Klassekart
      </h1>
      <p className="mb-5 mt-1 text-liten text-blekk-dempet">
        Hvem sitter hvor, og hvem jobber sammen. Rommene tegnes én gang og
        brukes av alle kartene.
      </p>

      <Seksjon tittel="Kart" antall={kart.length}>
        {kart.length === 0 && (
          <p className="py-6 text-center text-brod text-blekk-dempet">
            Ingen kart ennå.{" "}
            <button
              onClick={() => onGa("nytt")}
              className="text-aksent hover:underline"
            >
              Lag det første
            </button>
          </p>
        )}
        {kart.map((k) => (
          <li
            key={k.id}
            className="group grid h-10 grid-cols-[10px_minmax(0,1fr)_9rem_7rem_6rem_3rem] items-center gap-x-3 border-b border-linje-svak text-brod"
          >
            {k.kildeType === "mentorgruppe" ? (
              <span className="h-2.5 w-2.5 rounded-full bg-aksent" />
            ) : (
              <Fagfirkant farge={k.farge} storrelse={10} />
            )}
            <button
              onClick={() => onGa(k.id)}
              className="truncate text-left font-medium hover:underline"
            >
              {k.kildeNavn}
            </button>
            <span className="truncate text-blekk-dempet">
              {k.romNavn ?? "Uten rom"}
            </span>
            <span className="tabular-nums text-blekk-dempet">
              {k.antall} elever
            </span>
            <span className="text-blekk-dempet">
              {k.innstillinger.visning === "grupper" ? "Grupper" : "Plasser"}
            </span>
            <button
              onClick={async () => {
                if (
                  !(await bekreft(
                    `Slette kartet for ${k.kildeNavn}? Historikken over hvem som har sittet sammen, går med.`,
                  ))
                )
                  return;
                await slettKart(k.id);
                last();
              }}
              className="text-liten text-blekk-svak opacity-0 hover:text-feil group-hover:opacity-100"
            >
              Slett
            </button>
          </li>
        ))}
      </Seksjon>

      <div className="mt-6" />
      <Seksjon tittel="Rom" antall={rom.length}>
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
        {rom.map((r) => (
          <li
            key={r.id}
            className="group grid h-10 grid-cols-[10px_minmax(0,1fr)_9rem_7rem_6rem_3rem] items-center gap-x-3 border-b border-linje-svak text-brod"
          >
            <span />
            <button
              onClick={() => onGa(`rom:${r.id}`)}
              className="truncate text-left font-medium hover:underline"
            >
              {r.navn}
            </button>
            <span className="tabular-nums text-blekk-dempet">
              {plasserIRom(r.deler).length} plasser
            </span>
            <span className="text-blekk-dempet">
              {r.brukesAv === 0 ? "Ikke i bruk" : `${r.brukesAv} kart`}
            </span>
            <span />
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
      </Seksjon>
    </div>
  );
}

function Seksjon({
  tittel,
  antall,
  children,
}: {
  tittel: string;
  antall: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="flex items-baseline gap-2 border-b border-linje pb-1.5">
        <span className="text-brod font-semibold">{tittel}</span>
        <span className="text-liten tabular-nums text-blekk-svak">
          {antall}
        </span>
      </h2>
      <ul>{children}</ul>
    </section>
  );
}

/**
 * «+ Nytt kart»: velg kilden — et fag, en klasse eller mentorgruppa — og
 * rommet. Rommet kan også tegnes etterpå.
 */
function NyttKart({
  skolearId,
  onLaget,
  onAvbryt,
}: {
  skolearId: string;
  onLaget: (id: string) => void;
  onAvbryt: () => void;
}) {
  const [fag, setFag] = useState<FagIAr[]>([]);
  const [klasser, setKlasser] = useState<Klasse[]>([]);
  const [rom, setRom] = useState<Rom[]>([]);
  const [kilde, setKilde] = useState("");
  const [romId, setRomId] = useState("");

  useEffect(() => {
    void hentFagIAr(skolearId).then(setFag);
    void hentKlasser(skolearId).then(setKlasser);
    void hentRom().then((r) => {
      setRom(r);
      if (r[0]) setRomId(r[0].id);
    });
  }, [skolearId]);

  async function lag() {
    const [type, id] = kilde.split(":") as [Kildetype, string];
    const kartId = await opprettKart({
      skolearId,
      kildeType: type,
      kildeId: type === "mentorgruppe" ? skolearId : id,
      romId: romId || null,
    });
    onLaget(kartId);
  }

  const felt =
    "h-9 w-full rounded-md border border-linje bg-ark px-2.5 text-brod";
  return (
    <div className="mx-auto w-full max-w-md pt-6">
      <IVerktoylinja>
        <span />
      </IVerktoylinja>
      <h1 className="text-[calc(26px*var(--tekst-skala))] font-light leading-tight tracking-overskrift">
        Nytt kart
      </h1>
      <p className="mb-6 mt-1 text-liten text-blekk-dempet">
        Elevene hentes fra faget, klassen eller mentorgruppa — ingen lister
        limes inn.
      </p>
      <label className="mb-1.5 block text-liten font-semibold">Elevene</label>
      <select
        value={kilde}
        onChange={(e) => setKilde(e.target.value)}
        className={felt}
      >
        <option value="">Velg …</option>
        {fag.length > 0 && (
          <optgroup label="Fag">
            {fag.map((f) => (
              <option key={f.id} value={`fag:${f.id}`}>
                {f.kode} — {f.navn}
              </option>
            ))}
          </optgroup>
        )}
        {klasser.length > 0 && (
          <optgroup label="Klasse">
            {klasser.map((k) => (
              <option key={k.id} value={`klasse:${k.id}`}>
                {k.navn} ({k.antall} elever)
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Mentor">
          <option value="mentorgruppe:">Mentorgruppa</option>
        </optgroup>
      </select>
      <label className="mb-1.5 mt-4 block text-liten font-semibold">Rom</label>
      <select
        value={romId}
        onChange={(e) => setRomId(e.target.value)}
        className={felt}
      >
        {rom.map((r) => (
          <option key={r.id} value={r.id}>
            {r.navn} ({plasserIRom(r.deler).length} plasser)
          </option>
        ))}
        <option value="">Ingen ennå — tegn det etterpå</option>
      </select>
      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={onAvbryt}
          className="flex h-9 items-center rounded-full px-4 text-brod text-blekk-dempet hover:bg-flate"
        >
          Avbryt
        </button>
        <button
          disabled={!kilde}
          onClick={() => void lag()}
          className="flex h-9 items-center rounded-full bg-aksent px-4 text-brod font-medium text-ark hover:bg-aksent-mork disabled:opacity-40"
        >
          Lag kartet
        </button>
      </div>
    </div>
  );
}
