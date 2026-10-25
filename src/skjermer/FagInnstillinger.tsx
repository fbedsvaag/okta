import { useCallback, useEffect, useState } from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import { endreFag, endreFagIAr, hentFagIAr, type FagIAr } from "../data/fag";
import { hentOkter } from "../data/okter";
import { hentVurderingsskalaer } from "../data/vurderinger";
import { hentSkalaer, type Skala } from "../skala";
import { idag } from "../db";
import { Fagfirkant } from "../ui/felles";
import { Fargepalett, bruktAv } from "../ui/Fargevelger";
import { Velger } from "../ui/Velger";

const DAGER = ["ma", "ti", "on", "to", "fr"];
const LENGDER = [45, 60, 75, 90, 120, 135, 180, 240];

/**
 * Faginnstillinger på stedet (ARBEIDSLISTE 29.2, lerretet FagInnstillinger):
 * et smalt ark fra høyre over fagsiden, med det du trenger oftest. Alt
 * lagres med en gang. Resten om faget (årstimer, faglærer, årsplanen,
 * elevene) står i fagkortet, «Alt om faget».
 */
export function FagInnstillinger({
  fagId,
  skolearId,
  onLukk,
  onEndret,
  onAltOmFaget,
}: {
  fagId: string;
  skolearId: string;
  onLukk: () => void;
  /** fagene er endret; appen laster dem på nytt */
  onEndret: () => void;
  onAltOmFaget: () => void;
}) {
  const [fag, setFag] = useState<FagIAr | null>(null);
  const [alle, setAlle] = useState<FagIAr[]>([]);
  const [skalaer, setSkalaer] = useState<Skala[]>([]);
  const [vurderingsskalaer, setVurderingsskalaer] = useState<Skala[]>([]);
  const [fraOkter, setFraOkter] = useState<number[]>([]);

  const last = useCallback(async () => {
    const f = await hentFagIAr(skolearId, true);
    setAlle(f);
    setFag(f.find((x) => x.id === fagId) ?? null);
  }, [fagId, skolearId]);
  useEffect(() => {
    void last();
    void hentSkalaer().then(setSkalaer);
    void hentVurderingsskalaer().then(setVurderingsskalaer);
    // Dagene faget faktisk har økter, når ingenting er satt.
    void hentOkter(skolearId).then((o) =>
      setFraOkter([
        ...new Set(
          o
            .filter((x) => x.skolearFagId === fagId)
            .map(
              (x) => ((new Date(`${x.dato}T12:00:00`).getDay() + 6) % 7) + 1,
            ),
        ),
      ]),
    );
  }, [last, skolearId, fagId]);

  if (!fag) return null;
  const dager = fag.ukedager ?? fraOkter;

  async function lagre(felter: Parameters<typeof endreFagIAr>[1]) {
    await endreFagIAr(fag!.id, felter);
    await last();
    onEndret();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto px-[22px] pb-6 pt-5">
      <div className="flex items-center gap-2.5">
        <Fagfirkant farge={fag.farge} storrelse={12} />
        <b className="text-[16px] font-semibold">{fag.kode}</b>
        <span className="text-liten text-blekk-svak">
          innstillinger for faget
        </span>
        <span className="flex-1" />
        <button
          onClick={onLukk}
          className="h-[30px] rounded-full px-3 text-[13px] text-blekk-dempet hover:bg-flate hover:text-blekk"
        >
          Ferdig
        </button>
      </div>

      <Gruppe>Farge</Gruppe>
      <Fargepalett
        farge={fag.farge}
        brukt={bruktAv(alle, fag.id)}
        onVelg={async (farge) => {
          await endreFag(fag.fagId, { farge });
          await last();
          onEndret();
        }}
      />
      <p className="mt-1.5 text-liten text-blekk-svak">
        Dempet = brukt av et annet fag.
      </p>

      <Gruppe>Økter</Gruppe>
      <Rad navn="Dager">
        <span className="flex gap-1">
          {DAGER.map((d, i) => {
            const pa = dager.includes(i + 1);
            return (
              <button
                key={d}
                aria-pressed={pa}
                onClick={() =>
                  void lagre({
                    ukedager: pa
                      ? dager.filter((x) => x !== i + 1)
                      : [...dager, i + 1],
                  })
                }
                className={`h-[30px] w-[34px] rounded-lg text-[12.5px] transition-colors duration-200 ${
                  pa
                    ? "bg-blekk text-ark"
                    : "text-blekk-dempet shadow-[inset_0_0_0_1px_var(--color-linje)] hover:text-blekk"
                }`}
              >
                {d}
              </button>
            );
          })}
        </span>
      </Rad>
      <Rad navn="Lengde">
        <Velger
          verdi={String(fag.standardVarighetMin ?? "")}
          settVerdi={(v) =>
            void lagre({ standard_varighet_min: v ? Number(v) : null })
          }
          valg={[
            { verdi: "", tekst: "Som i innstillingene", dempet: true },
            ...[
              ...new Set([
                ...LENGDER,
                ...(fag.standardVarighetMin ? [fag.standardVarighetMin] : []),
              ]),
            ]
              .sort((a, b) => a - b)
              .map((m) => ({ verdi: String(m), tekst: `${m} min` })),
          ]}
        />
      </Rad>
      <Rad navn="Rom" hint="brukes av klassekartet">
        <input
          key={fag.rom ?? ""}
          defaultValue={fag.rom ?? ""}
          placeholder="Rom"
          onBlur={(e) => {
            const r = e.target.value.trim() || null;
            if (r !== fag.rom) void lagre({ rom: r });
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="h-[30px] w-40 rounded-lg bg-flate-svak px-2.5 text-[13px] outline-none shadow-[inset_0_0_0_1px_var(--color-linje-svak)] focus:bg-ark focus:shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
        />
      </Rad>

      <Gruppe>Skåring og vurdering</Gruppe>
      <Rad navn="Skåringsskala">
        <Velger
          verdi={fag.skaringsskalaId ?? ""}
          settVerdi={(v) => void lagre({ skaringsskala_id: v || null })}
          valg={[
            { verdi: "", tekst: "Standard (trafikklys)", dempet: true },
            ...skalaer
              .filter((s) => s.bruksomrade !== "vurdering")
              .map((s) => ({ verdi: s.id, tekst: s.navn })),
          ]}
        />
      </Rad>
      <Rad navn="Standard for nye vurderinger">
        <Velger
          verdi={fag.vurderingsskalaId ?? ""}
          settVerdi={(v) => void lagre({ vurderingsskala_id: v || null })}
          valg={[
            {
              verdi: "",
              tekst: vurderingsskalaer[0]?.navn ?? "Første skala",
              dempet: true,
            },
            ...vurderingsskalaer.map((s) => ({ verdi: s.id, tekst: s.navn })),
          ]}
        />
      </Rad>

      <Gruppe>Læreplan</Gruppe>
      <Rad
        navn={
          fag.grepKode ? `${fag.grepKode} · kompetansemål` : "Uten Udir-kode"
        }
        hint={fag.grepKode ? "hentet fra Udir" : "kompetansemål som fritekst"}
      >
        <button
          onClick={onAltOmFaget}
          className="h-[30px] rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate"
        >
          Vis
        </button>
      </Rad>
      <Rad navn="Alt om faget" hint="årstimer, faglærer, elever, årsplanen">
        <button
          onClick={onAltOmFaget}
          className="text-[13px] text-aksent hover:underline"
        >
          Åpne ›
        </button>
      </Rad>

      <div className="mt-3.5 flex min-h-[46px] items-center gap-3 border-t border-linje-svak">
        {fag.arkivert ? (
          <>
            <span className="flex-1 text-[13.5px] text-blekk-dempet">
              Arkivert {fag.arkivert.split("-").reverse().join(".")}
            </span>
            <button
              onClick={() => void lagre({ arkivert: null })}
              className="text-[13px] text-aksent hover:underline"
            >
              Hent tilbake
            </button>
          </>
        ) : (
          <>
            <button
              onClick={async () => {
                if (
                  !(await bekreft(
                    `Arkivere ${fag.kode}? Faget forsvinner fra menyen. Elever, økter og vurderinger blir liggende, og du kan hente det tilbake i Innstillinger → Fag.`,
                  ))
                )
                  return;
                await lagre({ arkivert: idag() });
                onLukk();
              }}
              className="text-[13.5px] text-feil hover:underline"
            >
              Arkiver faget
            </button>
            <span className="text-liten text-blekk-svak">
              Elever og økter blir liggende
            </span>
          </>
        )}
      </div>
      <p className="mt-6 text-liten text-blekk-svak">
        Endringer lagres med en gang. Du blir værende i faget.
      </p>
    </div>
  );
}

function Gruppe({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 mt-5 text-[calc(13px*var(--tekst-skala))] font-semibold text-blekk-dempet">
      {children}
    </div>
  );
}

function Rad({
  navn,
  hint,
  children,
}: {
  navn: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[46px] items-center gap-3 border-t border-linje-svak text-[13.5px]">
      <span className="flex-1">
        {navn}
        {hint && (
          <small className="block text-liten text-blekk-svak">{hint}</small>
        )}
      </span>
      {children}
    </div>
  );
}
