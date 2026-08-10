#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hent_grep.py — henter LK20-læreplaner og kompetansemål fra Udirs Grep-API
og skriver dem til én JSON-fil som pakkes med Elevtracking-appen.

Kjøres på BYGGETIDSPUNKT, ikke fra appen. Appen leser den ferdige JSON-fila
lokalt og gjør ingen nettverkskall. Se §10 i SPEC.md.

Kilde:  https://data.udir.no/kl06/v201906
Lisens: NLOD (Norsk lisens for offentlige data) — tillater kopiering,
        endring, videreformidling og kommersiell bruk.

Bruk:
    python3 hent_grep.py                      # alt, videregående + grunnskole
    python3 hent_grep.py --bare-vgs           # kun videregående opplæring
    python3 hent_grep.py --koder HIS01-03,ENG01-04   # test på noen få først
    python3 hent_grep.py --delay 1.0          # roligere mot API-et

Kun standardbibliotek. Ingen pip install.

MERK om API-nøkler: Udir innførte nøkler for Greps REST-API 1. september 2026,
med rate limiting på anonyme kall (rundt 100 per 60 sekunder). Standard delay
under holder seg under det. Skal du bruke nøkkel, sjekk hvilket header-navn
Udir bruker i wikien deres og fyll inn i API_KEY_HEADER — ikke gjett.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

BASE = "https://data.udir.no/kl06/v201906"
CACHE = ".grep-cache"
API_KEY_HEADER = None  # f.eks. "Ocp-Apim-Subscription-Key" — sjekk Udirs wiki
API_KEY = os.environ.get("GREP_API_KEY")

TAG = re.compile(r"<[^>]+>")
WS = re.compile(r"\s+")


# ---------------------------------------------------------------- henting

def hent(sti, delay, forsok=4):
    """GET mot Grep. Cacher på disk, så avbrutte kjøringer kan gjenopptas."""
    cachefil = os.path.join(CACHE, sti.replace("/", "__") + ".json")
    if os.path.exists(cachefil):
        with open(cachefil, encoding="utf-8") as f:
            return json.load(f)

    url = f"{BASE}/{sti}"
    req = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "User-Agent": "elevtracking-grep-import/1.0",
    })
    if API_KEY and API_KEY_HEADER:
        req.add_header(API_KEY_HEADER, API_KEY)

    ventetid = delay
    for n in range(forsok):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read().decode("utf-8"))
            os.makedirs(CACHE, exist_ok=True)
            with open(cachefil, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False)
            time.sleep(delay)
            return data
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and n < forsok - 1:
                ventetid *= 3
                print(f"    {e.code} på {sti} — venter {ventetid:.0f}s",
                      file=sys.stderr)
                time.sleep(ventetid)
                continue
            raise
        except urllib.error.URLError:
            if n < forsok - 1:
                ventetid *= 3
                time.sleep(ventetid)
                continue
            raise
    return None


# ---------------------------------------------------------------- uttrekk

def tekst(felt, spraak=("nob", "default", "nno")):
    """
    Plukker riktig språkvariant. Grep bruker to former:
      [{"spraak": "nob", "verdi": "..."}]                 (f.eks. kortform)
      {"tekst": [{"spraak": "nob", "verdi": "..."}]}      (f.eks. tittel)
    Returnerer ren tekst uten HTML.
    """
    if felt is None:
        return None
    if isinstance(felt, dict):
        felt = felt.get("tekst")
    if not isinstance(felt, list):
        return None

    etter = {v.get("spraak"): v.get("verdi") for v in felt if isinstance(v, dict)}
    for s in spraak:
        if etter.get(s):
            return rens(etter[s])
    for v in etter.values():
        if v:
            return rens(v)
    return None


def rens(s):
    """Fjerner HTML-tagger og normaliserer mellomrom."""
    return WS.sub(" ", TAG.sub(" ", s)).strip()


def bolker(om, kapittel, liste):
    """
    Overskrift og beskrivelse for hvert punkt i et kapittel.

    Brukes til tverrfaglige temaer og grunnleggende ferdigheter, som har
    samme form: en overskrift og en beskrivelse per punkt.
    """
    kap = om.get(kapittel) or {}
    ut = []
    for p in kap.get(liste, []):
        tittel = tekst((p.get("overskrift") or {}).get("tekst"))
        beskr = rens(tekst((p.get("beskrivelse") or {}).get("tekst")) or "")
        if tittel:
            ut.append({"tittel": tittel, "beskrivelse": beskr or None})
    return ut


