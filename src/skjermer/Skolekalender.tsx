import { Fragment, useEffect, useMemo, useState } from "react";
import {
  blokkering,
  iso,
  rodekart,
  ukenummer,
  type Blokkering,
  type Fridag,
} from "../data/kalender";
import { hentFridager, hentInnstilling, type Skolear } from "../data/skolear";
import { hentOkter, opprettOkt, slettOkt, type Okt } from "../data/okter";
import type { FagIAr } from "../data/fag";

/**
 * Kalenderen over skoleåret.
 *
 * Månedene under hverandre, hver som et rutenett mandag–fredag. Helg er ikke
 * tatt med i det hele tatt — den tar plass uten å inneholde noe (§4.2).
 *
 * Blokkerte dager tones og får navnet sitt. Da ser du hva du sperrer mens du
 * sperrer det, og oppdager med en gang hvis det allerede ligger økter der.
 */
export function Skolekalender({
  skolear,
  fag,
  onApneOkt,
}: {
  skolear: Skolear;
  fag: FagIAr[];
  onApneOkt: (oktId: string) => void;
}) {
  const [okter, setOkter] = useState<Okt[]>([]);
  const [fridager, setFridager] = useState<Fridag[]>([]);
  const [global, setGlobal] = useState("180");
  // Flere dager kan være valgt samtidig. Å klikke seg gjennom tirsdagene og
  // legge inn alle på én gang er enklere enn et serieskjema, og du ser hele
  // tiden hvor de havner.
  const [valgte, setValgte] = useState<Set<string>>(new Set());

  async function last() {
    setOkter(await hentOkter(skolear.id));
    setFridager(await hentFridager(skolear.id));
  }

  /**
   * Sletting er soft delete (§3.1), så ingenting går tapt i basen. Men en økt
   * med skåringer på seg er noe annet enn en tom plan, og da sier vi fra om
   * hvor mye som forsvinner fra elevenes heatmap før vi gjør det.
   */
  async function slettOkter(valgte: Okt[]) {
    if (valgte.length === 0) return;

    const skaret = valgte.reduce((n, o) => n + o.skaret, 0);
    const hva =
      valgte.length === 1
        ? `Slette økta ${valgte[0].fagKode} ${langDato(valgte[0].dato)}?`
        : `Slette ${valgte.length} økter?`;
    const advarsel =
      skaret > 0
        ? `\n\n${skaret} skåring${skaret === 1 ? "" : "er"} er ført på ` +
          `${valgte.length === 1 ? "den" : "dem"} og forsvinner fra heatmapet.`
        : "";

    if (!confirm(hva + advarsel)) return;
    for (const o of valgte) await slettOkt(o.id);
    await last();
  }

  useEffect(() => {
    void last();
    void hentInnstilling("standard_varighet_min").then((v) => setGlobal(v ?? "180"));
  }, [skolear.id]);

  const rode = useMemo(
    () => rodekart(skolear.start, skolear.slutt),
    [skolear.start, skolear.slutt],
  );

  const perDag = useMemo(() => {
    const kart = new Map<string, Okt[]>();
    for (const o of okter) kart.set(o.dato, [...(kart.get(o.dato) ?? []), o]);
    return kart;
  }, [okter]);

  const maneder = useMemo(
    () => manederMellom(skolear.start, skolear.slutt),
    [skolear.start, skolear.slutt],
  );

  const idag = iso(new Date());

  // Øktene som ligger på de dagene du har valgt — det er dem bulk-slettinga
  // gjelder, og antallet står på knappen så du ser hva du treffer.
  const valgteOkter = useMemo(
    () => [...valgte].sort().flatMap((d) => perDag.get(d) ?? []),
    [valgte, perDag],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-[12px] text-neutral-500">
        <span>{okter.length} økter i året</span>
        {fag.map((f) => (
          <span key={f.id} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: f.farge ?? "var(--color-na-fagstrek)" }}
            />
            {f.kode}
          </span>
        ))}
        <span className="ml-auto">
          Klikk på dagene du vil ha økter på — så mange du vil — og velg fag
          nederst.
        </span>
      </div>

      <div className="grid gap-x-6 gap-y-7 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
        {maneder.map((m) => (
          <Maned
            key={m}
            maned={m}
            spennFra={skolear.start}
            spennTil={skolear.slutt}
            perDag={perDag}
            fridager={fridager}
            rode={rode}
            idag={idag}
            valgte={valgte}
            onVelgDag={(dato) =>
              setValgte((f) => {
                const ny = new Set(f);
                if (ny.has(dato)) ny.delete(dato);
                else ny.add(dato);
                return ny;
              })
            }
            onApneOkt={onApneOkt}
            onSlettOkt={(o) => void slettOkter([o])}
          />
        ))}
      </div>

      {valgte.size > 0 && (
        <Valgtlinje
          datoer={[...valgte].sort()}
          fag={fag}
          global={global}
          fridager={fridager}
          rode={rode}
          okter={valgteOkter}
          onSlett={() => void slettOkter(valgteOkter)}
          onLagret={async () => {
            setValgte(new Set());
            await last();
          }}
          onTom={() => setValgte(new Set())}
        />
      )}
    </div>
  );
}

