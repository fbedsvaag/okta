import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const {
  finnEllerOpprettKlasse,
  hentElever,
  opprettElev,
  opprettElevMed,
  passerFagfilter,
  frakobleFag,
  koblePaFag,
  settKlasse,
  settMentor,
  settMentorFor,
  slettEleverIAr,
  tellEleverIAr,
  tellSkaringerIFag,
} = await import("./elever");
const { leggFagIAr } = await import("./fag");
const { opprettOkt, settSkaring } = await import("./okter");
const { opprettSkolear } = await import("./skolear");

let skolearId = "";

beforeEach(async () => {
  base.nullstill();
  skolearId = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
});

async function elevIKlasse(fornavn: string, klasse: string): Promise<string> {
  const id = await opprettElev(fornavn, "Soprano");
  await settKlasse(
    id,
    skolearId,
    await finnEllerOpprettKlasse(skolearId, klasse),
  );
  return id;
}

describe("mentorgruppa", () => {
  it("er av som standard for en elev i en klasse", async () => {
    await elevIKlasse("Tony", "1STC");
    const [elev] = await hentElever(skolearId);
    expect(elev.mentor).toBe(false);
  });

  it("merker bare de elevene som faktisk er mine", async () => {
    // Poenget med gruppa: seksten av trettito i klassen er dine.
    const tony = await elevIKlasse("Tony", "1STC");
    await elevIKlasse("Carmela", "1STC");

    expect(await settMentor(tony, skolearId, true)).toBe(true);

    const elever = await hentElever(skolearId);
    expect(elever.filter((e) => e.mentor).map((e) => e.fornavn)).toEqual([
      "Tony",
    ]);
  });

  it("lar merket fjernes igjen", async () => {
    const tony = await elevIKlasse("Tony", "1STC");
    await settMentor(tony, skolearId, true);
    await settMentor(tony, skolearId, false);

    const [elev] = await hentElever(skolearId);
    expect(elev.mentor).toBe(false);
  });

  it("sier fra når eleven ikke har en klasse å henge merket på", async () => {
    // Flagget ligger på klassekoblingen, så uten klasse finnes det ingen rad
    // å merke. Da skal kallet si fra framfor å forsvinne i stillhet.
    const uten = await opprettElev("Jennifer", "Melfi");
    expect(await settMentor(uten, skolearId, true)).toBe(false);
  });

  it("mister merket når klassen fjernes", async () => {
    const tony = await elevIKlasse("Tony", "1STC");
    await settMentor(tony, skolearId, true);
    await settKlasse(tony, skolearId, null);

    const [elev] = await hentElever(skolearId);
    expect(elev.mentor).toBe(false);
  });

  it("gjelder ett skoleår om gangen", async () => {
    // Neste år er det en annen gruppe, og fjorårets skal stå urørt.
    const tony = await elevIKlasse("Tony", "1STC");
    await settMentor(tony, skolearId, true);

    const nesteAr = await opprettSkolear("2027/28", "2027-08-16", "2028-06-19");
    await settKlasse(
      tony,
      nesteAr,
      await finnEllerOpprettKlasse(nesteAr, "2STC"),
    );

    expect((await hentElever(skolearId))[0].mentor).toBe(true);
    expect((await hentElever(nesteAr))[0].mentor).toBe(false);
  });
});

describe("mentormerket for mange (valglinja)", () => {
  it("setter og fjerner merket for alle valgte, og hopper over elever uten klasse", async () => {
    const a = await elevIKlasse("Tony", "1STC");
    const b = await elevIKlasse("Carmela", "1STC");
    const uten = await opprettElev("Paulie", "Gualtieri");

    expect(await settMentorFor([a, b, uten], skolearId, true)).toBe(2);
    let mentor = (await hentElever(skolearId)).filter((e) => e.mentor);
    expect(mentor.map((e) => e.id).sort()).toEqual([a, b].sort());

    expect(await settMentorFor([a, b], skolearId, false)).toBe(2);
    mentor = (await hentElever(skolearId)).filter((e) => e.mentor);
    expect(mentor).toEqual([]);
  });
});

