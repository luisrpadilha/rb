# Red Bull Summer Edition SL 2026 — AE Twin Documentation

Use this guide as a practical map for artists/editors who need to find where things are built and what to check when outputs look wrong.

## 1) Project structure at a glance

The project is organized into three production stages:

1. **Setup / Data / Automation** (`01_SETUP`)
   - Main input comp: `DATA`
   - Automation helpers: `DATA-Twin`, `FLAG`, `TAB`, etc.
   - Core logic/data files in `_DATA` (JSON + expression libraries)

2. **Precomps / Shot Compositing** (`02_PRECOMPS/COMPOSITING`)
   - Shot assemblies (`SHOT01` to `SHOT04`)
   - Can renders, background integration, depth/DOF, particles, and control layers

3. **Playout / Delivery** (`00_PLAYOUT`)
   - Final output comps for KV and social
   - Durations and formats: 5s / 6s / 10s, 1 can / 2 can / twin / multipack

---

## 2) Most important comps to know

### A) `DATA` (main input hub)
**File:** `01_SETUP/01_SETUP Content.txt`

`DATA` is the central place for market and variant inputs used across the template.
Typical fields include:

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
- `DISRUPTOR`, `DISRUPTOR TYPE`, `DISRUPTOR DEFAULT COLOR`
- `LEGAL DISCLAIMER`, `LEGAL DISCLAIMER TYPE`

If text, language, color behavior, or variant routing looks wrong, check `DATA` first.

### B) `DATA-Twin` (mirrored input for twin logic)
**File:** `01_SETUP/AUTOMATION/01_COMPS/Automation Comps Content.txt`

`DATA-Twin` mirrors `DATA` fields using direct expressions (`comp("DATA")...`).
It is a linked mirror, not a separate master.

### C) `MAIN TEXT` / `HEADLINE BLOCK` (type layout engine)
**Files:**
- `01_SETUP/_EDITABLE COMPS (Special Formats)/Editable Comps (Special Formats) content.txt`
- `01_SETUP/AUTOMATION/02_PARTS/TEXT MASTER/TEXT MASTER Content.txt`

These comps manage text behavior:
- headline/subline logic
- auto-sizing and scaling
- alignment and logo lockups
- fit to safe area via corner bounds (`Top Left`, `Top Right`, etc.)

### D) `SHOT04_CLEAN` (hero shot control center)
**File:** `02_PRECOMPS/COMPOSITING/SHOT04/SHOT04 Content.txt`

`SHOT04_CLEAN` contains a `Control` null with global switches such as:
- `Asset Type`
- `Summer Edition`
- `Energy Drink`
- `Background Set`
- `Default_Color RED`
- `FCO_Color`
- flag offset/scale controls

These controls drive shot-level asset and look decisions.

### E) Playout masters (final delivery comps)
**Files:** under `00_PLAYOUT/_KV/...` and `00_PLAYOUT/_SOCIAL_KV/...`

Examples include 10s/6s/5s masters for 1 can, 2 can, twin, and multipack outputs.
These comps combine shot renders, text precomps, FCO assets, and fitting guides for delivery.

---

## 3) Core logic systems that affect many outputs

### A) Expression libraries (global behavior)
**Files:**
- `01_SETUP/AUTOMATION/02_PARTS/_DATA/expressionLibrary.jsx`
- `01_SETUP/AUTOMATION/02_PARTS/_DATA/expressionLibraryTwin.jsx`

These libraries contain shared checks used in many places, for example:
- variant and sugarfree checks
- country + variant matching
- tab/rhombus visibility
- audio on/off layout behavior
- label/shadow color decisions
- language-aware font selection

### B) Auto-layout expressions (text positioning)
Common in `DATA`, `TEXT MASTER`, `FLAG`, and playout comps:
- sourceRect-based anchor and position logic
- dynamic fitting for localized copy

### C) Auto scale-to-fit text block behavior
Playout comps use `HEADLINE BLOCK` corner bounds plus guides to keep text inside safe framing as copy length changes.

### D) Shot control-driven logic
Shot comps (especially around `SHOT04_CLEAN`) reference control values to switch assets, color behavior, and flag treatment.

---

## 4) Master data files and how they are used

### Primary input
1. **`DATA` comp** (`01_SETUP/01_SETUP Content.txt`)
   - Main editable source for market/variant/product/legal fields.

### Mirrored input
2. **`DATA-Twin` comp** (`01_SETUP/AUTOMATION/01_COMPS/Automation Comps Content.txt`)
   - Pulls values from `DATA` for twin-specific logic paths.

### External support data
3. **`labelData.json`** (`01_SETUP/AUTOMATION/02_PARTS/_DATA/labelData.json`)
4. **`countryData.json`** (`01_SETUP/AUTOMATION/02_PARTS/_DATA/countryData.json`)
5. **`expressionLibrary.jsx` / `expressionLibraryTwin.jsx`**

These files provide rules for label behavior, locale/font behavior, and shared expression logic.

### Where these are consumed
- `MAIN TEXT` includes the main JSON/library layers.
- Automation parts (`TAB`, `FLAG`, modular label families) read `DATA`/`DATA-Twin` and library functions.
- Shot comps consume prepared precomps.
- Playout comps package everything into final deliverables.

---

## 5) Quick troubleshooting order

If outputs are incorrect, check in this sequence:

1. **`DATA` values** (country, variant, product, label/legal fields)
2. **Linked support files** (`labelData.json`, `countryData.json`, expression libraries)
3. **Shot control values** (`SHOT04_CLEAN > Control` settings)
4. **Text fit setup** (`HEADLINE BLOCK` bounds + playout guides)
5. **Twin routing** (confirm whether a setup should read `DATA` or `DATA-Twin`)

This order usually resolves issues fastest because it follows the project dependency path.

---

## 6) Quick folder map

- `01_SETUP/` → inputs, automation building blocks, editable text systems
- `01_SETUP/AUTOMATION/02_PARTS/_DATA/` → JSON + expression libraries (core dependency)
- `02_PRECOMPS/COMPOSITING/` → shot assembly comps
- `00_PLAYOUT/` → final delivery outputs (KV + social across durations and pack formats)