def les_laereplan(d):
    """Trekker ut det appen trenger fra én læreplan-detalj."""
    om = d.get("om-faget-kapittel") or {}
    verdier = om.get("fagets-relevans-og-verdier") or {}
    relevans = (verdier.get("fagets-relevans") or {}).get("beskrivelse")
    kjerne = (om.get("kjerneelementer-i-faget") or {}).get("kjerneelementer", [])

    kap = d.get("kompetansemaal-kapittel") or {}
    sett = [s.get("kode") for s in kap.get("kompetansemaalsett", [])
            if s.get("kode")]

    return {
        "kode": d.get("kode"),
        "utgaatt": "status_utgaatt" in (d.get("status") or ""),
        "navn": tekst(d.get("kortform")) or tekst(d.get("tittel")),
        "tittel": tekst(d.get("tittel")),
        "fagtype": [f.get("tittel") for f in d.get("fagtype", [])],
        # MERK: på opplæringsfag er dette ETT objekt, ikke en liste — i
        # motsetning til på læreplanen, der det er en liste. Grep er ikke
        # konsekvent, så begge former må tas høyde for.
        "nivaa": nivaaliste(d.get("opplaeringsnivaa")),
        "beskrivelse": rens(tekst(relevans) or "") or None,
        "kjerneelementer": [k.get("tittel") for k in kjerne if k.get("tittel")],
        "tverrfaglige": bolker(om, "tverrfaglige-temaer-i-faget",
                               "tverrfaglige-temaer"),
        "ferdigheter": bolker(om, "grunnleggende-ferdigheter-i-faget",
                              "grunnleggende-ferdigheter"),
        "sett_koder": sett,
    }


def les_maalsett(d):
    """Trekker ut ett kompetansemålsett med målene i."""
    return {
        "kode": d.get("kode"),
        "tittel": tekst(d.get("kortform")) or tekst(d.get("tittel")),
        "rekkefolge": d.get("rekkefoelge"),
        "aarstrinn": [a.get("kode") for a in d.get("etter-aarstrinn", [])],
        "etter_fag": [x.get("kode") for x in d.get("etter-fag", []) if x.get("kode")],
        "kompetansemaal": [
            {"kode": m.get("kode"), "tekst": rens(m.get("tittel", ""))}
            for m in d.get("kompetansemaal", []) if m.get("kode")
        ],
    }


# ---------------------------------------------------------------- kjøring

def nivaaliste(v):
    """Opplæringsnivå, enten det kommer som objekt eller liste."""
    if v is None:
        return []
    if isinstance(v, dict):
        return [v.get("tittel")]
    return [x.get("tittel") for x in v if isinstance(x, dict)]


def les_fagkode(d):
    """
    Timetallet for faget, slik det står på fagkoden.

    `omfang-totalt` er årstimetallet Udir oppgir — 140 for SAM3046. Det er
    tallet timeregnskapet i appen måles mot, så det spares for læreren å
    slå det opp manuelt.
    """
    omfang = d.get("omfang-totalt")
    try:
        timer = int(omfang) if omfang not in (None, "") else None
    except (TypeError, ValueError):
        timer = None
    return {"timer": timer}


