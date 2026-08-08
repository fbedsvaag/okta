import { describe, expect, it } from "vitest";
import { lagHendelse, lagIcal } from "./ical";
import type { Okt } from "./okter";
import type { Periode } from "./perioder";

function okt(over: Partial<Okt> = {}): Okt {
  return {
    id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    kode: "2608-MFL1-1",
    skolearFagId: "sf1",
    fagKode: "MFL1",
    fagNavn: "Markedsføring og ledelse 1",
    farge: "#2f5d8a",
    periodeId: null,
    dato: "2026-08-17",
    klokkeslett: "09:15",
    varighetMin: 180,
    tema: "Markedsanalyse",
    sted: "R204",
    endret: "2026-08-07T14:03:22",
    plan: "HEMMELIG PLAN",
    logg: "HEMMELIG LOGG",
    skaret: 0,
    elever: 0,
    gronn: 0,
    gul: 0,
    rod: 0,
    ...over,
  };
}

/**
 * MERK: tidspunkttestene under forutsetter at maskinen står i norsk tid.
 * Det er med vilje — appen bruker systemets lokale tid (§12), og den kjører
 * på lærerens egen Mac. Kjøres testene i en annen tidssone, feiler de på
 * forventet UTC-verdi uten at koden er feil.
 */
const NA = new Date("2026-08-07T12:00:00Z");
const TOM = new Map<string, Periode>();

describe("lagIcal", () => {
  it("lager en gyldig ramme", () => {
    const s = lagIcal([okt()], TOM, "2026/27", NA);
    expect(s.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(s.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(s).toContain("VERSION:2.0");
    expect(s).toContain("X-WR-CALNAME:2026/27");
  });

  it("bruker øktas UUID som UID, så en flyttet økt oppdateres", () => {
    const s = lagIcal([okt()], TOM, "2026/27", NA);
    expect(s).toContain("UID:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee@elevtracking");
  });

  it("regner lokal tid om til UTC og legger varigheten til slutten", () => {
    // 09:15 norsk sommertid = 07:15Z. 180 minutter gir 10:15Z.
    const s = lagIcal([okt()], TOM, "2026/27", NA);
    expect(s).toContain("DTSTART:20260817T071500Z");
    expect(s).toContain("DTEND:20260817T101500Z");
  });

  it("håndterer vintertid uten egen tidssonetabell", () => {
    // 1. desember er normaltid, altså UTC+1: 09:15 blir 08:15Z.
    const s = lagIcal([okt({ dato: "2026-12-01" })], TOM, "2026/27", NA);
    expect(s).toContain("DTSTART:20261201T081500Z");
  });

  it("gjør økter uten klokkeslett til heldagshendelser", () => {
    const s = lagIcal([okt({ klokkeslett: null })], TOM, "2026/27", NA);
    expect(s).toContain("DTSTART;VALUE=DATE:20260817");
    expect(s).not.toContain("DTSTART:2026");
  });

  it("lar heldagshendelser slutte dagen etter, ikke samme dag", () => {
    // DTEND er eksklusiv for datoverdier. Lik start og slutt er ugyldig,
    // og Sabre svarer 415 på det.
    const s = lagIcal([okt({ klokkeslett: null })], TOM, "x", NA);
    expect(s).toContain("DTEND;VALUE=DATE:20260818");
  });

  it("skriver fag og tema i sammendraget", () => {
    const s = lagIcal([okt()], TOM, "2026/27", NA);
    expect(s).toContain("SUMMARY:MFL1 — Markedsanalyse");
  });

  it("faller tilbake til bare fagkoden uten tema", () => {
    const s = lagIcal([okt({ tema: null })], TOM, "2026/27", NA);
    expect(s).toContain("SUMMARY:MFL1");
  });

  it("slipper aldri ut plan, logg eller andre arbeidsnotater", () => {
    const s = lagIcal([okt()], TOM, "2026/27", NA);
    expect(s).not.toContain("HEMMELIG");
  });

  it("tar med periodenavnet når økta ligger i en periode", () => {
    const p = new Map<string, Periode>([
      [
        okt().id,
        {
          id: "p1",
          skolearFagId: "sf1",
          navn: "Grunnleggende marked",
          rekkefolge: 10,
          start: null,
          slutt: null,
          kompetansemal: null,
          notat: null,
        },
      ],
    ]);
    expect(lagIcal([okt()], p, "2026/27", NA)).toContain(
      "DESCRIPTION:Grunnleggende marked",
    );
  });

  it("escaper tegn som ellers ville brutt formatet", () => {
    const s = lagIcal([okt({ tema: "Salg; markedsføring, del 1" })], TOM, "x", NA);
    expect(s).toContain("SUMMARY:MFL1 — Salg\\; markedsføring\\, del 1");
  });

  it("bretter lange linjer på 75 oktetter, med mellomrom foran fortsettelsen", () => {
    const s = lagIcal([okt({ tema: "æ".repeat(80) })], TOM, "x", NA);
    for (const linje of s.split("\r\n")) {
      expect(new TextEncoder().encode(linje).length).toBeLessThanOrEqual(75);
    }
    expect(s).toContain("\r\n ");
  });

  it("deler aldri et flerbytetegn mellom to linjer", () => {
    const s = lagIcal([okt({ tema: "æøå".repeat(40) })], TOM, "x", NA);
    // Klarer vi å lese det tilbake uten erstatningstegn, er ingen tegn delt.
    const sammensatt = s
      .split("\r\n")
      .map((l) => (l.startsWith(" ") ? l.slice(1) : `\n${l}`))
      .join("");
    expect(sammensatt).not.toContain("�");
    expect(sammensatt).toContain("æøå".repeat(40));
  });

  it("bruker øktas endringstid som DTSTAMP, ikke klokka nå", () => {
    // Samme økt skal gi identisk utdata uansett når den publiseres — det er
    // dét som lar publiseringen se hvilke økter som faktisk er endret.
    const a = lagIcal([okt()], TOM, "x", new Date("2026-01-01T00:00:00Z"));
    const b = lagIcal([okt()], TOM, "x", new Date("2027-06-06T00:00:00Z"));
    expect(a).toBe(b);
    expect(a).toContain("DTSTAMP:20260807T120322Z");
  });

  it("tar med sted som LOCATION", () => {
    expect(lagIcal([okt()], TOM, "x", NA)).toContain("LOCATION:R204");
  });

  it("hopper over LOCATION når stedet ikke er satt", () => {
    expect(lagIcal([okt({ sted: null })], TOM, "x", NA)).not.toContain("LOCATION");
  });

  it("holder METHOD utenfor CalDAV-ressursen", () => {
    // RFC 4791: en kalenderressurs som legges med PUT skal ikke ha METHOD.
    // Sabre håndhever det og svarer 415. Strømmen skal derimot ha den.
    expect(lagHendelse(okt(), null, NA)).not.toContain("METHOD");
    expect(lagIcal([okt()], TOM, "x", NA)).toContain("METHOD:PUBLISH");
  });

  it("tar ikke med kalenderegenskaper i en enkelthendelse", () => {
    const s = lagHendelse(okt(), null, NA);
    expect(s).not.toContain("X-WR-CALNAME");
    expect(s).not.toContain("REFRESH-INTERVAL");
    expect(s).toContain("BEGIN:VEVENT");
  });

  it("lager én hendelse per økt", () => {
    const s = lagIcal(
      [okt(), okt({ id: "22222222-bbbb-4ccc-8ddd-eeeeeeeeeeee" })],
      TOM,
      "x",
      NA,
    );
    expect(s.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});