describe("elever uten fag", () => {
  it("vises i oversikten så lenge de har en klasse", async () => {
    // Det vanlige mentortilfellet: du er mentor for elever du ikke
    // underviser. De har ingen fagkobling, og skal likevel stå i lista.
    await elevIKlasse("Tony", "1STC");
    const elever = await hentElever(skolearId);

    expect(elever).toHaveLength(1);
    expect(elever[0].fagKoder).toEqual([]);
  });
});

describe("frakobling av fag", () => {
  it("lar skåringene ligge, og henter dem fram igjen ved ny kobling", async () => {
    // Dette er garantien som gjør at en feilkobling kan rettes uten frykt:
    // frakobling rører ikke skåringene, og elev_fag-raden gjenbrukes (§12),
    // så heatmapet er uendret etter en runde ut og inn.
    const elevId = await opprettElev("Tony", "Soprano");
    const fagId = await leggFagIAr(skolearId, "MFL1", "Markedsføring", null);
    await koblePaFag(elevId, fagId);

    const oktId = await opprettOkt(fagId, "MFL1", "2026-09-01", null, 180);
    const gronn = "5ca1ade1-0001-4000-8000-000000000004";
    await settSkaring(elevId, oktId, gronn);

    expect(await tellSkaringerIFag(elevId, fagId)).toBe(1);

    await frakobleFag(elevId, fagId);
    expect(await tellSkaringerIFag(elevId, fagId)).toBe(1);
    expect((await hentElever(skolearId))[0].fagKoder).toEqual([]);

    await koblePaFag(elevId, fagId);
    expect((await hentElever(skolearId))[0].fagKoder).toEqual(["MFL1"]);
    expect(await tellSkaringerIFag(elevId, fagId)).toBe(1);
  });

  it("lager ikke en ny rad når eleven kobles til igjen", async () => {
    const elevId = await opprettElev("Carmela", "Soprano");
    const fagId = await leggFagIAr(skolearId, "ENG1", "Engelsk", null);

    await koblePaFag(elevId, fagId);
    await frakobleFag(elevId, fagId);
    await koblePaFag(elevId, fagId);

    const rader = await base.select<{ n: number }[]>(
      "SELECT COUNT(*) AS n FROM elev_fag WHERE elev_id = $1",
      [elevId],
    );
    expect(rader[0].n).toBe(1);
  });
});

describe("passerFagfilter", () => {
  const eleven = ["mfl1", "eng1", "kro"];

  it("slipper alle gjennom når ingenting er valgt", () => {
    expect(passerFagfilter([], new Set(), "alle")).toBe(true);
    expect(passerFagfilter(eleven, new Set(), "minstEtt")).toBe(true);
  });

  it("krever samtlige fag i «alle»", () => {
    // Det er dette spørsmålet filteret finnes for: hvem har både MFL1 og ENG1.
    expect(passerFagfilter(eleven, new Set(["mfl1", "eng1"]), "alle")).toBe(
      true,
    );
    expect(passerFagfilter(eleven, new Set(["mfl1", "ebu1"]), "alle")).toBe(
      false,
    );
  });

  it("krever bare ett fag i «minst ett»", () => {
    expect(passerFagfilter(eleven, new Set(["mfl1", "ebu1"]), "minstEtt")).toBe(
      true,
    );
    expect(passerFagfilter(eleven, new Set(["ebu1", "sam1"]), "minstEtt")).toBe(
      false,
    );
  });

  it("betyr det samme for begge modus når ett fag er valgt", () => {
    for (const modus of ["alle", "minstEtt"] as const) {
      expect(passerFagfilter(eleven, new Set(["mfl1"]), modus)).toBe(true);
      expect(passerFagfilter(eleven, new Set(["ebu1"]), modus)).toBe(false);
    }
  });

  it("holder en elev uten fag utenfor når noe er valgt", () => {
    expect(passerFagfilter([], new Set(["mfl1"]), "alle")).toBe(false);
    expect(passerFagfilter([], new Set(["mfl1"]), "minstEtt")).toBe(false);
  });
});

