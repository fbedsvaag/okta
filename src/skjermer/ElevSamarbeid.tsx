import { useEffect, useState } from "react";
import {
  filtrer,
  hentSamarbeid,
  settSammenNeste,
  type Kilde,
  type Samarbeid,
} from "../data/samarbeid";
import { lyttElever, lyttKlassekart } from "../data/endringer";
import { Bryter } from "../ui/felles";
import { hentAlleElever } from "../data/elever";
import {
  fjernAvtale,
  fjernOnske,
  gjensidig,
  hentAvtaler,
  hentOnsker,
  leggTilAvtale,
  leggTilOnske,
  type Avtale,
  type Gjelder,
  type Onske,
} from "../data/onsker";
import { ONSKER_VED_STOKK } from "./Avtaler";
import { useLagretInnstilling } from "../ui/useLagretInnstilling";

/** Ønsker i ringen og på chipene: grønnblå, som i lerretet. */
const ONSKEFARGE = "#2f9a8a";
type Navn = { id: string; fornavn: string; etternavn: string };
const kort = (k: Navn) =>
  `${k.fornavn} ${k.etternavn ? `${k.etternavn[0]}.` : ""}`.trim();
const KILDENAVN: Record<string, string> = {
  samtale: "Samtale",
  eleven: "Eleven",
  selv: "Sett selv",
  jeg: "Jeg",
};

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
  const [onsker, setOnsker] = useState<Onske[]>([]);
  const [avtaler, setAvtaler] = useState<Avtale[]>([]);
  const [alle, setAlle] = useState<Navn[]>([]);

  useEffect(() => {
    const last = () => {
      void hentSamarbeid(elevId, skolearId).then((d) => setData(d));
      void hentOnsker().then(setOnsker);
      void hentAvtaler().then(setAvtaler);
      void hentAlleElever().then(setAlle);
    };
    last();
    const a = lyttKlassekart(last);
    const b = lyttElever(last);
    return () => {
      a();
      b();
    };
  }, [elevId, skolearId]);

  if (!data) return null;
  const onskebokser = (
    <Onskebokser
      elevId={elevId}
      fornavn={fornavn}
      onsker={onsker}
      alle={alle}
    />
  );
  if (data.length === 0)
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-6">
        <p className="py-10 text-center text-brod text-blekk-dempet">
          Ingen grupper eller klassekart i fagene til {fornavn} ennå.
          Samarbeidet regnes fra lagrede gruppesett og hvem som har sittet
          sammen.
        </p>
        <div className="flex flex-col gap-5">{onskebokser}</div>
      </div>
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
  // Hvem eleven vil sitte med (★), og avtalene i dette faget (📌).
  const vil = new Set(
    onsker.filter((o) => o.elevId === elevId).map((o) => o.onskerElevId),
  );
  const fagId = s.kart.kildeType === "fag" ? s.kart.kildeId : null;
  const mineAvtaler = fagId
    ? avtaler.filter(
        (a) =>
          a.skolearFagId === fagId &&
          (a.elevId === elevId || a.medElevId === elevId),
      )
    : [];
  const avtaleMed = new Set(
    mineAvtaler.map((a) => (a.elevId === elevId ? a.medElevId : a.elevId)),
  );

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
                {vil.has(n.id) && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={pa ? 13 : 10.5}
                    fill="none"
                    stroke={ONSKEFARGE}
                    strokeWidth={2}
                  />
                )}
                <text
                  x={n.x + (ute === "start" ? 15 : ute === "end" ? -15 : 0)}
                  y={n.y + (ute === "middle" ? (n.y < 0 ? -15 : 24) : 4)}
                  textAnchor={ute}
                  fontSize={12.5}
                  fontWeight={pa || vil.has(n.id) ? 600 : 400}
                  fill={
                    vil.has(n.id)
                      ? ONSKEFARGE
                      : n.c > 0
                        ? "var(--color-blekk)"
                        : "var(--color-blekk-svak)"
                  }
                >
                  {vil.has(n.id) ? "★ " : ""}
                  {n.fornavn}
                  {avtaleMed.has(n.id) ? " 📌" : ""}
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
        {onskebokser}
        {fagId && (
          <Avtaleboks
            elevId={elevId}
            fornavn={fornavn}
            fagId={fagId}
            fagNavn={s.kart.kildeNavn}
            avtaler={mineAvtaler}
            kamerater={s.kamerater}
          />
        )}
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
            <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={onsket.length > 0}
                onChange={(e) =>
                  void settSammenNeste(
                    s.kart,
                    elevId,
                    e.target.checked ? aldri.map((k) => k.id) : [],
                  )
                }
                className="h-[15px] w-[15px] accent-[var(--color-aksent)]"
              />
              Prøv å sette sammen med en av disse
            </label>
          )}
          <p className="mt-1.5 text-etikett leading-normal text-blekk-svak">
            Neste gang du stokker i {s.kart.kildeNavn}. Et ønske, ikke en regel.
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
            {fagId && !avtaleMed.has(vK.id) && (
              <button
                onClick={() =>
                  void leggTilAvtale({
                    elevId,
                    medElevId: vK.id,
                    skolearFagId: fagId,
                    gjelder: "begge",
                    kilde: "jeg",
                  })
                }
                className="mb-2 h-[28px] rounded-full border border-linje-sterk bg-ark px-3 text-[12.5px] hover:bg-flate"
              >
                📌 Sitt sammen neste gang
              </button>
            )}
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

