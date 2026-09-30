/**
 * PDF-lesing for importen, med pdf.js lagt inn i appen.
 *
 * Ingenting hentes fra nett: biblioteket og arbeideren følger med bygget,
 * og fila leses fra disken. Personvernkravet i §1 gjelder også her — en
 * klasseliste med bilder skal aldri forlate maskinen.
 */
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { Bildeplass, Side } from "./inschool";

export type Pdf = {
  sider: Side[];
  /** klipper ut et bilde som gråtoner, som JPEG data-URL */
  klipp: (side: number, plass: Bildeplass) => Promise<string>;
};

type Matrise = [number, number, number, number, number, number];
const gange = (a: Matrise, b: number[]): Matrise => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];

/** Tekst og bildeplasser per side. Brukes også fra testskript i Node. */
export async function lesSider(doc: pdfjs.PDFDocumentProxy): Promise<Side[]> {
  const sider: Side[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const side = await doc.getPage(p);
    const innhold = await lesTekst(side);
    const tekst = innhold.flatMap((it) =>
      "str" in it && it.str.trim()
        ? [{ x: it.transform[4], y: it.transform[5], str: it.str }]
        : [],
    );

    // Bildene finnes ved å følge transformasjonene i tegneoperasjonene:
    // et bilde tegnes i enhetskvadratet, skalert og flyttet av matrisen.
    const ops = await side.getOperatorList();
    const stakk: Matrise[] = [[1, 0, 0, 1, 0, 0]];
    const bilder: Bildeplass[] = [];
    for (let i = 0; i < ops.fnArray.length; i++) {
      const f = ops.fnArray[i];
      if (f === pdfjs.OPS.save) stakk.push(stakk[stakk.length - 1]);
      else if (f === pdfjs.OPS.restore) stakk.pop();
      else if (f === pdfjs.OPS.transform)
        stakk[stakk.length - 1] = gange(
          stakk[stakk.length - 1],
          ops.argsArray[i] as number[],
        );
      else if (f === pdfjs.OPS.paintImageXObject) {
        const m = stakk[stakk.length - 1];
        bilder.push({ x: m[4], y: m[5], w: m[0], h: m[3] });
      }
    }
    sider.push({ tekst, bilder });
  }
  return sider;
}

type Tekstelement = Awaited<
  ReturnType<pdfjs.PDFPageProxy["getTextContent"]>
>["items"][number];

/**
 * Teksten på en side. `getTextContent` går gjennom en strøm med
 * `for await`, og det kan ikke Safari — som er motoren i appen. Her leses
 * strømmen med en vanlig leser i stedet, som virker overalt.
 */
async function lesTekst(side: pdfjs.PDFPageProxy): Promise<Tekstelement[]> {
  const leser = side.streamTextContent().getReader();
  const ut: Tekstelement[] = [];
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    ut.push(...(value as { items: Tekstelement[] }).items);
  }
  return ut;
}

/** Oppløsningen siden tegnes i før bildene klippes ut. */
const SKALA = 3;
/** Bredden på det lagrede bildet, i piksler. Kornet er en del av looken. */
const BREDDE = 180;

export async function apnePdf(data: Uint8Array): Promise<Pdf> {
  // Arbeideren bundles lokalt av Vite (?url), aldri fra et CDN.
  const { default: arbeider } =
    await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = arbeider;
  const doc = await pdfjs.getDocument({
    data,
    useWorkerFetch: false,
  }).promise;
  const sider = await lesSider(doc);

  // Hver side tegnes én gang, og bildene klippes ut av tegningen.
  const tegnet = new Map<number, Promise<HTMLCanvasElement>>();
  const tegn = (nr: number) => {
    if (!tegnet.has(nr)) {
      tegnet.set(
        nr,
        (async () => {
          const side = await doc.getPage(nr);
          const vp = side.getViewport({ scale: SKALA });
          const lerret = document.createElement("canvas");
          lerret.width = Math.ceil(vp.width);
          lerret.height = Math.ceil(vp.height);
          // «print» tegner hele siden i ett strekk. Standardvalget venter
          // på skjermoppdateringer mellom bitene, og de kommer ikke når
          // vinduet ikke tegnes — da blir importen hengende.
          await side.render({ canvas: lerret, viewport: vp, intent: "print" })
            .promise;
          return lerret;
        })(),
      );
    }
    return tegnet.get(nr)!;
  };

  return {
    sider,
    klipp: async (nr, b) => {
      const side = await tegn(nr);
      const hoyde = side.height / SKALA;
      // Først hele bildefeltet i full oppløsning, så de hvite kantene
      // InSchool legger rundt bildet kan skjæres bort.
      const felt = document.createElement("canvas");
      felt.width = Math.round(b.w * SKALA);
      felt.height = Math.round(b.h * SKALA);
      const f = felt.getContext("2d", { willReadFrequently: true })!;
      f.drawImage(
        side,
        b.x * SKALA,
        (hoyde - b.y - b.h) * SKALA,
        b.w * SKALA,
        b.h * SKALA,
        0,
        0,
        felt.width,
        felt.height,
      );
      const r = innenforKantene(f.getImageData(0, 0, felt.width, felt.height));

      const ut = document.createElement("canvas");
      ut.width = BREDDE;
      ut.height = Math.round((BREDDE * r.h) / r.w);
      const g = ut.getContext("2d")!;
      g.drawImage(felt, r.x, r.y, r.w, r.h, 0, 0, ut.width, ut.height);
      // Gråtoner før lagring: fargen trengs ikke, og looken legges på i
      // visningen (Elevbilde), så den kan endres uten ny import.
      const px = g.getImageData(0, 0, ut.width, ut.height);
      for (let i = 0; i < px.data.length; i += 4) {
        const l =
          0.299 * px.data[i] + 0.587 * px.data[i + 1] + 0.114 * px.data[i + 2];
        px.data[i] = px.data[i + 1] = px.data[i + 2] = l;
      }
      g.putImageData(px, 0, 0);
      return ut.toDataURL("image/jpeg", 0.82);
    },
  };
}

/**
 * Rektangelet innenfor de hvite kantene. En rad eller kolonne regnes som
 * kant når nesten alle pikslene i den er hvite; bildet selv har alltid
 * noe mørkere i seg.
 */
export function innenforKantene(px: {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}): { x: number; y: number; w: number; h: number } {
  const { width: b, height: h, data } = px;
  const hvit = (x: number, y: number) => {
    const i = (y * b + x) * 4;
    return data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240;
  };
  const radHvit = (y: number) => {
    let n = 0;
    for (let x = 0; x < b; x++) if (hvit(x, y)) n++;
    return n > b * 0.97;
  };
  const kolHvit = (x: number, y0: number, y1: number) => {
    let n = 0;
    for (let y = y0; y < y1; y++) if (hvit(x, y)) n++;
    return n > (y1 - y0) * 0.97;
  };
  let topp = 0;
  while (topp < h - 1 && radHvit(topp)) topp++;
  let bunn = h;
  while (bunn > topp + 1 && radHvit(bunn - 1)) bunn--;
  let venstre = 0;
  while (venstre < b - 1 && kolHvit(venstre, topp, bunn)) venstre++;
  let hoyre = b;
  while (hoyre > venstre + 1 && kolHvit(hoyre - 1, topp, bunn)) hoyre--;
  return { x: venstre, y: topp, w: hoyre - venstre, h: bunn - topp };
}