describe("ny elev i én transaksjon (19.1)", () => {
  it("lagrer elev, klasse, fag og mentorflagg samlet", async () => {
    const klasse = await finnEllerOpprettKlasse(skolearId, "3STB");
    const his = await leggFagIAr(skolearId, "HIS3", "Historie", null);
    const nor = await leggFagIAr(skolearId, "NOR3", "Norsk", null);
    const id = await opprettElevMed({
      fornavn: "Anne Marie",
      etternavn: "van der Berg",
      skolearId,
      klasseId: klasse,
      fagIder: [his, nor, his],
      mentor: true,
    });
    const [e] = (await hentElever(skolearId)).filter((x) => x.id === id);
    expect(e).toMatchObject({
      fornavn: "Anne Marie",
      etternavn: "van der Berg",
      klasseNavn: "3STB",
      mentor: true,
    });
    expect([...e.fagIder].sort()).toEqual([his, nor].sort());
  });

  it("lagrer ingenting når et steg feiler", async () => {
    const for_ = (await hentElever(skolearId)).length;
    await expect(
      opprettElevMed({
        fornavn: "Ada",
        etternavn: "Berg",
        skolearId,
        klasseId: "finnes-ikke",
        fagIder: [],
        mentor: false,
      }),
    ).rejects.toThrow();
    expect(await hentElever(skolearId)).toHaveLength(for_);
  });
});

describe("slett elevene fra et tidligere år (23.9)", () => {
  it("tar elevene og skåren fra året, men lar fag, økter og andre år stå", async () => {
    const gronn = "5ca1ade1-0001-4000-8000-000000000004";
    const fjor = await opprettSkolear("2025/26", "2025-08-18", "2026-06-19");
    const fjorFag = await leggFagIAr(fjor, "MFL1", "Markedsføring", null);
    const fjorOkt = await opprettOkt(fjorFag, "MFL1", "2025-09-01", null, 90);
    const iarFag = await leggFagIAr(skolearId, "MFL2", "Markedsføring 2", null);
    const iarOkt = await opprettOkt(iarFag, "MFL2", "2026-09-01", null, 90);

    // Tony gikk i fjor og går i år, Paulie bare i fjor.
    const tony = await opprettElev("Tony", "Soprano");
    const paulie = await opprettElev("Paulie", "Gualtieri");
    for (const e of [tony, paulie]) {
      await koblePaFag(e, fjorFag);
      await settKlasse(e, fjor, await finnEllerOpprettKlasse(fjor, "1STA"));
      await settSkaring(e, fjorOkt, gronn);
    }
    await koblePaFag(tony, iarFag);
    await settSkaring(tony, iarOkt, gronn);

    expect(await tellEleverIAr(fjor)).toMatchObject({
      elever: 2,
      helt: 1,
      skaringer: 2,
    });

    await slettEleverIAr(fjor);

    const levende = await base.select<{ id: string }[]>(
      "SELECT id FROM elev WHERE slettet IS NULL",
    );
    expect(levende.map((r) => r.id)).toEqual([tony]);
    expect(await tellSkaringerIFag(tony, fjorFag)).toBe(0);
    expect(await tellSkaringerIFag(tony, iarFag)).toBe(1);
    expect((await hentElever(fjor)).length).toBe(0);
    expect((await hentElever(skolearId)).map((e) => e.id)).toEqual([tony]);

    // Fag og økter i fjor står.
    const [okt] = await base.select<{ slettet: string | null }[]>(
      "SELECT slettet FROM okt WHERE id = $1",
      [fjorOkt],
    );
    expect(okt.slettet).toBeNull();
    const [fag] = await base.select<{ slettet: string | null }[]>(
      "SELECT slettet FROM skolear_fag WHERE id = $1",
      [fjorFag],
    );
    expect(fag.slettet).toBeNull();
  });
});
