import { useEffect, useState } from "react";
import {
  endreSkolear,
  hentInnstilling,
  hentSkolear,
  settAktivtSkolear,
  settInnstilling,
  settTekstskala,
  slettSkolear,
  tellForSkolear,
  TEKSTSKALA,
} from "../data/skolear";
import {
  gjenopprettFra,
  hentKopier,
  hentKopimappe,
  taKopiNa,
  type Kopi,
} from "../data/sikkerhetskopi";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  hentSkalaer,
  hentVerdier,
  taster,
  type Skala,
  type Skalaverdi,
} from "../skala";
import type { Skolear } from "../data/skolear";
import * as kalender from "../data/kalenderfeed";
import * as caldav from "../data/caldav";
import { skrivArkiv } from "../data/arkiv";
import { LAERERNAVN } from "../data/arsplanark";
import { Merke } from "../ui/logo";
import { getVersion } from "@tauri-apps/api/app";
import {
  open,
  open as velgMappe,
  confirm as bekreft,
} from "@tauri-apps/plugin-dialog";
import type { FagIAr } from "../data/fag";
import { Felt, Knapp, Ikon } from "../ui/felles";

/**
 * Globale innstillinger, SPEC §4.8.
 *
 * Bare det som gjelder på tvers av skoleår ligger her. Skoleårets egne
 * rammer — datoer, ferier, planleggingsdager — ligger under skoleåret,
 * fordi de er forskjellige hvert år.
 */
