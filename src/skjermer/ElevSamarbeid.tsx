import { useEffect, useState } from "react";
import {
  filtrer,
  hentSamarbeid,
  settSammenNeste,
  type Kilde,
  type Samarbeid,
} from "../data/samarbeid";
import { lyttKlassekart } from "../data/endringer";
import { Bryter } from "../ui/felles";

const kortDato = (tid: string) =>
  new Date(tid.replace(" ", "T"))
    .toLocaleDateString("nb-NO", { day: "numeric", month: "numeric" })
    .replace(/\.$/, "");

/**
 * Samarbeid på elevkortet (ARBEIDSLISTE §26, lerretet ElevSamarbeid):
 * eleven i midten, klassekameratene i ring rundt — nærmere midten jo
 * oftere de har vært sammen, tykkere strek jo flere ganger. Per fag.
 * Bare for læreren; regnes fra historikken, ingenting nytt lagres.
 */
export function ElevSamarbeid({
  elevId,
  fornavn,
  skolearId,
}: {
  elevId: string;
  fornavn: string;
  skolearId: string;
}) {
  const [data, setData] = useState<Samarbeid[] | null>(null);
  const [fagNr, setFagNr] = useState(0);
  const [kilde, setKilde] = useState<Kilde>("begge");
  const [valgt, setValgt] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  useEffect(() => {
    const last = () =>
      void hentSamarbeid(elevId, skolearId).then((d) => setData(d));
    last();
    return lyttKlassekart(last);
  }, [elevId, skolearId]);

  if (!data) return null;
  if (data.length === 0)
    return (
      <p className="py-10 text-center text-brod text-blekk-dempet">
        Ingen grupper eller klassekart i fagene til {fornavn} ennå. Samarbeidet
        regnes fra lagrede gruppesett og hvem som har sittet sammen.
      </p>
    );

  const s = data[Math.min(fagNr, data.length - 1)];
  const ganger = new Map(
    s.kamerater.map((k) => [
      k.id,
      filtrer(s.hendelser.get(k.id) ?? [], kilde).length,
    ]),
  );
  const maks = Math.max(1, ...ganger.values());
  const sammen = s.kamerater.filter((k) => (ganger.get(k.id) ?? 0) > 0);
  const aldri = s.kamerater.filter((k) => (ganger.get(k.id) ?? 0) === 0);
  const onsket = s.kart.innstillinger.settSammen?.[elevId] ?? [];

  // Ringen: alle rundt i alfabetisk rekkefølge, så de som har vært sammen,
  // spres; avstanden fra midten viser hvor ofte.
  const rekke = [...s.kamerater].sort((a, b) =>
    a.fornavn.localeCompare(b.fornavn, "nb-NO"),
  );
  const noder = rekke.map((k, i) => {
    const c = ganger.get(k.id) ?? 0;
    const r =
      c === 0 ? 290 : maks === 1 ? 160 : 200 - ((c - 1) / (maks - 1)) * 95;
    const v = (i / rekke.length) * Math.PI * 2 - Math.PI / 2 + 0.17;
    return { ...k, c, x: Math.cos(v) * r, y: Math.sin(v) * r };
  });

  const mest = [...sammen]
    .sort((a, b) => (ganger.get(b.id) ?? 0) - (ganger.get(a.id) ?? 0))
    .slice(0, 6);
  const vK = s.kamerater.find((k) => k.id === valgt);
  const vH = vK ? filtrer(s.hendelser.get(vK.id) ?? [], kilde) : [];
  const hilite = over ?? valgt;

  return (
    <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_300px] gap-6">
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-2.5">
          {data.length > 1 && (
            <Bryter
              storrelse="liten"
              verdi={String(fagNr)}
              settVerdi={(v) => {
                setFagNr(Number(v));
                setValgt(null);
              }}
              valg={data.map((d, i) => ({
                id: String(i),
                navn: d.kart.kildeNavn,
              }))}
            />
          )}
          <Bryter
            storrelse="liten"
            verdi={kilde}
            settVerdi={(v) => setKilde(v as Kilde)}
            valg={[
              { id: "begge", navn: "Begge" },
              { id: "grupper", navn: "Grupper" },
              { id: "sidemann", navn: "Sidemann" },
            ]}
          />
          <span className="text-etikett text-blekk-svak">
            {sammen.length} av {s.kamerater.length} har vært sammen med{" "}
            {fornavn}
          </span>
        </div>
        <svg
          viewBox="-370 -330 740 660"
          className="mx-auto mt-2 w-full max-w-[640px] overflow-visible"
          role="img"
          aria-label={`Hvem ${fornavn} har vært sammen med i ${s.kart.kildeNavn}`}
        >
          {[
            [105, "ofte"],
            [200, "av og til"],
            [290, "aldri"],
          ].map(([r, t]) => (
            <g key={t}>
              <circle
                r={r}
                fill="none"
                stroke="var(--color-linje)"
                strokeDasharray="3 5"
              />
              <text
                x={6}
                y={-(r as number) - 3}
                fontSize={11}
                fill="var(--color-blekk-svak)"
              >
                {t}
              </text>
            </g>
          ))}
          {noder
            .filter((n) => n.c > 0)
            .map((n) => (
              <line
                key={`l-${n.id}`}
                x1={0}
                y1={0}
                x2={n.x}
                y2={n.y}
                stroke="var(--color-aksent)"
                strokeWidth={1 + n.c * 1.2}
                strokeOpacity={
                  hilite && hilite !== n.id ? 0.1 : 0.2 + 0.5 * (n.c / maks)
                }
                strokeLinecap="round"
              />
            ))}
          {noder.map((n) => {
            const pa = hilite === n.id;
            const ute = n.x < -10 ? "end" : n.x > 10 ? "start" : "middle";
            return (
              <g
                key={n.id}
                className="cursor-pointer"
                onClick={() => setValgt(valgt === n.id ? null : n.id)}
                onPointerEnter={() => setOver(n.id)}
                onPointerLeave={() => setOver(null)}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={pa ? 10 : 7}
                  fill={n.c > 0 ? "var(--color-aksent)" : "var(--color-ark)"}
                  fillOpacity={n.c > 0 ? 0.35 + 0.65 * (n.c / maks) : 1}
                  stroke={
                    n.c > 0 ? "var(--color-aksent)" : "var(--color-linje-sterk)"
                  }
                  strokeWidth={pa ? 2.5 : 1.5}
                  strokeDasharray={n.c > 0 ? undefined : "2 2"}
                  style={{ transition: "r 260ms cubic-bezier(.22,1,.36,1)" }}
                />
                <text
                  x={n.x + (ute === "start" ? 13 : ute === "end" ? -13 : 0)}
                  y={n.y + (ute === "middle" ? (n.y < 0 ? -14 : 22) : 4)}
                  textAnchor={ute}
                  fontSize={12.5}
                  fontWeight={pa ? 600 : 400}
                  fill={
                    n.c > 0 ? "var(--color-blekk)" : "var(--color-blekk-svak)"
                  }
                >
                  {n.fornavn}
                </text>
              </g>
            );
          })}
          <circle r={30} fill="var(--color-aksent)" />
          <text
            textAnchor="middle"
            y={5}
            fill="var(--color-ark)"
            fontSize={13}
            fontWeight={600}
          >
            {fornavn}
          </text>
        </svg>
        <p className="mt-auto text-center text-etikett text-blekk-svak">
          Nærmere midten = oftere sammen. Tykkere strek = flere ganger. Klikk en
          elev for detaljer.
        </p>
      </div>

      <div className="flex min-h-0 flex-col gap-5 overflow-auto pb-4">
        <div>
          <h3 className="mb-2 text-[calc(13px*var(--tekst-skala))] font-semibold">
            Har aldri vært sammen med {fornavn} ({aldri.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {aldri.map((k) => (
              <button
                key={k.id}
                onClick={() => setValgt(k.id)}
                className={`rounded-full px-2.5 py-0.5 text-[12.5px] ${
                  valgt === k.id
                    ? "bg-ark shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
                    : "bg-flate-svak hover:bg-flate"
                }`}
              >
                {k.fornavn} {k.etternavn[0]}.
              </button>
            ))}
          </div>
          {aldri.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={() =>
                  void settSammenNeste(
                    s.kart,
                    elevId,
                    onsket.length > 0 ? [] : aldri.map((k) => k.id),
                  )
                }
                className="h-[30px] rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate"
              >
                {onsket.length > 0 ? "Ikke likevel" : "Sett sammen neste gang"}
              </button>
              {onsket.length > 0 && (
                <span className="text-etikett text-god">
                  Brukes neste gang du stokker
                </span>
              )}
            </div>
          )}
          <p className="mt-1.5 text-etikett leading-normal text-blekk-svak">
            Gruppelageren prøver å sette {fornavn} sammen med noen av disse
            neste gang, i {s.kart.kildeNavn}.
          </p>
        </div>

        {vK && (
          <div className="rounded-xl bg-flate-svak px-3.5 py-3 text-[13px]">
            <b className="font-semibold">
              {fornavn} og {vK.fornavn}
            </b>
            <p className="mb-1.5 text-blekk-dempet">
              {vH.length === 0
                ? "Har ikke vært sammen ennå."
                : `${vH.length} ${vH.length === 1 ? "gang" : "ganger"} sammen`}
            </p>
            {vH.map((h, i) => (
              <div key={i} className="flex gap-2 text-blekk-dempet">
                <span className="w-[70px] shrink-0">
                  {h.type === "gruppe" ? "Gruppe" : "Sidemann"}
                </span>
                <span className="truncate">{h.navn ?? "Uten navn"}</span>
                <span className="ml-auto shrink-0 tabular-nums">
                  {kortDato(h.tid)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div>
          <h3 className="mb-2 text-[calc(13px*var(--tekst-skala))] font-semibold">
            Oftest sammen
          </h3>
          {mest.length === 0 && (
            <p className="text-etikett text-blekk-svak">Ingen ennå.</p>
          )}
          {mest.map((k) => {
            const c = ganger.get(k.id) ?? 0;
            return (
              <button
                key={k.id}
                onClick={() => setValgt(k.id)}
                className="flex w-full items-center gap-2 py-1 text-left text-[13px] hover:text-blekk"
              >
                <span className="w-[110px] truncate">
                  {k.fornavn} {k.etternavn[0]}.
                </span>
                <span
                  className="h-1.5 rounded-full bg-aksent/60"
                  style={{ width: `${(c / maks) * 100}px` }}
                />
                <small className="whitespace-nowrap text-blekk-svak">
                  {c} {c === 1 ? "gang" : "ganger"}
                </small>
              </button>
            );
          })}
        </div>
        <p className="text-etikett leading-normal text-blekk-svak">
          Regnes fra lagrede gruppesett og sidemann i klassekartene i{" "}
          {s.kart.kildeNavn}. Bare for deg: kommer aldri med i eksport, utskrift
          eller samtaler.
        </p>
      </div>
    </div>
  );
}
