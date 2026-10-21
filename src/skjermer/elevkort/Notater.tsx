import { useApen } from "../../ui/Sammenleggbar";
import { Skarprikk, slagFraVerdi } from "../../ui/Skarprikk";
import { Utfold } from "../../ui/Utfold";
import { useEffect, useState } from "react";
import { Tidslinjedato, Tidslinjestrek } from "../../ui/Tidslinje";
import { useArk } from "../../ui/Arkstabel";
import { lyttElever } from "../../data/endringer";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import { Bryter, Kappet, Knapp } from "../../ui/felles";
import {
  erForfalt,
  hentElevnotater,
  opprettElevnotat,
  settLukket,
  slettElevnotat,
  type Elevnotat,
  endreElevnotat,
  flettTidslinje,
  hentOktnotater,
  type Notatfilter,
  type Oktnotat,
} from "../../data/elevnotat";
import { settSkaringsnotat } from "../../data/okter";
import { skalafarge } from "../../ui/farger";
import { Markdownfelt, MarkdownSkriv } from "../../ui/Notattekst";
import { useSisteSvar } from "../../ui/sisteSvar";
import { idag as dagensDato } from "../../db";
import { Stille } from "./deler";

function Bolk({
  tittel,
  handling,
  sammenlagt: styrt,
  nokkel,
  children,
}: {
  /** gjør bolken sammenleggbar på egen hånd; valget huskes (ui/Sammenleggbar) */
  nokkel?: string;
  tittel: string;
  /** en knapp til høyre i overskriftslinja, f.eks. «+ Nytt notat» */
  handling?: React.ReactNode;
  /**
   * Gjør bolken sammenleggbar: overskriften blir en knapp. `apen` styres
   * utenfra, så valget kan huskes; `etikett` står etter tittelen når den er
   * lagt sammen, f.eks. antallet.
   */
  sammenlagt?: { apen: boolean; bytt: () => void; etikett?: string };
  children: React.ReactNode;
}) {
  const [egenApen, setEgenApen] = useApen(nokkel);
  // Styrt utenfra (notatene, der «+ Nytt notat» også åpner), eller av seg selv.
  const sammenlagt =
    styrt ??
    (nokkel
      ? { apen: egenApen, bytt: () => setEgenApen(!egenApen) }
      : undefined);
  const apen = sammenlagt?.apen ?? true;
  return (
    <section className="mb-6">
      <div
        className={`flex items-baseline border-b border-linje-medium pb-1 ${apen ? "mb-2" : ""}`}
      >
        {sammenlagt ? (
          <button
            onClick={sammenlagt.bytt}
            aria-expanded={apen}
            className="flex items-baseline gap-1.5 text-brod font-semibold text-blekk hover:text-blekk-dempet"
          >
            <span
              aria-hidden
              className={`inline-block transition-transform duration-150 ${apen ? "rotate-90" : ""}`}
            >
              ›
            </span>
            {tittel}
            {!apen && sammenlagt.etikett && (
              <span className="font-normal text-blekk-svak">
                {sammenlagt.etikett}
              </span>
            )}
          </button>
        ) : (
          <h3 className="text-brod font-semibold text-blekk">{tittel}</h3>
        )}
        {handling && <span className="ml-auto">{handling}</span>}
      </div>
      <Utfold apen={apen}>{children}</Utfold>
    </section>
  );
}
export function Motelogg({
  elevId,
  skolearId,
  nyttNotat = 0,
}: {
  elevId: string;
  skolearId: string;
  /** øker når N, M eller ⋯-menyen ber om et nytt notat */
  nyttNotat?: number;
}) {
  const [notater, setNotater] = useState<Elevnotat[]>([]);
  // Notatene fra skåringen i øktene (§4.4). De bor på skåringsraden, men
  // hører hjemme i elevens tidslinje sammen med møteloggen.
  const [oktnotater, setOktnotater] = useState<Oktnotat[]>([]);
  const [filter, setFilter] = useState<Notatfilter>("alle");
  const [skriver, setSkriver] = useState(false);
  // Lagt sammen eller åpen huskes, for alle elever: det er en vane, ikke en
  // egenskap ved eleven.
  const [apen, settApen] = useApen("elevkort-notater");
  const idag = dagensDato();
  const ark = useArk();

  const vakt = useSisteSvar();
  async function last() {
    const gjeldende = vakt();
    const [n, o] = await Promise.all([
      hentElevnotater(elevId),
      hentOktnotater(elevId),
    ]);
    if (!gjeldende()) return;
    setNotater(n);
    setOktnotater(o);
  }

  useEffect(() => {
    void last();
  }, [elevId]);
  // Et notat skrevet i en økt over kortet, skal stå her når økta lukkes.
  useEffect(() => lyttElever(() => void last()), [elevId]);

  useEffect(() => {
    if (nyttNotat === 0) return;
    settApen(true);
    setSkriver(true);
  }, [nyttNotat]);

  const punkter = flettTidslinje(notater, oktnotater, filter);

  return (
    <Bolk
      tittel="Notater og møtelogg"
      sammenlagt={{
        apen,
        bytt: () => settApen(!apen),
        etikett:
          notater.length + oktnotater.length > 0
            ? `· ${notater.length + oktnotater.length}`
            : undefined,
      }}
      handling={
        !skriver && (
          <button
            onClick={() => {
              settApen(true);
              setSkriver(true);
            }}
            className="text-liten text-blekk-dempet hover:text-blekk"
          >
            + Nytt notat
          </button>
        )
      }
    >
      {/* Det nye notatet skrives øverst, der det havner — nyeste først. */}
      {skriver && (
        <NyttNotat
          elevId={elevId}
          skolearId={skolearId}
          onLagret={async () => {
            setSkriver(false);
            await last();
          }}
          onAvbryt={() => setSkriver(false)}
        />
      )}

      {/*
        Filteret står bare når det er noe å skille: møteloggen og notatene
        fra øktene.
      */}
      {notater.length > 0 && oktnotater.length > 0 && (
        <div className="mb-3">
          <Bryter
            storrelse="liten"
            verdi={filter}
            settVerdi={(v) => setFilter(v as Notatfilter)}
            valg={[
              { id: "alle", navn: "Alle" },
              { id: "motelogg", navn: `Møtelogg · ${notater.length}` },
              { id: "okt", navn: `Fra øktene · ${oktnotater.length}` },
            ]}
          />
        </div>
      )}

      {notater.length === 0 && oktnotater.length === 0 && !skriver && (
        <Stille>
          Ingen notater ennå. Her samles det du vil huske om eleven over tid:
          samtaler, observasjoner, avtaler.
        </Stille>
      )}

      {/* Tidslinja: dato til venstre, en linje med et punkt per notat. */}
      <div className={skriver ? "mt-4" : ""}>
        {punkter.map((p, i) =>
          p.slag === "notat" ? (
            <Notatrad
              key={p.notat.id}
              notat={p.notat}
              idag={idag}
              sist={i === punkter.length - 1}
              onEndret={last}
            />
          ) : (
            <Oktnotatrad
              key={p.notat.id}
              elevId={elevId}
              notat={p.notat}
              sist={i === punkter.length - 1}
              onApneOkt={() => ark.apneOkt(p.notat.oktId)}
              onEndret={last}
            />
          ),
        )}
      </div>

      <p className="mt-2 text-etikett text-blekk-svak">
        Dette er arbeidsmateriale. Helse, hjemmeforhold og andre særlige
        kategorier hører ikke hjemme her.
      </p>
    </Bolk>
  );
}
/**
 * Et notat fra skåringen i en økt. Merket er fagfirkanten (DESIGN.md §10);
 * skåringen står som en liten prikk ved kilden, så tidslinja fortsatt viser
 * hvordan timen gikk. Fag og tema åpner økta.
 */
