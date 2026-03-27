# Templater Effect Dependency Map (for Google Drive Sheets bot rendering)

This document explains **which scripts** and **which compositions (comps)** are required so the `Templater Settings (TMPL_Settings)` effect can be populated reliably when your bot renders from Google Drive Sheets.

---

## 1) Critical scripts / data files

There are no standalone ingest scripts in this repository for Google Sheets API calls, so the bot-side fetch logic is expected to live outside this repo.

Inside this AE-template mirror, the important logic files are:

1. `01_SETUP/AUTOMATION/02_PARTS/_DATA/expressionLibrary.jsx`
   - Main shared expression function library used across automation and playout logic.
   - Handles variant/country/product checks, label color logic, font mapping, etc.

2. `01_SETUP/AUTOMATION/02_PARTS/_DATA/expressionLibraryTwin.jsx`
   - Twin variant of the same logic, referencing `DATA-Twin` style workflow.

3. `01_SETUP/AUTOMATION/02_PARTS/_DATA/labelData.json`
   - Label-rule data used by expression logic.

4. `01_SETUP/AUTOMATION/02_PARTS/_DATA/countryData.json`
   - Country/script/font mapping data used by typography expressions.

### Why these are important for Templater
`TMPL_Settings` fills layer values, but downstream visibility/layout behavior still depends on expression decisions. If these files are missing or not linked, injected values can appear to “fail” because expressions can hide or restyle layers unexpectedly.

---

## 2) Most important comps for Templater input

## A) `DATA` (primary ingest comp)
**File:** `01_SETUP/01_SETUP Content.txt`

This is the primary target comp where most text fields have `Templater Settings (TMPL_Settings)` and are intended for data injection.

Templater-enabled fields in `DATA` include:
- `SUBLINE`
- `HEADLINE`
- `VBAM`
- `VBAM TRADEMARK`
- `DISRUPTOR DEFAULT COLOR`
- `DISRUPTOR TYPE`
- `DISRUPTOR`
- `LEGAL DISCLAIMER`
- `LEGAL DISCLAIMER TYPE`
- `FCO`
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

### Bot mapping recommendation
Make your Google Sheet column names match these layer names exactly (or keep a strict mapping table in the bot). Name mismatches are the most common reason Templater automation silently fails.

## B) `DATA-Twin` (mirrored dependency comp)
**File:** `01_SETUP/AUTOMATION/01_COMPS/Automation Comps Content.txt`

`DATA-Twin` mirrors core fields from `DATA` via direct expressions like:
- `comp("DATA").layer("COUNTRY")...`
- `comp("DATA").layer("VARIANT")...`
- `comp("DATA").layer("PRODUCT NAME")...`

So your bot should inject into `DATA` first; `DATA-Twin` is derivative and updates from expressions.

## C) `MAIN TEXT` / special editable comp (headline system)
**File:** `01_SETUP/_EDITABLE COMPS (Special Formats)/Editable Comps (Special Formats) content.txt`

This comp includes templater-enabled text layers (e.g., `THIRD LINE`) and expression-driven auto-layout behavior. If your rows include variable text lengths, this comp affects whether final layouts remain inside guides.

## D) `RB_LOGO_VBAM` (logo text token)
**File:** `02_PRECOMPS/0_REDBULL/0_REDBULL Content.txt`

Contains a `VBAM` text layer with `TMPL_Settings`. If your sheet includes brand lockup text variants, this comp must remain connected.

---

## 3) End-to-end dependency flow

Google Sheet row (external bot) → Templater writes fields in `DATA` → `DATA-Twin` mirrors selected fields → expression libraries + JSON drive conditional logic → automation parts (`TAB`, `FLAG`, modular labels, text systems) → precomp/ playout renders.

---

## 4) Minimum checklist before automated rendering

1. Templater plugin is installed/active in After Effects render environment.
2. Bot writes into `DATA` layer names that match template fields exactly.
3. `_DATA` files are present and linked:
   - `expressionLibrary.jsx`
   - `expressionLibraryTwin.jsx`
   - `labelData.json`
   - `countryData.json`
4. `DATA-Twin` expressions remain intact (not baked/broken).
5. Test one known row and verify in this order:
   - `DATA` values updated
   - `DATA-Twin` mirrored values updated
   - downstream text/flag/label comps respond correctly

---

## 5) Practical scope note

This repository documents template internals only. The **Google Drive Sheets fetch + row iteration + render queue orchestration** is not present here and should be handled by your external bot service.
