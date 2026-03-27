# Red Bull Summer Edition SL 2026 — AE Twin Documentation

This repository is a **filesystem mirror of an After Effects project**.
Each `* Content.txt` file is an exported technical log of comp/layer structure, effects, and expressions.

## 1) Project architecture (high level)

The project is organized in three main stages:

1. **Setup / Data / Automation** (`01_SETUP`)
   - Central `DATA` comp (master inputs).
   - Automation helper comps (`DATA-Twin`, `FLAG`, `TAB`, etc.).
   - Reusable expression libraries and JSON data in `_DATA`.

2. **Precomps / Compositing** (`02_PRECOMPS/COMPOSITING`)
   - Shot-level assemblies (`SHOT01` to `SHOT04`) with can renders, backgrounds, depth/DOF, particles, and control nulls.

3. **Playout outputs** (`00_PLAYOUT`)
   - Delivery comps for KV/social formats and durations (5s/6s/10s, 1 can / 2 can / twin / multipack).

---

## 2) Most important compositions

## A) `DATA` (master input comp)
**File:** `01_SETUP/01_SETUP Content.txt`

`DATA` is the main source of truth for text/content switches used throughout the template.
Key text layers include:
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
- `DISRUPTOR` / `DISRUPTOR TYPE` / `DISRUPTOR DEFAULT COLOR`
- `LEGAL DISCLAIMER` / `LEGAL DISCLAIMER TYPE`

These are the values most downstream expressions read.

## B) `DATA-Twin` (mirrored automation input)
**File:** `01_SETUP/AUTOMATION/01_COMPS/Automation Comps Content.txt`

`DATA-Twin` mirrors fields from `DATA` via direct expressions like:
- `comp("DATA").layer("COUNTRY")...`
- `comp("DATA").layer("VARIANT")...`
- `comp("DATA").layer("PRODUCT NAME")...`

This enables a twin workflow while keeping `DATA` as the primary source.

## C) `MAIN TEXT` / `HEADLINE BLOCK` (typography engine)
**Files:**
- `01_SETUP/_EDITABLE COMPS (Special Formats)/Editable Comps (Special Formats) content.txt`
- `01_SETUP/AUTOMATION/02_PARTS/TEXT MASTER/TEXT MASTER Content.txt`

These comps drive headline/subline logic, bounding boxes, logo locking, scaling and line behavior.
They also ingest external data layers (`countryData.json`, `labelData.json`, expression libraries).

The `HEADLINE BLOCK` comp is important because many playout comps compute scaling based on its corner/null bounds (`Top Left`, `Top Right`, etc.) to auto-fit text blocks.

## D) `SHOT04_CLEAN` (hero control comp)
**File:** `02_PRECOMPS/COMPOSITING/SHOT04/SHOT04 Content.txt`

`SHOT04_CLEAN` contains a `Control` null with key global controls:
- `Asset Type`
- `Summer Edition`
- `Energy Drink`
- `Background Set`
- `Default_Color RED`
- `FCO_Color`
- flag offset/scale controls

Many comps and expressions reference these controls for asset switching and flag behavior.

## E) Playout masters (10s/6s/5s + formats)
**Files:** under `00_PLAYOUT/_KV/...` and `00_PLAYOUT/_SOCIAL_KV/...`

Examples:
- `10s_1x1_1CanKV` (in `.../_KV 10s (Master)/1 Can/...`)
- other 1 can / 2 can / twin / multipack variants

These are final delivery comps, combining shot renders, typography precomps, FCO assets, and guide-driven scaling expressions.

---

## 3) Expressions that are critical for template behavior

## A) Centralized expression libraries
**Files:**
- `01_SETUP/AUTOMATION/02_PARTS/_DATA/expressionLibrary.jsx`
- `01_SETUP/AUTOMATION/02_PARTS/_DATA/expressionLibraryTwin.jsx`