function Oktnotatrad({
  elevId,
  notat,
  sist,
  onApneOkt,
  onEndret,
}: {
  elevId: string;
  notat: Oktnotat;
  sist: boolean;
  onApneOkt: () => void;
  onEndret: () => void;
}) {
  return (
    <div className="flex gap-3">
      <Tidslinjedato dato={notat.dato} />

      <Tidslinjestrek sist={sist} fag={notat.fagFarge} />

      <div className="min-w-0 flex-1 pb-4">
        <div className="flex items-baseline gap-2 text-liten">
          <button
            onClick={onApneOkt}
            className="flex min-w-0 items-baseline gap-2 text-left hover:text-aksent"
          >
            <span className="shrink-0 rounded-liten bg-flate px-1.5 text-blekk-dempet">
              Økt
            </span>
            {notat.farge && (
              <span title={notat.verdi ?? undefined} className="self-center">
                <Skarprikk
                  slag={slagFraVerdi({ farge: notat.farge })}
                  farge={
                    ["gronn", "gul", "rod"].includes(notat.farge)
                      ? undefined
                      : skalafarge(notat.farge)
                  }
                  storrelse={8}
                />
              </span>
            )}
            <span className="shrink-0 text-blekk-svak">{notat.fagKode}</span>
            {notat.tema && (
              <Kappet verdi={notat.tema} klasse="text-blekk-svak" />
            )}
          </button>
        </div>
        <div className="-mx-2">
          <Markdownfelt
            verdi={notat.tekst}
            onLagre={async (v) => {
              await settSkaringsnotat(elevId, notat.oktId, v ?? "");
              onEndret();
            }}
          />
        </div>
      </div>
    </div>
  );
}
function Notatrad({
  notat,
  idag,
  sist,
  onEndret,
}: {
  notat: Elevnotat;
  idag: string;
  /** nederste punkt: linja stopper ved prikken */
  sist: boolean;
  onEndret: () => void;
}) {
  const apent = notat.skalFolgesOpp && notat.lukket === null;
  const forfalt = erForfalt(notat, idag);

  return (
    <div className="flex gap-3">
      {/* Datoen er det man leter etter i en logg, så den står for seg. */}
      <Tidslinjedato dato={notat.dato} />

      {/*
        Møteloggen har lilla prikk (DESIGN.md §10). Et forfalt
        oppfølgingspunkt er rødt, så det synes når man skumleser.
      */}
      <Tidslinjestrek
        sist={sist}
        farge={forfalt ? "var(--color-feil)" : "var(--color-aksent)"}
      />

      <div className="min-w-0 flex-1 pb-4">
        <div className="flex items-baseline gap-2 text-liten">
          {/*
            Herkomsten leses av notatets egne felter, ikke av at samtalen
            fortsatt finnes: en ny trekning erstatter samtaleradene, og
            notatet skal stå like fullt.
          */}
          {notat.samtaleId && (
            <span className="rounded-liten bg-flate px-1.5 text-blekk-dempet">
              {notat.skolearFagId ? "Fagsamtale" : "Mentorsamtale"}
            </span>
          )}
          {notat.fagKode && (
            <span className="text-blekk-svak">{notat.fagKode}</span>
          )}
          {apent && (
            <span className={forfalt ? "text-feil" : "text-aksent"}>
              {notat.frist
                ? `${forfalt ? "forfalt" : "frist"} ${notat.frist}`
                : "følges opp"}
            </span>
          )}
          <span className="ml-auto flex items-center gap-2">
            {notat.skalFolgesOpp && (
              <button
                onClick={async () => {
                  await settLukket(notat.id, notat.lukket === null);
                  onEndret();
                }}
                className="text-blekk-svak hover:text-blekk"
              >
                {notat.lukket === null ? "Lukk" : "Åpne igjen"}
              </button>
            )}
            <button
              onClick={async () => {
                if (!(await bekreft(`Slette notatet fra ${notat.dato}?`)))
                  return;
                await slettElevnotat(notat.id);
                onEndret();
              }}
              className="text-blekk-svakest hover:text-feil"
            >
              Slett
            </button>
          </span>
        </div>
        {/*
          Formatert markdown; klikk for å skrive. Avkrysningsbokser kan
          krysses av rett i visningen. Et notat kan ikke tømmes — da slettes
          det.
        */}
        <div className="-mx-2">
          <Markdownfelt
            verdi={notat.tekst}
            onLagre={async (v) => {
              if (!v) return;
              await endreElevnotat(notat.id, { tekst: v });
              onEndret();
            }}
          />
        </div>
      </div>
    </div>
  );
}
function NyttNotat({
  elevId,
  skolearId,
  onLagret,
  onAvbryt,
}: {
  elevId: string;
  skolearId: string;
  onLagret: () => void;
  onAvbryt: () => void;
}) {
  const [dato, setDato] = useState(dagensDato());
  const [tekst, setTekst] = useState("");
  const [folgesOpp, setFolgesOpp] = useState(false);
  const [frist, setFrist] = useState("");

  return (
    <div className="mt-2 rounded-vanlig border border-linje bg-flate-svak p-2">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={dato}
          onChange={(e) => setDato(e.target.value)}
          className="rounded border border-linje bg-ark px-2 py-1 text-brod tabular-nums"
        />
        <label className="flex select-none items-center gap-1.5 text-liten text-blekk-dempet">
          <input
            type="checkbox"
            checked={folgesOpp}
            onChange={(e) => setFolgesOpp(e.target.checked)}
          />
          Skal følges opp
        </label>
        {/* Fristen er valgfri også når boksen er huket av: mye oppfølging har
            ingen dato, den er bare der til den er gjort (§4.7). */}
        {folgesOpp && (
          <input
            type="date"
            value={frist}
            onChange={(e) => setFrist(e.target.value)}
            title="Frist er valgfri"
            className="rounded border border-linje bg-ark px-2 py-1 text-brod tabular-nums"
          />
        )}
      </div>

      <div className="mt-2">
        <MarkdownSkriv
          autoFocus
          verdi={tekst}
          onEndre={setTekst}
          plassholder="Hva skjedde, og hva ble avtalt? «- » gir en punktliste, «- [ ] » en avkrysningsboks."
        />
      </div>

      <div className="mt-2 flex gap-2">
        <Knapp
          variant="primar"
          disabled={tekst.trim() === ""}
          onClick={async () => {
            await opprettElevnotat(elevId, skolearId, {
              dato,
              tekst: tekst.trim(),
              skalFolgesOpp: folgesOpp,
              frist: folgesOpp && frist !== "" ? frist : null,
            });
            onLagret();
          }}
        >
          Lagre
        </Knapp>
        <Knapp variant="stille" onClick={onAvbryt}>
          Avbryt
        </Knapp>
      </div>
    </div>
  );
}
