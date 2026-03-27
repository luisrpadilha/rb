# Master `DATA` Comp Documentation

This file documents **only** how the master `DATA` composition works and which layers/comps are connected to it in this AE twin repository.

## 1) What `DATA` is

`DATA` is the primary control comp for content and logic.
It is a 1-frame comp used as a centralized text/value source that downstream expressions read.

In practice: if text, locale behavior, variant behavior, legal strings, or automation switches are wrong, `DATA` is the first comp to verify.

---

## 2) Master `DATA` layers (source fields)

Main fields exposed by `DATA`:

- `COUNTRY`
- `VARIANT`
- `RHOMBUS VARIANT`
- `PRODUCT NAME`
- `LABEL TYPE`
- `BANDEROLE`
- `FOP`
- `CAL`
- `ARTIFICIALLY FLAVOURED`
- `AUDIO ON/OFF`
- `DISRUPTOR`
- `DISRUPTOR TYPE`
- `DISRUPTOR DEFAULT COLOR`
- `LEGAL DISCLAIMER`
- `LEGAL DISCLAIMER TYPE`
- `V1.2` (version/info layer)
- `sublineFont`, `headlineFont`, `varnish`

These layers are the primary values consumed by automation comps and expressions.

---

## 3) How `DATA` is connected (dependency map)

## A) Direct mirror connection: `DATA-Twin`

`DATA-Twin` (automation comp) reads directly from `DATA` using expressions such as:

- `comp("DATA").layer("COUNTRY")...`
- `comp("DATA").layer("VARIANT")...`
- `comp("DATA").layer("PRODUCT NAME")...`
- `comp("DATA").layer("LABEL TYPE")...`
- `comp("DATA").layer("BANDEROLE")...`
- `comp("DATA").layer("FOP")...`
- `comp("DATA").layer("CAL")...`
- `comp("DATA").layer("ARTIFICIALLY FLAVOURED")...`

This means `DATA-Twin` is a derived view of `DATA`, not an independent source.

## B) Expression-library connection (global logic)

The expression libraries use `DATA` fields as core inputs:

- `expressionLibrary.jsx`
  - reads `COUNTRY`, `VARIANT`, `PRODUCT NAME`, `LABEL TYPE`, `AUDIO ON/OFF`, `DISRUPTOR DEFAULT COLOR`, `SKU`
- `expressionLibraryTwin.jsx`
  - same logic pattern, but against `DATA-Twin`

These library functions drive matching logic (country/variant/product), audio on/off behavior, SF detection, color logic, and text/font behavior.

## C) Automation-part connections

The following parts are directly connected to `DATA` (via expressions):

- `TAB`
  - reads `COUNTRY`, `VARIANT`, `RHOMBUS VARIANT`
- `FLAG`
  - reads `DISRUPTOR`
- `EXTENDED FCO`
  - reads fields like `COUNTRY`, `VARIANT`, `LABEL TYPE`, `FCO`, `CAL`, `ARTIFICIALLY FLAVOURED`
- `MODULAR-LABEL` / `MODULAR-LABEL-TWIN` families
  - heavy usage of `COUNTRY`, `VARIANT`, `PRODUCT NAME`, `LABEL TYPE`, `BANDEROLE`, `FOP`, `CAL`, `ARTIFICIALLY FLAVOURED`

## D) Shot/precomp connections

`DATA` also feeds shot logic in precomp stage:

- `SHOT02`, `SHOT03`, `SHOT04`
  - connected to `DISRUPTOR TYPE` logic
- `0_REDBULL` / `RHOMBUS` precomps
  - connected to variant/rhombus and trademark-driven text behavior

---

## 4) Data flow (single-line view)

`DATA` → (`DATA-Twin`, expression libraries, TAB/FLAG/FCO/MODULAR LABEL parts) → shot precomps (`SHOT02/03/04`) → playout comps.

---

## 5) Operational notes

1. Update values in `DATA` first.
2. Confirm `DATA-Twin` mirrors correctly.
3. Confirm expression libraries are linked (`expressionLibrary.jsx`, `expressionLibraryTwin.jsx`) and JSON data layers are available.
4. Then validate downstream comps (`TAB`, `FLAG`, modular labels, shot precomps, playout).

If downstream behavior is inconsistent, treat `DATA` as the root source and debug outward from it.