These libraries implement reusable logic used across many layers/comps, including:
- Variant checks (`variantCheck`, `actualVariant`, `sfCheck`)
- Country/variant matching (`countryCheck`, `countryVariantCheck`, `countryOnlyCheck`)
- Product-name matching
- Tab/rhombus visibility logic
- Audio on/off positioning (`audioCheck`)
- Label/shadow color logic (`labelColor`, `shadowTint`)
- Multilingual font assignment by script (`rbFont`)

Twin-specific library functions are equivalent but reference `DATA-Twin` instead of `DATA`.

## B) SourceRect / anchor-point auto-layout expressions
Seen repeatedly in `DATA`, `TEXT MASTER`, `FLAG`, and playout comps:
- `Lock Anchor Point To...` + `When to Sample`
- `sourceRectAtTime()` driven anchor/position calculations

This is core for dynamic text fitting and reliable alignment across localized strings.

## C) Auto scale-to-fit text block expressions
In playout comps, text containers scale using guide limits and `HEADLINE BLOCK` corner nulls (`Top Left`, `Top Right`, `Bottom Left`, `Bottom Right`).
This ensures headline blocks stay within safe framing while adapting to text length.

## D) Control-driven shot logic
`SHOT04_CLEAN` control effects are referenced by expressions to switch assets and flag color/placement behavior.
The expression library `flagColor()` also combines `VARIANT`, `DISRUPTOR DEFAULT COLOR`, and shot control state.

---

## 4) Master DATA files and where they get information from

## Primary master input
1. **`DATA` comp** (`01_SETUP/01_SETUP Content.txt`)
   - Main editable text/value fields for country, variant, label metadata, legal copy, and toggles.
   - Acts as the top-level source consumed by automation and expression logic.

## Mirrored / derived input
2. **`DATA-Twin` comp** (`01_SETUP/AUTOMATION/01_COMPS/Automation Comps Content.txt`)
   - Pulls values directly from `DATA` via expressions.
   - Used for twin-specific render logic.

## External data sources (loaded as footage/layers)
3. **`labelData.json`** (`01_SETUP/AUTOMATION/02_PARTS/_DATA/labelData.json`)
   - Provides label rule sets and variables (e.g., `basicLabel`, `glossyVariants`, etc.) used by expression checks.

4. **`countryData.json`** (`01_SETUP/AUTOMATION/02_PARTS/_DATA/countryData.json`)
   - Provides font mappings and locale-specific character/font behavior.
   - Used by `rbFont()` for script-aware type styling.

5. **`expressionLibrary.jsx` / `expressionLibraryTwin.jsx`**
   - Loaded as source-data footage and called by expressions in comps.

## Where the data is consumed
- `MAIN TEXT` editable comp includes the four key external layers:
  - `countryData.json`
  - `expressionLibrary.jsx`
  - `expressionLibraryTwin.jsx`
  - `labelData.json`
- Automation parts such as `TAB`, `FLAG`, and modular label comps use `DATA` / `DATA-Twin` + library functions.
- Playout comps consume these prepared precomps and shot outputs for final deliveries.

---

## 5) Practical “if this breaks” checklist

1. Verify `DATA` text layers are populated with expected tokens (country/variant/product/label fields).
2. Verify external `_DATA` files are present and linked (`labelData.json`, `countryData.json`, expression libraries).
3. Verify `SHOT04_CLEAN > Control` menu/checkbox values (asset type, summer edition, flag color controls).
4. Verify `HEADLINE BLOCK` corner null logic and guide layers in playout comps (text fit/scale).
5. If twin outputs are wrong, check whether expression calls should target `DATA` vs `DATA-Twin`.

---

## 6) Key folders quick map

- `01_SETUP/` → data entry, automation building blocks, editable text systems
- `01_SETUP/AUTOMATION/02_PARTS/_DATA/` → JSON + expression libraries (core dependency)
- `02_PRECOMPS/COMPOSITING/` → shot assembly comps
- `00_PLAYOUT/` → final playout deliverables (KV + social, multiple durations/pack formats)
