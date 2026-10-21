import { useEffect, useState } from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  DELER,
  endreKart,
  hentKart,
  hentRom,
  opprettKart,
  plasserIRom,
  slettKart,
  slettRom,
  storrelse,
  type Del,
  type Kart,
  type Kildetype,
  type Rom,
} from "../data/klassekart";
import { hentFagIAr, type FagIAr } from "../data/fag";
import { hentKlasser, type Klasse } from "../data/elever";
import { Bryter, Fagfirkant } from "../ui/felles";
import { KlassekartKart } from "./KlassekartKart";
import { IVerktoylinja } from "../ui/Verktoylinje";
import { KlassekartRom } from "./KlassekartRom";
import { Velger } from "../ui/Velger";
import { romramme } from "../data/karttegning";
import { useLagretInnstilling } from "../ui/useLagretInnstilling";
import { GrupperFane } from "./GrupperFane";

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
  return <Faner skolearId={skolearId} onGa={onGa} />;
}

/**
 * Plasser og grupper (25.1–25.2): fanene Klassekart · Grupper i
 * verktøylinja, i samme rekkefølge som navnet. Fanen huskes.
 */
function Faner({
  skolearId,
  onGa,
}: {
  skolearId: string;
  onGa: (id: string | null) => void;
}) {
  const [fane, setFane] = useLagretInnstilling<"klassekart" | "grupper">(
    "plasser_fane",
    "klassekart",
    (v) => (v === "grupper" ? "grupper" : "klassekart"),
    String,
  );
  return (
    <>
      <IVerktoylinja>
        <Bryter
          storrelse="liten"
          verdi={fane}
          settVerdi={(v) => setFane(v === "grupper" ? "grupper" : "klassekart")}
          valg={[
            { id: "klassekart", navn: "Klassekart" },
            { id: "grupper", navn: "Grupper" },
          ]}
        />
      </IVerktoylinja>
      {fane === "grupper" ? (
        <GrupperFane skolearId={skolearId} />
      ) : (
        <Oversikt skolearId={skolearId} onGa={onGa} />
      )}
    </>
  );
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

      <p className="mb-3.5 mt-0.5 text-liten text-blekk-dempet">
        Dine klassekart
      </p>
      <div className="grid max-w-[900px] grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {kart.map((k) => {
          const r = rom.find((x) => x.id === k.romId);
          return (
            <div
              key={k.id}
              className="group relative flex flex-col gap-2 rounded-[14px] bg-ark p-3.5 shadow-[inset_0_0_0_1px_var(--color-linje-svak)] hover:shadow-[inset_0_0_0_1px_var(--color-linje)]"
            >
              <button
                onClick={() => onGa(k.id)}
                className="absolute inset-0 rounded-[14px]"
                aria-label={`Åpne kartet for ${k.kildeNavn}`}
              />
              <div className="flex items-center gap-2">
                {k.kildeType === "mentorgruppe" ? (
                  <span className="h-2.5 w-2.5 rounded-full bg-aksent" />
                ) : (
                  <Fagfirkant farge={k.farge} storrelse={10} />
                )}
                <b className="font-semibold">{k.kildeNavn}</b>
                <span className="ml-auto text-etikett text-blekk-svak">
                  {k.romNavn ?? "Uten rom"}
                </span>
              </div>
              <Plasskisse deler={r?.deler ?? []} />
              <div className="flex items-center text-etikett text-blekk-dempet">
                <span className="tabular-nums">
                  {k.antall} elever · endret{" "}
                  {new Date(k.endret.replace(" ", "T"))
                    .toLocaleDateString("nb-NO", {
                      day: "numeric",
                      month: "numeric",
                    })
                    .replace(/\.$/, "")}
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
                  className="relative ml-auto text-blekk-svak opacity-0 hover:text-feil group-hover:opacity-100"
                >
                  Slett
                </button>
              </div>
            </div>
          );
        })}
        <button
          onClick={() => onGa("nytt")}
          className="grid min-h-[130px] place-items-center rounded-[14px] text-aksent shadow-[inset_0_0_0_1.5px_var(--color-linje)] hover:bg-flate-svak"
        >
          + Nytt kart
        </button>
      </div>

      <h2 className="mx-0.5 mb-1 mt-7 text-etikett font-semibold text-blekk-dempet">
        Rom
      </h2>
      <p className="mb-3 text-liten text-blekk-dempet">Dine tegnede rom</p>
      <div className="flex flex-wrap gap-2">
        {rom.map((r) => (
          <span
            key={r.id}
            className="group inline-flex h-[30px] items-center gap-1 rounded-full bg-flate-svak pl-3 pr-1.5 text-[13px]"
          >
            <button
              onClick={() => onGa(`rom:${r.id}`)}
              title={
                r.brukesAv === 0
                  ? "Ikke i bruk"
                  : `${r.brukesAv} kart bruker rommet`
              }
              className="hover:underline"
            >
              {r.navn} · {plasserIRom(r.deler).length} plasser
            </button>
            <button
              aria-label={`Slett ${r.navn}`}
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
              className="px-1 text-blekk-svak opacity-0 hover:text-feil group-hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
        <button
          onClick={() => onGa("rom:ny")}
          className="inline-flex h-[30px] items-center rounded-full px-3 text-[13px] text-aksent shadow-[inset_0_0_0_1px_var(--color-linje)] hover:bg-flate-svak"
        >
          + Nytt rom
        </button>
      </div>
    </div>
  );
}

/** Rommet i miniatyr på kartkortet (25.8): pultene, tavla og kateteret. */
function Plasskisse({ deler }: { deler: Del[] }) {
  if (deler.length === 0)
    return (
      <div className="grid h-[86px] place-items-center rounded-lg bg-flate-svak text-etikett text-blekk-svak">
        Ikke tegnet ennå
      </div>
    );
  const r = romramme(deler);
  const m = 20;
  return (
    <svg
      viewBox={`${r.x - m} ${r.y - m} ${r.b + m * 2} ${r.h + m * 2}`}
      className="h-[86px] w-full rounded-lg bg-flate-svak"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {deler.map((d) => {
        const { b, h } = storrelse(d);
        if (DELER[d.type].plasser.length > 0)
          return (
            <rect
              key={d.id}
              x={d.x}
              y={d.y}
              width={b}
              height={h}
              rx={10}
              fill="var(--color-linje)"
            />
          );
        if (d.type === "tavle")
          return (
            <rect
              key={d.id}
              x={d.x}
              y={d.y}
              width={b}
              height={h}
              rx={6}
              fill="var(--color-blekk-svak)"
            />
          );
        if (d.type === "kateter")
          return (
            <rect
              key={d.id}
              x={d.x}
              y={d.y}
              width={b}
              height={h}
              rx={10}
              fill="none"
              stroke="var(--color-linje-sterk)"
              strokeWidth={6}
            />
          );
        return null;
      })}
    </svg>
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

  return (
    <div className="mx-auto w-full max-w-md pt-6">
      <IVerktoylinja>
        <span />
      </IVerktoylinja>
      <h1 className="text-[calc(26px*var(--tekst-skala))] font-light leading-tight tracking-overskrift">
        Nytt kart
      </h1>
      <p className="mb-6 mt-1 text-liten text-blekk-dempet">
        Elevene hentes fra faget, klassen eller mentorgruppa. Ingen lister limes
        inn.
      </p>
      <label className="mb-1.5 block text-liten font-semibold">Elevene</label>
      <Velger
        verdi={kilde}
        settVerdi={setKilde}
        bredde="w-full"
        etikett="Elevene"
        plassholder="Velg …"
        valg={[
          ...fag.map((f) => ({
            verdi: `fag:${f.id}`,
            tekst: `${f.kode} · ${f.navn}`,
            farge: f.farge,
            firkant: true,
            gruppe: "Fag",
          })),
          ...klasser.map((k) => ({
            verdi: `klasse:${k.id}`,
            tekst: k.navn,
            hint: `${k.antall} elever`,
            gruppe: "Klasse",
          })),
          { verdi: "mentorgruppe:", tekst: "Mentorgruppa", gruppe: "Mentor" },
        ]}
      />
      <label className="mb-1.5 mt-4 block text-liten font-semibold">Rom</label>
      <Velger
        verdi={romId}
        settVerdi={setRomId}
        bredde="w-full"
        etikett="Rom"
        valg={[
          ...rom.map((r) => ({
            verdi: r.id,
            tekst: r.navn,
            hint: `${plasserIRom(r.deler).length} plasser`,
          })),
          { verdi: "", tekst: "Ingen ennå, tegn det etterpå", dempet: true },
        ]}
      />
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