def les_opplaeringsfag(d):
    """Fagkoden læreren kjenner igjen, f.eks. SAM3045."""
    ref = d.get("fagkode-referanser") or []
    gyldige = [r for r in ref
               if not (r.get("gyldighet") or {}).get("gyldig-til")]
    valgt = gyldige[0] if gyldige else (ref[0] if ref else None)
    return {
        "opplaeringsfag": d.get("kode"),
        "fagkode": (valgt or {}).get("kode"),
        "navn": tekst(d.get("tittel")),
        # MERK: på opplæringsfag er dette ETT objekt, ikke en liste — i
        # motsetning til på læreplanen, der det er en liste. Grep er ikke
        # konsekvent, så begge former må tas høyde for.
        "nivaa": nivaaliste(d.get("opplaeringsnivaa")),
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--ut", default="grep-fag.json")
    p.add_argument("--delay", type=float, default=0.7,
                   help="sekunder mellom kall (standard 0.7 ≈ 85/min)")
    p.add_argument("--bare-vgs", action="store_true",
                   help="kun læreplaner for videregående opplæring")
    p.add_argument("--koder", help="kommaseparert liste, for testkjøring")
    a = p.parse_args()

    print("Henter liste over LK20-læreplaner …")
    liste = hent("laereplaner-lk20", a.delay)
    koder = [l["kode"] for l in liste if l.get("kode")]

    if a.koder:
        onsket = {k.strip() for k in a.koder.split(",")}
        koder = [k for k in koder if k in onsket]

    print(f"{len(koder)} læreplaner. Henter detaljer …")

    fag, sett_cache = [], {}
    for i, kode in enumerate(koder, 1):
        try:
            lp = les_laereplan(hent(f"laereplaner-lk20/{kode}", a.delay))
        except Exception as e:
            print(f"  [{i}/{len(koder)}] {kode}: FEIL — {e}", file=sys.stderr)
            continue

        if a.bare_vgs and not any(
                "ideregående" in (n or "") for n in lp["nivaa"]):
            continue

        maalsett = []
        for sk in lp.pop("sett_koder"):
            if sk not in sett_cache:
                try:
                    sett_cache[sk] = les_maalsett(
                        hent(f"kompetansemaalsett-lk20/{sk}", a.delay))
                except Exception as e:
                    print(f"      {sk}: FEIL — {e}", file=sys.stderr)
                    continue
            maalsett.append(sett_cache[sk])

        maalsett.sort(key=lambda s: s.get("rekkefolge") or 0)
        lp["maalsett"] = maalsett
        fag.append(lp)

        antall = sum(len(s["kompetansemaal"]) for s in maalsett)
        print(f"  [{i}/{len(koder)}] {kode} — {lp['navn']} "
              f"({len(maalsett)} sett, {antall} mål)")

    # Fra målsett til fag. Læreren tenker i fag — «Markedsføring og ledelse 1»
    # med sin egen SAM-kode — ikke i læreplanen MFL01-04 som er paraplyen over
    # både MFL1 og MFL2. Kompetansemålene er unike per fag, så det er faget
    # som skal være oppslagsnøkkelen.
    print("\nKobler målsett til fag …")
    # Utgåtte læreplaner hoppes over. Et fag lever ofte i to versjoner —
    # MFL01-03 og MFL01-04 for markedsføring — og tas begge med, får faget
    # målene sine i dobbelt opp med ulike koder og lik tekst.
    fagkart = {}
    for lp in fag:
        if lp.get("utgaatt"):
            continue
        for s in lp["maalsett"]:
            for of in s.get("etter_fag", []):
                fagkart.setdefault(of, []).append((lp, s))

    print(f"{len(fagkart)} opplæringsfag. Henter fagkodene …")
    fagliste = []
    for i, (ofkode, treff) in enumerate(sorted(fagkart.items()), 1):
        try:
            info = les_opplaeringsfag(hent(f"opplaeringsfag/{ofkode}", a.delay))
        except Exception as e:
            print(f"  [{i}/{len(fagkart)}] {ofkode}: FEIL — {e}", file=sys.stderr)
            continue
        if a.bare_vgs and not any("ideregående" in (n or "") for n in info["nivaa"]):
            continue

        # Timetallet ligger på fagkoden, ikke på opplæringsfaget, så det
        # koster ett kall til. Verdt det: uten det må læreren slå opp 140
        # timer for hånd i et skjema som ellers fyller seg selv.
        timer = None
        if info["fagkode"]:
            try:
                timer = les_fagkode(
                    hent(f"fagkoder/{info['fagkode']}", a.delay))["timer"]
            except Exception as e:
                print(f"      {info['fagkode']}: FEIL — {e}", file=sys.stderr)

        maal, sett_navn = [], []
        for lp, s in treff:
            sett_navn.append(s["tittel"])
            maal.extend(s["kompetansemaal"])
        fagliste.append({
            "fagkode": info["fagkode"],
            "opplaeringsfag": ofkode,
            "navn": info["navn"],
            "timer": timer,
            "laereplan": treff[0][0]["kode"],
            "laereplannavn": treff[0][0]["navn"],
            "beskrivelse": treff[0][0]["beskrivelse"],
            "kjerneelementer": treff[0][0]["kjerneelementer"],
            "tverrfaglige": treff[0][0]["tverrfaglige"],
            "ferdigheter": treff[0][0]["ferdigheter"],
            "kompetansemaal": maal,
        })
        if i % 50 == 0:
            print(f"  [{i}/{len(fagkart)}] …")

    ut = {
        "kilde": BASE,
        "lisens": "NLOD — https://data.norge.no/nlod/no/2.0",
        "hentet": time.strftime("%Y-%m-%d"),
        "antall_fag": len(fagliste),
        "fag": sorted(fagliste, key=lambda f: (f["navn"] or "")),
    }
    with open(a.ut, "w", encoding="utf-8") as f:
        json.dump(ut, f, ensure_ascii=False, indent=1)

    mål = sum(len(x["kompetansemaal"]) for x in fagliste)
    kb = os.path.getsize(a.ut) / 1024
    print(f"\nSkrev {a.ut}: {len(fagliste)} fag, {mål} kompetansemål, {kb:.0f} kB")
    print(f"Cache i {CACHE}/ — slett den for å hente på nytt.")


if __name__ == "__main__":
    main()