function Maned({
  maned,
  spennFra,
  spennTil,
  perDag,
  fridager,
  rode,
  idag,
  valgte,
  onVelgDag,
  onApneOkt,
  onSlettOkt,
}: {
  maned: string;
  spennFra: string;
  spennTil: string;
  perDag: Map<string, Okt[]>;
  fridager: Fridag[];
  rode: Map<string, string>;
  idag: string;
  valgte: Set<string>;
  onVelgDag: (dato: string) => void;
  onApneOkt: (id: string) => void;
  onSlettOkt: (okt: Okt) => void;
}) {
  const uker = ukerIManed(maned);

  return (
    <section>
      <h3 className="mb-1 text-[12px] font-semibold first-letter:uppercase">
        {manedsnavn(maned)}
      </h3>
      <div className="grid grid-cols-[1.6rem_repeat(5,1fr)] gap-px border-b border-neutral-200 pb-1 text-[10px] uppercase tracking-wide text-neutral-400">
        <span className="px-1" title="Ukenummer">
          uke
        </span>
        {["ma", "ti", "on", "to", "fr"].map((d) => (
          <span key={d} className="px-1">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-[1.6rem_repeat(5,1fr)] gap-px bg-neutral-200">
        {uker.map((uke, r) => (
          <Fragment key={r}>
            <div className="flex min-h-[3.25rem] items-start justify-center bg-white pt-1 text-[10px] tabular-nums text-neutral-400">
              {uke.find((d) => d !== null)
                ? ukenummer(uke.find((d) => d !== null)!)
                : ""}
            </div>
            {uke.map((dato, i) =>
              dato === null ? (
                <div key={i} className="min-h-[3.25rem] bg-white" />
              ) : (
                <Dag
                  key={dato}
                  dato={dato}
                  utenfor={dato < spennFra || dato > spennTil}
                  okter={perDag.get(dato) ?? []}
                  blokkert={blokkering(dato, fridager, rode)}
                  erIdag={dato === idag}
                  valgt={valgte.has(dato)}
                  onVelg={() => onVelgDag(dato)}
                  onApneOkt={onApneOkt}
                  onSlettOkt={onSlettOkt}
                />
              ),
            )}
          </Fragment>
        ))}
      </div>
    </section>
  );
}

function Dag({
  dato,
  utenfor,
  okter,
  blokkert,
  erIdag,
  valgt,
  onVelg,
  onApneOkt,
  onSlettOkt,
}: {
  dato: string;
  utenfor: boolean;
  okter: Okt[];
  blokkert: Blokkering | null;
  erIdag: boolean;
  valgt: boolean;
  onVelg: () => void;
  onApneOkt: (id: string) => void;
  onSlettOkt: (okt: Okt) => void;
}) {
  const dagnr = Number(dato.slice(8));
  // Ligger det økter på en blokkert dag, er det noe å rydde opp i.
  const konflikt = blokkert !== null && okter.length > 0;

  const bakgrunn = utenfor
    ? "bg-neutral-50"
    : konflikt
      ? "bg-na-konflikt"
      : blokkert
        ? blokkert.type === "helligdag"
          ? "bg-na-helligdag"
          : "bg-na-fri"
        : "bg-white";

  return (
    <div
      onClick={utenfor ? undefined : onVelg}
      className={`min-h-[3.25rem] px-1 py-0.5 ${bakgrunn} ${
        utenfor ? "" : "cursor-pointer hover:brightness-[0.98]"
      } ${valgt ? "outline outline-2 -outline-offset-2 outline-na-blaa" : ""}`}
    >
      <div className="flex items-baseline gap-1">
        <span
          className={`text-[11px] tabular-nums ${
            erIdag
              ? "rounded-sm bg-na-blaa px-1 font-medium text-white"
              : utenfor
                ? "text-neutral-300"
                : "text-neutral-500"
          }`}
        >
          {dagnr}
        </span>
        {konflikt && (
          <span
            title={`${okter.length} økt(er) ligger på ${blokkert!.navn}`}
            className="text-[11px] font-bold text-feil"
          >
            !
          </span>
        )}
      </div>

      {blokkert && !utenfor && (
        <p
          className={`truncate text-[10px] ${
            konflikt ? "text-feil" : "text-neutral-400"
          }`}
          title={blokkert.navn}
        >
          {blokkert.navn}
        </p>
      )}

      {/*
        To knapper på rad, ikke én: krysset kan ikke ligge inni knappen som
        åpner økta. Krysset vises først når musa er over brikka, så rutene
        holder seg rolige når du bare ser på kalenderen (§13).
      */}
      {okter.map((o) => (
        <div
          key={o.id}
          className="group/okt mt-0.5 flex w-full items-center gap-1 rounded-[2px] px-0.5 text-[10px] hover:bg-neutral-100"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApneOkt(o.id);
            }}
            title={`${o.fagKode} ${o.klokkeslett ?? ""} ${o.tema ?? ""}`}
            className="flex min-w-0 flex-1 items-center gap-1 text-left"
          >
            <span
              aria-hidden
              className="h-2.5 w-[3px] shrink-0 rounded-full"
              style={{ background: o.farge ?? "var(--color-na-fagstrek)" }}
            />
            <span className="truncate">{o.fagKode}</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSlettOkt(o);
            }}
            title={`Slett ${o.fagKode} denne dagen`}
            className="hidden shrink-0 px-0.5 leading-none text-neutral-400 hover:text-red-700 group-hover/okt:block"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Linja nederst når én eller flere dager er valgt. Ett klikk på et fag lager
 * økter på alle sammen, med arvet varighet.
 */
function Valgtlinje({
  datoer,
  fag,
  global,
  fridager,
  rode,
  okter,
  onSlett,
  onLagret,
  onTom,
}: {
  datoer: string[];
  fag: FagIAr[];
  global: string;
  fridager: Fridag[];
  rode: Map<string, string>;
  okter: Okt[];
  onSlett: () => void;
  onLagret: () => void;
  onTom: () => void;
}) {
  const [klokke, setKlokke] = useState("");
  const [jobber, setJobber] = useState(false);

  const blokkerte = datoer.filter((d) => blokkering(d, fridager, rode) !== null);

  async function leggTil(f: FagIAr) {
    setJobber(true);
    try {
      for (const dato of datoer) {
        await opprettOkt(
          f.id,
          f.kode,
          dato,
          klokke || null,
          Number(f.standardVarighetMin ?? global),
        );
      }
      onLagret();
    } finally {
      setJobber(false);
    }
  }

  return (
    <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-2 border border-neutral-300 bg-neutral-50 px-3 py-2 text-[13px] shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
      <span className="font-medium tabular-nums">
        {datoer.length === 1 ? langDato(datoer[0]) : `${datoer.length} dager valgt`}
      </span>

      {blokkerte.length > 0 && (
        <span className="text-[12px] text-feil">
          {blokkerte.length === datoer.length
            ? "merket som fri"
            : `${blokkerte.length} av dem er merket som fri`}
        </span>
      )}

      <input
        value={klokke}
        onChange={(e) => setKlokke(e.target.value)}
        placeholder="09:15"
        className="w-20 rounded border border-neutral-300 px-2 py-1 tabular-nums outline-none focus:border-na-blaa"
      />

      <span className="text-neutral-500">Legg inn økt i:</span>
      {fag.map((f) => (
        <button
          key={f.id}
          disabled={jobber}
          onClick={() => leggTil(f)}
          className="flex items-center gap-1.5 rounded border border-neutral-300 bg-white px-2 py-1 hover:bg-neutral-100 disabled:opacity-40"
        >
          <span
            aria-hidden
            className="h-3 w-[3px] rounded-full"
            style={{ background: f.farge ?? "var(--color-na-fagstrek)" }}
          />
          {f.kode}
        </button>
      ))}

      <div className="ml-auto flex items-center gap-3">
        {okter.length > 0 && (
          <button
            onClick={onSlett}
            className="text-[12px] text-neutral-400 hover:text-red-700"
          >
            Slett {okter.length === 1 ? "økta" : `${okter.length} øktene`} her
          </button>
        )}
        <button
          onClick={onTom}
          className="text-[12px] text-neutral-500 hover:text-neutral-900"
        >
          Nullstill valget
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ datoer

function manederMellom(fra: string, til: string): string[] {
  const maneder: string[] = [];
  const d = new Date(`${fra.slice(0, 7)}-01T00:00:00`);
  const slutt = new Date(`${til.slice(0, 7)}-01T00:00:00`);
  while (d <= slutt) {
    maneder.push(iso(d).slice(0, 7));
    d.setMonth(d.getMonth() + 1);
  }
  return maneder;
}

/**
 * Ukene i måneden som rader av fem celler, mandag til fredag. null er en
 * plass før den første eller etter den siste dagen i måneden.
 */
function ukerIManed(maned: string): (string | null)[][] {
  const forste = new Date(`${maned}-01T00:00:00`);
  const siste = new Date(forste.getFullYear(), forste.getMonth() + 1, 0);

  const uker: (string | null)[][] = [];
  let uke: (string | null)[] = [];

  // Fyll opp til den ukedagen måneden begynner på. Begynner den i helga,
  // fylles ingenting — første rad starter da på mandagen etter.
  const start = (forste.getDay() + 6) % 7; // mandag = 0
  if (start < 5) for (let i = 0; i < start; i++) uke.push(null);

  for (let dag = 1; dag <= siste.getDate(); dag++) {
    const d = new Date(forste.getFullYear(), forste.getMonth(), dag);
    const ukedag = (d.getDay() + 6) % 7;
    if (ukedag > 4) continue; // helg vises ikke

    if (uke.length === 5) {
      uker.push(uke);
      uke = [];
    }
    while (uke.length < ukedag) uke.push(null);
    uke.push(iso(d));
  }

  while (uke.length > 0 && uke.length < 5) uke.push(null);
  if (uke.length > 0) uker.push(uke);
  return uker;
}

function manedsnavn(maned: string): string {
  return new Date(`${maned}-01T00:00:00`).toLocaleDateString("nb-NO", {
    month: "long",
    year: "numeric",
  });
}

function langDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