export function Innstillinger({
  skolear,
  fag,
  onEndret,
  onApneSkoleruta,
}: {
  skolear: Skolear;
  fag: FagIAr[];
  /** Skoleruta — ferier, fridager og hendelser. Lå før i menyen. */
  onApneSkoleruta: () => void;
  /** laster skoleåret og fagene på nytt — uten å laste hele appen, som
      ville sendt deg tilbake til startskjermen */
  onEndret: () => void;
}) {
  const [dav, setDav] = useState<caldav.Oppsett>({
    base: "",
    bruker: "",
    pa: false,
    kalendere: {},
    mentorPa: false,
    mentorKalender: "",
  });
  const [davPassord, setDavPassord] = useState("");
  const [davHarPassord, setDavHarPassord] = useState(false);
  const [davMelding, setDavMelding] = useState<string | null>(null);
  const [tekstskala, setTekstskala] = useState("0.93");
  const [davFeil, setDavFeil] = useState<string | null>(null);
  const [davJobber, setDavJobber] = useState(false);
  const [arkivmappe, setArkivmappe] = useState("");
  const [arkivMelding, setArkivMelding] = useState<string | null>(null);
  const [arkiverer, setArkiverer] = useState(false);
  const [versjon, setVersjon] = useState("");
  const [ar, setAr] = useState<Skolear[]>([]);
  const [feedPa, setFeedPa] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [feedFeil, setFeedFeil] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const [varighet, setVarighet] = useState("180");
  const [lagret, setLagret] = useState(false);
  const [skalaer, setSkalaer] = useState<Skala[]>([]);
  const [kopier, setKopier] = useState<Kopi[]>([]);
  const [kopimappe, setKopimappe] = useState("");
  const [tarKopi, setTarKopi] = useState(false);
  const [verdier, setVerdier] = useState<Record<string, Skalaverdi[]>>({});

  /**
   * Bytter arbeidsfila. Handlingen er stor nok til å fortjene en tydelig
   * bekreftelse — men den er ikke uopprettelig: den nåværende basen sikres
   * i backup-mappa først.
   */
  async function gjenopprett(sti: string, navn: string) {
    const svar = await bekreft(
      `Gjenopprett fra ${navn}?\n\n` +
        `Alt du har lagt inn etter at denne kopien ble tatt, forsvinner fra ` +
        `arbeidsfila. Den nåværende basen legges i backup-mappa først, så du ` +
        `kan gå tilbake.\n\nAppen starter på nytt.`,
    );
    if (!svar) return;

    try {
      await gjenopprettFra(sti);
    } catch (e) {
      alert(`Gjenopprettingen stoppet: ${e}`);
    }
  }

  async function velgFil() {
    const valgt = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "SQLite-database", extensions: ["sqlite", "db"] }],
    });
    if (typeof valgt === "string") {
      await gjenopprett(valgt, valgt.split("/").pop() ?? valgt);
    }
  }

  useEffect(() => {
    void hentInnstilling(TEKSTSKALA).then((v) => setTekstskala(v ?? "0.93"));
  }, []);

  useEffect(() => {
    void (async () => {
      setDav(await caldav.hentOppsett());
      setDavHarPassord(await caldav.harPassord());
      setArkivmappe((await hentInnstilling("eksportmappe")) ?? "");
      setVersjon(await getVersion().catch(() => ""));
      setAr(await hentSkolear());
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      const pa = await kalender.erPa();
      setFeedPa(pa);
      if (pa) setFeedUrl(await kalender.hentUrl());
    })();
  }, []);

  async function lastKopier() {
    setKopier(await hentKopier());
    setKopimappe(await hentKopimappe());
  }

  useEffect(() => {
    void lastKopier();
    void hentInnstilling("standard_varighet_min").then((v) =>
      setVarighet(v ?? "180"),
    );
    void (async () => {
      const s = await hentSkalaer();
      const v: Record<string, Skalaverdi[]> = {};
      for (const skala of s) v[skala.id] = await hentVerdier(skala.id);
      setSkalaer(s);
      setVerdier(v);
    })();
  }, []);

  return (
    <div className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-auto">
      <Bolk tittel="Skoleår">
        <p className="mb-3 text-brod text-blekk-dempet">
          Ett år er aktivt om gangen. Å bytte rører ingen data — det endrer bare
          hva appen viser.
        </p>
        <Knapp onClick={onApneSkoleruta}>
          Skoleruta — ferier og fridager <Ikon navn="pil" />
        </Knapp>
        <div className="mb-3" />

        {ar.length === 0 ? (
          <p className="text-brod text-blekk-svak">Ingen skoleår ennå.</p>
        ) : (
          <ul className="max-w-2xl divide-y divide-linje-svak">
            {ar.map((a) => {
              const aktivt = a.id === skolear.id;
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 py-1.5 text-brod"
                >
                  <span
                    className={`w-24 shrink-0 tabular-nums ${aktivt ? "font-medium" : ""}`}
                  >
                    {a.navn}
                  </span>
                  <span className="tabular-nums text-liten text-blekk-dempet">
                    {a.start} – {a.slutt}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {aktivt ? (
                      <span className="text-liten text-blekk-dempet">
                        aktivt
                      </span>
                    ) : (
                      <Knapp
                        onClick={async () => {
                          await settAktivtSkolear(a.id);
                          // Hele appen henger på det aktive året, så alt må
                          // leses på nytt — men du skal bli stående i
                          // innstillingene, ikke kastes til startskjermen.
                          setAr(await hentSkolear());
                          onEndret();
                        }}
                      >
                        Gjør aktivt
                      </Knapp>
                    )}
                    <button
                      onClick={async () => {
                        const n = await tellForSkolear(a.id);
                        const ok = await bekreft(
                          `Slette skoleåret ${a.navn}?\n\n` +
                            `${n.fag} fag i året, ${n.okter} økter, ` +
                            `${n.skaringer} skåringer, ${n.vurderinger} vurderinger, ` +
                            `${n.klasser} klasser.\n\n` +
                            "Fagene blir stående i fagbanken, og elevene blir " +
                            "stående — de lever på tvers av år. Det som " +
                            "forsvinner er dette årets økter og koblinger.\n\n" +
                            "Sikkerhetskopien fra i dag er veien tilbake.",
                        );
                        if (!ok) return;
                        // slettSkolear flytter selv pekeren til aktivt år,
                        // også når det slettede året var det siste.
                        await slettSkolear(a.id);
                        setAr(await hentSkolear());
                        onEndret();
                      }}
                      className="text-liten text-blekk-svak hover:text-feil"
                    >
                      Slett
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Felt
            etikett="Navn"
            verdi={skolear.navn}
            settVerdi={() => {}}
            bredde="w-28"
          />
          <Felt
            etikett="Første skoledag"
            type="date"
            verdi={skolear.start}
            settVerdi={async (v) => {
              if (v) {
                await endreSkolear(skolear.id, { start: v });
                setAr(await hentSkolear());
              }
            }}
            bredde="w-40"
          />
          <Felt
            etikett="Siste skoledag"
            type="date"
            verdi={skolear.slutt}
            settVerdi={async (v) => {
              if (v) {
                await endreSkolear(skolear.id, { slutt: v });
                setAr(await hentSkolear());
              }
            }}
            bredde="w-40"
          />
        </div>
      </Bolk>

      <Bolk tittel="Utseende">
        {/*
          Hele typeskalaen ganges med dette tallet, så forholdet mellom
          gradene holder seg uansett valg — det er hierarkiet som bærer, ikke
          de absolutte tallene.
        */}
        <label className="block max-w-sm">
          <Etikett>Tekststørrelse</Etikett>
          <select
            value={tekstskala}
            onChange={async (e) => {
              const v = e.target.value;
              setTekstskala(v);
              settTekstskala(v);
              await settInnstilling(TEKSTSKALA, v);
            }}
            className="w-full rounded border border-linje bg-ark px-2 py-1.5 text-brod"
          >
            <option value="0.87">Liten — 13 px brødtekst</option>
            <option value="0.93">Normal — 14 px</option>
            <option value="1">Stor — 15 px</option>
            <option value="1.07">Større — 16 px</option>
          </select>
          <p className="mt-1 text-liten text-blekk-dempet">
            Endringen gjelder med en gang. Skåringslista er den tetteste
            skjermen — skrur du helt opp, får færre enn tretti elever plass uten
            å rulle.
          </p>
        </label>
      </Bolk>

      <Bolk tittel="Standardverdier">
        <Laerernavn />
        <div className="flex items-end gap-3">
          <label className="block">
            <Etikett>Standard varighet på nye økter</Etikett>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={varighet}
                onChange={(e) => {
                  setVarighet(e.target.value);
                  setLagret(false);
                }}
                className="w-24 rounded border border-linje px-2 py-1.5 text-brod tabular-nums"
              />
              <span className="text-brod text-blekk-dempet">minutter</span>
            </div>
          </label>
          <Knapp
            onClick={async () => {
              const n = Math.round(Number(varighet));
              if (n > 0) {
                await settInnstilling("standard_varighet_min", String(n));
                setLagret(true);
              }
            }}
          >
            Lagre
          </Knapp>
          {lagret && (
            <span className="inline-flex items-center gap-1 pb-2 text-liten text-aksent">
              <Ikon navn="hake" /> lagret
            </span>
          )}
        </div>
        <p className="mt-2 text-liten text-blekk-dempet">
          Varighet arves i tre ledd: denne verdien → fagets egen standard →
          øktas egen verdi. Sett fagets standard under Fag hvis ett fag alltid
          har en annen lengde.
        </p>
      </Bolk>

      <Bolk tittel="Skalaer">
        <p className="mb-3 text-liten text-blekk-dempet">
          Tastene utledes av rekkefølgen, ikke av kode. Verdien som betyr
          «ingenting her» får alltid <code>0</code>. Egne skalaer kan lages
          senere — se §5.3.
        </p>
        {skalaer.map((skala) => (
          <div key={skala.id} className="mb-4">
            <p className="text-brod font-medium">
              {skala.navn}{" "}
              <span className="font-normal text-blekk-dempet">
                · {skala.bruksomrade}
              </span>
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(verdier[skala.id] ?? []).map((v) => {
                const t = taster(verdier[skala.id] ?? []).get(v.id);
                return (
                  <span
                    key={v.id}
                    title={v.etikett ?? undefined}
                    className="flex items-center gap-1.5 rounded-sm border border-linje px-2 py-0.5 text-liten"
                  >
                    {t && (
                      <kbd className="rounded-sm bg-flate px-1 font-mono text-etikett text-blekk-dempet">
                        {t}
                      </kbd>
                    )}
                    {v.kode}
                    {v.teller_ikke === 1 && (
                      <span className="text-blekk-svak">teller ikke</span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </Bolk>

      <Bolk tittel="Kalenderstrøm">
        <p className="mb-2 text-brod text-blekk-dempet">
          Lar kalenderen din abonnere på årsplanen, slik at den oppdaterer seg
          selv. Strømmen serveres bare til denne maskinen, og inneholder
          <strong className="font-medium">
            {" "}
            fagkode, tema, dato og varighet
          </strong>{" "}
          — ingen elevnavn, skåringer eller notater.
        </p>

        <label className="flex items-center gap-2 text-brod">
          <input
            type="checkbox"
            checked={feedPa}
            onChange={async (e) => {
              const pa = e.target.checked;
              setFeedPa(pa);
              setFeedFeil(null);
              await kalender.settPa(pa);
              if (!pa) return;
              try {
                setFeedUrl(await kalender.start(skolear));
              } catch (err) {
                setFeedFeil(String(err));
                setFeedPa(false);
                await kalender.settPa(false);
              }
            }}
          />
          Del årsplanen som kalenderstrøm
        </label>

        {feedFeil && <p className="mt-2 text-brod text-feil">{feedFeil}</p>}

        {feedPa && feedUrl && (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-vanlig border border-linje bg-flate px-2 py-1 text-liten">
                {feedUrl}
              </code>
              <Knapp
                onClick={async () => {
                  await navigator.clipboard.writeText(feedUrl);
                  setKopiert(true);
                  setTimeout(() => setKopiert(false), 1500);
                }}
              >
                {kopiert ? "Kopiert" : "Kopier"}
              </Knapp>
            </div>
            <p className="mt-2 text-liten text-blekk-dempet">
              I Kalender: <em>Arkiv → Nytt kalenderabonnement</em>, lim inn
              adressen, og velg oppdatering hvert femte minutt.
            </p>
            <p className="mt-1 text-liten text-blekk-dempet">
              Velger du <em>iCloud</em> som plassering, lastes timeplanen opp
              til Apple og følger med til telefonen. Velger du{" "}
              <em>På min Mac</em>, blir den her — men da bare på denne maskinen.
              Strømmen oppdaterer seg bare mens appen kjører.
            </p>
          </div>
        )}
      </Bolk>

      <Bolk tittel="Arkiv">
        <p className="mb-3 text-brod text-blekk-dempet">
          Hele basen skrevet ut som markdown og CSV — én fil per elev, én per
          fag. Kan åpnes i Obsidian eller hva som helst annet, også om denne
          appen ikke finnes lenger. Skrives ved hver oppstart.
        </p>
        <p className="mb-3 text-liten text-blekk-dempet">
          Denne mappa <em>kan</em> ligge i en skytjeneste — det er vanlige
          tekstfiler. Databasen selv skal aldri det.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Knapp
            onClick={async () => {
              const valgt = await velgMappe({ directory: true });
              if (typeof valgt !== "string") return;
              await settInnstilling("eksportmappe", valgt);
              setArkivmappe(valgt);
              setArkivMelding(null);
            }}
          >
            {arkivmappe ? "Bytt mappe" : "Velg mappe"}
          </Knapp>
          <Knapp
            variant="primar"
            disabled={!arkivmappe || arkiverer}
            onClick={async () => {
              setArkiverer(true);
              setArkivMelding(null);
              try {
                const r = await skrivArkiv(skolear);
                setArkivMelding(
                  r === null
                    ? "Ingen mappe valgt."
                    : `${r.skrevet} filer skrevet.` +
                        (r.feil.length > 0 ? ` ${r.feil.length} feilet.` : ""),
                );
              } catch (e) {
                setArkivMelding(String(e));
              } finally {
                setArkiverer(false);
              }
            }}
          >
            {arkiverer ? "Skriver …" : "Skriv arkivet nå"}
          </Knapp>
          {arkivmappe && (
            <code className="truncate text-liten text-blekk-dempet">
              {arkivmappe}
            </code>
          )}
        </div>
        {arkivMelding && (
          <p className="mt-2 text-brod text-blekk-dempet">{arkivMelding}</p>
        )}
      </Bolk>

      <Bolk tittel="Publiser til kalenderserver">
        <p className="mb-3 text-brod text-blekk-dempet">
          Skriver timeplanen til din egen CalDAV-server, ett fag per kalender,
          så elevene kan abonnere på sitt eget fag. Dette er det eneste stedet
          appen sender noe ut (§8.1), og det som går ut er
          <strong className="font-medium">
            {" "}
            fag, tittel, dato, klokkeslett og sted
          </strong>
          . Aldri elevnavn, skåringer eller notater.
        </p>

        <div className="grid max-w-xl gap-3">
          <Felt
            etikett="Adresse til kalendermappa"
            verdi={dav.base}
            settVerdi={(v) => setDav((d) => ({ ...d, base: v }))}
            plassholder="https://framagenda.org/remote.php/dav/calendars/brukernavn"
          />
          <Felt
            etikett="Brukernavn"
            verdi={dav.bruker}
            settVerdi={(v) => setDav((d) => ({ ...d, bruker: v }))}
          />
          <label className="block">
            <span className="mb-1 block text-etikett uppercase tracking-etikett text-blekk-dempet">
              {davHarPassord ? "Passord (lagret i nøkkelringen)" : "Passord"}
            </span>
            <input
              type="password"
              value={davPassord}
              placeholder={
                davHarPassord ? "••••••••" : "App-passord fra serveren"
              }
              onChange={(e) => setDavPassord(e.target.value)}
              className="w-full rounded border border-linje bg-ark px-2 py-1.5 text-brod outline-none focus:border-aksent"
            />
          </label>
          <p className="text-liten text-blekk-dempet">
            Bruk et app-passord, ikke hovedpassordet ditt — da kan du trekke det
            tilbake uten å bytte alt annet. Passordet lagres i systemets
            nøkkelring, aldri i databasen.
          </p>
        </div>

        <label className="mt-4 flex items-center gap-2 text-brod">
          <input
            type="checkbox"
            checked={dav.pa}
            onChange={async (e) => {
              const pa = e.target.checked;
              setDav((d) => ({ ...d, pa }));
              await caldav.lagreOppsett({ pa });
            }}
          />
          Publiser automatisk når jeg endrer en økt
        </label>
        <p className="mb-3 ml-6 text-liten text-blekk-dempet">
          Skjer noen sekunder etter siste endring, og sender bare øktene som
          faktisk er endret.
        </p>

        {/*
          Mentorsamtalene har sin egen bryter, ikke en del av den over: et
          hakk man satte i august skal ikke begynne å sende elevfornavn i
          november (§8.1).
        */}
        <p className="mb-1 mt-5 text-etikett uppercase tracking-etikett text-blekk-dempet">
          Mentorsamtaler
        </p>
        <label className="flex items-center gap-2 text-brod">
          <input
            type="checkbox"
            checked={dav.mentorPa}
            onChange={async (e) => {
              const mentorPa = e.target.checked;
              setDav((d) => ({ ...d, mentorPa }));
              await caldav.lagreOppsett({ mentorPa });
            }}
          />
          Publiser mentorsamtalene, én hendelse per samtale
        </label>
        <p className="ml-6 text-liten text-blekk-dempet">
          Det eneste som går ut er{" "}
          <strong className="font-medium">fornavn og klokkeslett</strong> —
          «Vera kl. 08:30–08:45». Ikke etternavn, ikke klasse, ikke fag, ingen
          beskrivelse. Denne kalenderen bør ikke deles med andre.
        </p>
        {/*
          Feltet står alltid framme, som fagkalenderne — ikke gjemt bak
          avkrysningen over. Man må kunne se hvor noe ville gått før man
          bestemmer seg for å slå det på.
        */}
        <label className="ml-6 mt-2 flex items-center gap-2 text-brod">
          <span className="w-20 shrink-0 font-medium">Kalender</span>
          <input
            value={dav.mentorKalender}
            placeholder="f.eks. mentorsamtaler"
            onChange={(e) =>
              setDav((d) => ({ ...d, mentorKalender: e.target.value }))
            }
            onBlur={async (e) =>
              await caldav.lagreOppsett({ mentorKalender: e.target.value })
            }
            className="w-56 rounded border border-linje bg-ark px-2 py-1 text-brod outline-none focus:border-aksent"
          />
        </label>
        {dav.mentorPa && !dav.mentorKalender.trim() && (
          <p className="ml-6 mt-1 text-liten text-varsel">
            Publiseringen er på, men ingen kalender er satt — ingenting sendes.
          </p>
        )}
        <p className="ml-6 mt-1 text-liten text-blekk-svak">
          Navnet på samlingen slik den heter på serveren, det som står sist i
          adressen. Den må finnes fra før — appen oppretter ikke kalendere, og
          leser aldri noe tilbake (§8.1).
        </p>

        <p className="mb-1 mt-5 text-etikett uppercase tracking-etikett text-blekk-dempet">
          Kalender per fag
        </p>
        <div className="grid max-w-xl gap-1.5">
          {fag.length === 0 ? (
            <p className="text-brod text-blekk-svak">Ingen fag i skoleåret.</p>
          ) : (
            fag.map((f) => (
              <label key={f.id} className="flex items-center gap-2 text-brod">
                <span className="w-20 shrink-0 font-medium">{f.kode}</span>
                <input
                  value={dav.kalendere[f.id] ?? ""}
                  placeholder="tomt = publiseres ikke"
                  onChange={(e) =>
                    setDav((d) => ({
                      ...d,
                      kalendere: { ...d.kalendere, [f.id]: e.target.value },
                    }))
                  }
                  className="flex-1 rounded border border-linje bg-ark px-2 py-1 text-brod outline-none focus:border-aksent"
                />
              </label>
            ))
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Knapp
            onClick={async () => {
              setDavFeil(null);
              setDavMelding(null);
              await caldav.lagreOppsett(dav);
              if (davPassord) {
                await caldav.lagrePassord(davPassord);
                setDavPassord("");
                setDavHarPassord(true);
              }
              setDavMelding("Lagret.");
            }}
          >
            Lagre
          </Knapp>
          <Knapp
            disabled={!dav.base || !dav.bruker}
            onClick={async () => {
              setDavFeil(null);
              setDavMelding(null);
              try {
                // Testen leser passordet fra nøkkelringen, så det du nettopp
                // skrev må lagres først. Ellers testes en gammel verdi, og
                // feilmeldingen peker på feil sted.
                if (davPassord) {
                  await caldav.lagrePassord(davPassord);
                  setDavPassord("");
                  setDavHarPassord(true);
                }
                await caldav.lagreOppsett(dav);
                setDavMelding(await caldav.test(dav.base, dav.bruker));
              } catch (e) {
                setDavFeil(String(e));
              }
            }}
          >
            Test tilkoblingen
          </Knapp>
          <Knapp
            variant="primar"
            disabled={davJobber || !dav.base}
            onClick={async () => {
              setDavJobber(true);
              setDavFeil(null);
              setDavMelding(null);
              try {
                const r = await caldav.publiser(skolear);
                setDavMelding(
                  `${r.skrevet} skrevet, ${r.slettet} fjernet, ` +
                    `${r.uendret} uendret.` +
                    (r.feil.length > 0 ? ` ${r.feil.length} feilet.` : ""),
                );
                if (r.feil.length > 0)
                  setDavFeil(r.feil.slice(0, 3).join("\n"));
              } catch (e) {
                setDavFeil(String(e));
              } finally {
                setDavJobber(false);
              }
            }}
          >
            {davJobber ? "Publiserer …" : "Publiser nå"}
          </Knapp>
          {davHarPassord && (
            <Knapp
              variant="stille"
              onClick={async () => {
                await caldav.glemPassord();
                setDavHarPassord(false);
                setDavMelding("Passordet er slettet fra nøkkelringen.");
              }}
            >
              Glem passordet
            </Knapp>
          )}
        </div>

        {davMelding && (
          <p className="mt-2 text-brod text-lys-gronn">{davMelding}</p>
        )}
        {davFeil && (
          <p className="mt-2 whitespace-pre-wrap text-brod text-feil">
            {davFeil}
          </p>
        )}
      </Bolk>

      <Bolk tittel="Sikkerhetskopi">
        <p className="mb-3 text-brod text-blekk-dempet">
          Det tas en kopi av databasen hver gang appen åpnes, én gang i døgnet.
          De 30 nyeste beholdes. Kopien skrives med SQLites egen
          <code className="mx-1 text-liten">VACUUM INTO</code>, som gir en hel
          database også hvis noe skrives samtidig.
        </p>

        <div className="mb-3 flex items-center gap-3">
          <Knapp
            onClick={async () => {
              setTarKopi(true);
              try {
                await taKopiNa();
                await lastKopier();
              } finally {
                setTarKopi(false);
              }
            }}
            disabled={tarKopi}
          >
            {tarKopi ? "Tar kopi \u2026" : "Ta kopi n\u00e5"}
          </Knapp>
          <Knapp onClick={() => void velgFil()}>Åpne en .sqlite-fil …</Knapp>
          {kopimappe && (
            <button
              onClick={() => void revealItemInDir(kopimappe)}
              className="text-liten text-blekk-dempet underline hover:text-blekk"
            >
              Vis mappa i Finder
            </button>
          )}
        </div>

        {kopier.length === 0 ? (
          <p className="text-brod text-blekk-svak">Ingen kopier ennå.</p>
        ) : (
          <table className="w-full max-w-xl text-brod">
            <tbody>
              {kopier.slice(0, 8).map((k) => (
                <tr key={k.navn} className="border-b border-linje-svak">
                  <td className="py-1 font-mono text-liten">
                    {k.navn}
                    {!k.daglig && (
                      <span className="ml-2 font-sans text-etikett text-blekk-svak">
                        før gjenoppretting
                      </span>
                    )}
                  </td>
                  <td className="w-20 py-1 text-right tabular-nums text-blekk-dempet">
                    {(k.bytes / 1024).toFixed(0)} kB
                  </td>
                  <td className="w-24 py-1 text-right">
                    <button
                      onClick={() =>
                        void gjenopprett(`${kopimappe}/${k.navn}`, k.navn)
                      }
                      className="text-liten text-blekk-dempet hover:text-aksent"
                    >
                      Gjenopprett
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {kopier.length > 8 && (
          <p className="mt-1 text-liten text-blekk-dempet">
            og {kopier.length - 8} eldre — de ligger i mappa
          </p>
        )}

        <p className="mt-3 text-liten text-blekk-dempet">
          Mappa skal aldri legges i iCloud, Dropbox eller annen synktjeneste.
          Synk kan skrive delvis tilbake i ei åpen SQLite-fil, og da blir den
          ødelagt uten forvarsel.
        </p>
      </Bolk>

      <Bolk tittel="Personvern">
        <p className="text-brod text-blekk-dempet">
          Appen gjør ingen nettverkskall. Databasen ligger lokalt i{" "}
          <code className="text-liten">
            ~/Library/Application Support/no.elevtracking.app/
          </code>
          .
        </p>
        <p className="mt-2 text-brod text-blekk-dempet">
          Notatfeltene er lærerens arbeidsmateriale. Helse, hjemmeforhold og
          andre særlige kategorier hører ikke hjemme der.
        </p>
      </Bolk>

      <footer className="mt-10 flex items-center gap-2.5 border-t border-linje pt-4 text-liten text-blekk-dempet">
        <Merke storrelse={20} />
        <span>
          <span className="font-medium text-blekk">Økta</span>
          {versjon && <span className="tabular-nums"> {versjon}</span>}
          {" — undervisningsplanlegging og elevoppfølging."}
        </span>
        <span className="ml-auto">
          Alle data ligger lokalt på denne maskinen.
        </span>
      </footer>
    </div>
  );
}

function Etikett({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-etikett uppercase tracking-etikett text-blekk-dempet">
      {children}
    </span>
  );
}

/**
 * Navnet ditt. Står som faglærer på årsplanen i alle fag, med mindre et fag
 * har fått en annen faglærer i fagpanelet. Lagres mens du skriver.
 */
function Laerernavn() {
  const [navn, setNavn] = useState("");
  useEffect(() => {
    void hentInnstilling(LAERERNAVN).then((v) => setNavn(v ?? ""));
  }, []);
  return (
    <div className="mb-4 max-w-sm">
      <Felt
        etikett="Ditt navn"
        verdi={navn}
        plassholder="Står som faglærer på årsplanen"
        settVerdi={(v) => {
          setNavn(v);
          void settInnstilling(LAERERNAVN, v.trim());
        }}
      />
    </div>
  );
}

function Bolk({
  tittel,
  children,
}: {
  tittel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <h2 className="mb-2 border-b border-linje-medium pb-1 text-etikett uppercase tracking-etikett text-blekk-dempet">
        {tittel}
      </h2>
      {children}
    </section>
  );
}
