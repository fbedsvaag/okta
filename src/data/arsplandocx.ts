import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IBorderOptions,
} from "docx";
import { formatDato, regnskapstekst, ukedag, type Ark } from "./arsplanark";
import {
  bolktekst,
  kolonner,
  KOLONNENAVN,
  undertittel,
} from "./arsplaneksport";

/**
 * Årsplanarket som Word-dokument.
 *
 * Samme innhold som utskriften, og samme uttrykk som appen: serif i
 * overskriftene, blekkfarge på tekst, aksentfargen på streken under tittelen
 * og tynne linjer mellom radene. Lesbart i svart-hvitt.
 *
 * Brødteksten står i Calibri og ikke i appens Fira Sans. Word har ingen
 * reserveskrift — mangler fonten på maskinen som åpner fila, bytter Word
 * den ut på egen hånd, og da er det bedre å ha valgt selv.
 */

const BLEKK = "241F33";
const DEMPET = "645D7A";
const AKSENT = "4A3D7D";
const LINJE = "D9D4E8";
const SERIF = "Georgia";
const SANS = "Calibri";

/** Halvpunkter, som Word vil ha dem. */
const pt = (n: number) => n * 2;

const ingen: IBorderOptions = {
  style: BorderStyle.NONE,
  size: 0,
  color: "FFFFFF",
};
const tynn: IBorderOptions = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: LINJE,
};
const tykk: IBorderOptions = {
  style: BorderStyle.SINGLE,
  size: 8,
  color: BLEKK,
};

function tekst(
  t: string,
  o: {
    fet?: boolean;
    kursiv?: boolean;
    farge?: string;
    str?: number;
    font?: string;
  } = {},
) {
  return new TextRun({
    text: t,
    // Bare når det gjelder: noen lesere (Pages, textutil) tolker en
    // eksplisitt «ikke fet» som fet.
    bold: o.fet || undefined,
    italics: o.kursiv || undefined,
    color: o.farge ?? BLEKK,
    size: pt(o.str ?? 10),
    font: o.font ?? SANS,
  });
}

function avsnitt(barn: TextRun[], etter = 80, for_ = 0) {
  return new Paragraph({
    children: barn,
    spacing: { before: for_, after: etter },
  });
}

function overskrift(t: string) {
  return new Paragraph({
    children: [tekst(t, { font: SERIF, str: 12.5, farge: AKSENT })],
    spacing: { before: 240, after: 80 },
    keepNext: true,
  });
}

/** Kolonnebredder i prosent. Tema tar det som blir til overs. */
const BREDDE = { uke: 7, dato: 15, lekse: 24, vurdering: 20 } as const;

function tabell(ark: Ark, bolk: Ark["bolker"][number]): Table {
  const kol = kolonner(ark);
  const fast = kol.reduce((s, k) => s + (k === "tema" ? 0 : BREDDE[k]), 0);
  const bredde = (k: (typeof kol)[number]) =>
    k === "tema" ? 100 - fast : BREDDE[k];

  const celle = (innhold: string, k: (typeof kol)[number], hode: boolean) =>
    new TableCell({
      width: { size: bredde(k), type: WidthType.PERCENTAGE },
      borders: {
        top: ingen,
        left: ingen,
        right: ingen,
        bottom: hode ? tykk : tynn,
      },
      margins: { top: 40, bottom: 40, left: 60, right: 60 },
      children: [
        new Paragraph({
          children: [
            tekst(innhold, {
              fet: hode,
              str: hode ? 9 : 10,
              farge: hode ? DEMPET : BLEKK,
            }),
          ],
        }),
      ],
    });

  const hode = new TableRow({
    tableHeader: true,
    children: kol.map((k) => celle(KOLONNENAVN[k], k, true)),
  });

  const rader = bolk.rader.map(
    (r) =>
      new TableRow({
        cantSplit: true,
        children: kol.map((k) =>
          celle(
            {
              uke: String(r.uke),
              dato: `${ukedag(r.dato)} ${formatDato(r.dato)}`,
              tema: r.tema ?? "",
              lekse: r.lekse ?? "",
              vurdering: r.vurderinger.join(", "),
            }[k],
            k,
            false,
          ),
        ),
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: ingen,
      bottom: ingen,
      left: ingen,
      right: ingen,
      insideHorizontal: ingen,
      insideVertical: ingen,
    },
    rows: [hode, ...rader],
  });
}

/** Ett fag per seksjon, så hvert fag begynner på ny side. */
export function lagDocx(ark: Ark[]): Document {
  return new Document({
    creator: ark[0]?.laerer ?? undefined,
    title:
      ark.length === 1
        ? `Årsplan ${ark[0].fagKode} ${ark[0].skolearNavn}`
        : `Årsplan ${ark[0]?.skolearNavn ?? ""}`,
    styles: {
      default: {
        document: { run: { font: SANS, size: pt(10), color: BLEKK } },
      },
    },
    sections: ark.map(seksjon),
  });
}

function seksjon(ark: Ark) {
  const innhold: (Paragraph | Table)[] = [];

  innhold.push(
    new Paragraph({
      children: [
        tekst(`${ark.fagKode} — ${ark.fagNavn}`, { font: SERIF, str: 18 }),
      ],
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 12,
          color: AKSENT,
          space: 4,
        },
      },
      spacing: { after: 120 },
    }),
    avsnitt([tekst(undertittel(ark), { farge: DEMPET })], 40),
    avsnitt([tekst(regnskapstekst(ark.regnskap), { farge: DEMPET })], 120),
  );

  if (ark.arknotat) {
    for (const linje of ark.arknotat.split(/\n+/)) {
      innhold.push(avsnitt([tekst(linje)]));
    }
  }

  if (ark.kompetansemal.length > 0) {
    innhold.push(overskrift("Kompetansemål"));
    for (const m of ark.kompetansemal) {
      innhold.push(
        new Paragraph({
          children: [tekst(m.tekst, { str: 9.5 })],
          bullet: { level: 0 },
          spacing: { after: 20 },
        }),
      );
    }
  } else if (ark.kompetansemalFritekst) {
    innhold.push(overskrift("Kompetansemål"));
    for (const linje of ark.kompetansemalFritekst.split(/\n+/)) {
      innhold.push(avsnitt([tekst(linje, { str: 9.5 })], 20));
    }
  }

  innhold.push(overskrift("Økter"));
  for (const b of ark.bolker) {
    if (b.navn) {
      innhold.push(
        new Paragraph({
          children: [
            tekst(b.navn, { fet: true, str: 10.5 }),
            tekst(`   ${bolktekst(b)}`, { farge: DEMPET, str: 9 }),
          ],
          spacing: { before: 160, after: 40 },
          keepNext: true,
        }),
      );
    }
    innhold.push(tabell(ark, b));
  }

  return {
    properties: {
      page: {
        // 18 mm topp/bunn, 15 mm sider — samme som utskriften.
        margin: { top: 1020, bottom: 1020, left: 850, right: 850 },
      },
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              tekst("Med forbehold om endringer · side ", {
                farge: DEMPET,
                str: 8,
              }),
              new TextRun({
                children: [PageNumber.CURRENT],
                color: DEMPET,
                size: pt(8),
                font: SANS,
              }),
            ],
          }),
        ],
      }),
    },
    children: innhold,
  };
}
