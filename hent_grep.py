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


def les_laereplan(d):
    """Trekker ut det appen trenger fra én læreplan-detalj."""
    om = d.get("om-faget-kapittel") or {}
    verdier = om.get("fagets-relevans-og-verdier") or {}
    relevans = (verdier.get("fagets-relevans") or {}).get("beskrivelse")

    kap = d.get("kompetansemaal-kapittel") or {}
    sett = [s.get("kode") for s in kap.get("kompetansemaalsett", [])
            if s.get("kode")]

    return {
        "kode": d.get("kode"),
        "navn": tekst(d.get("kortform")) or tekst(d.get("tittel")),
        "tittel": tekst(d.get("tittel")),
        "fagtype": [f.get("tittel") for f in d.get("fagtype", [])],
        "nivaa": [n.get("tittel") for n in d.get("opplaeringsnivaa", [])],
        "beskrivelse": tekst(relevans),
        "sett_koder": sett,
    }


def les_maalsett(d):
    """Trekker ut ett kompetansemålsett med målene i."""
    return {
        "kode": d.get("kode"),
        "tittel": tekst(d.get("kortform")) or tekst(d.get("tittel")),
        "rekkefolge": d.get("rekkefoelge"),
        "aarstrinn": [a.get("kode") for a in d.get("etter-aarstrinn", [])],
        "kompetansemaal": [
            {"kode": m.get("kode"), "tekst": rens(m.get("tittel", ""))}
            for m in d.get("kompetansemaal", []) if m.get("kode")
        ],
    }


# ---------------------------------------------------------------- kjøring

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

    ut = {
        "kilde": BASE,
        "lisens": "NLOD — https://data.norge.no/nlod/no/2.0",
        "hentet": time.strftime("%Y-%m-%d"),
        "antall_fag": len(fag),
        "fag": sorted(fag, key=lambda f: f["kode"]),
    }
    with open(a.ut, "w", encoding="utf-8") as f:
        json.dump(ut, f, ensure_ascii=False, indent=1)

    mål = sum(len(s["kompetansemaal"]) for x in fag for s in x["maalsett"])
    kb = os.path.getsize(a.ut) / 1024
    print(f"\nSkrev {a.ut}: {len(fag)} fag, {mål} kompetansemål, {kb:.0f} kB")
    print(f"Cache i {CACHE}/ — slett den for å hente på nytt.")


if __name__ == "__main__":
    main()