/** Navnesøk: skriv, velg i lista (26.7). */
function Navnesok({
  kandidater,
  onVelg,
  tekst,
}: {
  kandidater: Navn[];
  onVelg: (id: string) => void;
  tekst: string;
}) {
  const [sok, setSok] = useState<string | null>(null);
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
  const treff = kandidater
    .filter((k) =>
      `${k.fornavn} ${k.etternavn}`.toLocaleLowerCase("nb-NO").includes(q),
    )
    .slice(0, 6);
  return (
    <div className="w-full">
      <input
        autoFocus
        value={sok}
        onChange={(e) => setSok(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setSok(null);
          if (e.key === "Enter" && treff[0]) {
            onVelg(treff[0].id);
            setSok(null);
          }
        }}
        onBlur={() => window.setTimeout(() => setSok(null), 150)}
        placeholder="Skriv et navn …"
        className="h-[28px] w-full rounded-lg border border-linje bg-ark px-2 text-[13px] outline-none focus:border-aksent"
      />
      {q && (
        <div className="mt-1 flex flex-col rounded-lg bg-ark p-1 shadow-[0_0_0_1px_var(--color-linje)]">
          {treff.length === 0 && (
            <span className="px-2 py-1 text-etikett text-blekk-svak">
              Ingen treff
            </span>
          )}
          {treff.map((k) => (
            <button
              key={k.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onVelg(k.id);
                setSok(null);
              }}
              className="rounded px-2 py-1 text-left text-[13px] hover:bg-flate"
            >
              {k.fornavn} {k.etternavn}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** «Trives med · vil gjerne sitte med» og «Nevnt av andre» (26.7). */
function Onskebokser({
  elevId,
  fornavn,
  onsker,
  alle,
}: {
  elevId: string;
  fornavn: string;
  onsker: Onske[];
  alle: Navn[];
}) {
  const [hensyn, setHensyn] = useLagretInnstilling(
    ONSKER_VED_STOKK,
    false,
    (v) => v === "pa",
    (v) => (v ? "pa" : "av"),
  );
  const navn = new Map(alle.map((k) => [k.id, k]));
  const mine = onsker.filter((o) => o.elevId === elevId);
  const andre = onsker.filter((o) => o.onskerElevId === elevId);
  return (
    <>
      <div>
        <h3 className="mb-2 text-[calc(13px*var(--tekst-skala))] font-semibold">
          Trives med · vil gjerne sitte med
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {mine.map((o) => {
            const k = navn.get(o.onskerElevId);
            if (!k) return null;
            const begge = gjensidig(onsker, elevId, o.onskerElevId);
            return (
              <span
                key={o.id}
                title={`${KILDENAVN[o.kilde]} · ${o.dato.slice(8, 10)}.${o.dato.slice(5, 7)}`}
                className="inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-[12.5px]"
                style={{
                  background: `color-mix(in srgb, ${ONSKEFARGE} 12%, var(--color-ark))`,
                  boxShadow: begge
                    ? `inset 0 0 0 1.5px ${ONSKEFARGE}`
                    : undefined,
                }}
              >
                <span style={{ color: ONSKEFARGE }}>★</span>
                {kort(k)}
                <small className="text-blekk-svak">
                  {begge
                    ? "gjensidig"
                    : o.kilde === "samtale"
                      ? "fra samtale"
                      : ""}
                </small>
                <button
                  onClick={() => void fjernOnske(o.id)}
                  aria-label={`Fjern ${k.fornavn}`}
                  className="px-1 text-blekk-svak hover:text-feil"
                >
                  ×
                </button>
              </span>
            );
          })}
          <Navnesok
            tekst="+ Legg til"
            kandidater={alle.filter(
              (k) =>
                k.id !== elevId && !mine.some((o) => o.onskerElevId === k.id),
            )}
            onVelg={(id) => void leggTilOnske(elevId, id, "eleven")}
          />
        </div>
        {andre.length > 0 && (
          <p className="mt-2 text-[12.5px] text-blekk-dempet">
            Nevnt av andre:{" "}
            {andre
              .map((o) => navn.get(o.elevId))
              .filter((k): k is Navn => !!k)
              .map(kort)
              .join(", ")}
          </p>
        )}
        <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={hensyn}
            onChange={(e) => setHensyn(e.target.checked)}
            className="h-[15px] w-[15px] accent-[var(--color-aksent)]"
          />
          Ta hensyn når jeg stokker grupper og plasser
        </label>
        <p className="mt-1 text-etikett leading-normal text-blekk-svak">
          Gjelder alle elevene og alle fag. Et ønske, aldri tvang. Bare for deg:{" "}
          {fornavn} ser det aldri.
        </p>
      </div>
    </>
  );
}

/** «Neste gang skal … sitte med» (26.13): avtaler i faget, hard regel. */
function Avtaleboks({
  elevId,
  fornavn,
  fagId,
  fagNavn,
  avtaler,
  kamerater,
}: {
  elevId: string;
  fornavn: string;
  fagId: string;
  fagNavn: string;
  avtaler: Avtale[];
  kamerater: Navn[];
}) {
  const [gjelder, setGjelder] = useState<Gjelder>("begge");
  const navn = new Map(kamerater.map((k) => [k.id, k]));
  const med = (a: Avtale) => (a.elevId === elevId ? a.medElevId : a.elevId);
  return (
    <div>
      <h3 className="mb-2 text-[calc(13px*var(--tekst-skala))] font-semibold">
        Neste gang skal {fornavn} sitte med
      </h3>
      <div className="flex flex-wrap items-center gap-1.5">
        {avtaler.map((a) => {
          const k = navn.get(med(a));
          if (!k) return null;
          return (
            <span
              key={a.id}
              title={`${KILDENAVN[a.kilde]} · ${a.dato.slice(8, 10)}.${a.dato.slice(5, 7)}`}
              className="inline-flex items-center gap-1 rounded-full bg-flate-svak py-0.5 pl-2.5 pr-1 text-[12.5px]"
            >
              📌 {kort(k)}
              <small className="text-blekk-svak">
                {a.gjelder === "begge"
                  ? "kart og grupper"
                  : a.gjelder === "klassekart"
                    ? "klassekart"
                    : "grupper"}
              </small>
              <button
                onClick={() => void fjernAvtale(a.id)}
                aria-label={`Fjern avtalen med ${k.fornavn}`}
                className="px-1 text-blekk-svak hover:text-feil"
              >
                ×
              </button>
            </span>
          );
        })}
        <Navnesok
          tekst="+ Legg til"
          kandidater={kamerater.filter(
            (k) => !avtaler.some((a) => med(a) === k.id),
          )}
          onVelg={(id) =>
            void leggTilAvtale({
              elevId,
              medElevId: id,
              skolearFagId: fagId,
              gjelder,
              kilde: "jeg",
            })
          }
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-etikett text-blekk-svak">Gjelder</span>
        <Bryter
          storrelse="liten"
          verdi={gjelder}
          settVerdi={(v) => setGjelder(v as Gjelder)}
          valg={[
            { id: "klassekart", navn: "Klassekart" },
            { id: "grupper", navn: "Grupper" },
            { id: "begge", navn: "Begge" },
          ]}
        />
      </div>
      <p className="mt-1.5 text-etikett leading-normal text-blekk-svak">
        Neste gang du stokker i {fagNavn}, sitter de sammen (samme bord eller
        gruppe). Avtalen er brukt når du lagrer.
      </p>
    </div>
  );
}
