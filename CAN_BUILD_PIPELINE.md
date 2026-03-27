# CAN Build Pipeline (UV maps + Set Matte + RE:Map)

This document explains how the **can render is assembled** in this project, focused on the UV workflow and matte compositing chain.

## Scope used for this breakdown

Primary build reference:
- `02_PRECOMPS/0_KV_CAN/0_KV_CAN Content.txt` → comp `16_BIT_CAN`

Supporting shot implementations:
- `02_PRECOMPS/COMPOSITING/SHOT01/SHOT01 Content.txt`
- `02_PRECOMPS/COMPOSITING/SHOT02/SHOT02 Content.txt`
- `02_PRECOMPS/COMPOSITING/SHOT03/SHOT03 Content.txt`

---

## 1) Base can-label sources

Inside `16_BIT_CAN`, the label content is provided by precomp sources:

- `Modular_Label_SF_Banderoles`
- `EDITIONS_MODULAR_LABEL_UPSCALE` (Time Remap enabled)
- `EDITIONS_FOP_COL` (Time Remap enabled)

These are the textures that get projected onto the can using UV maps.

---

## 2) UV map projection stage (RE:Map UV)

The can projection is driven by UV EXR sequences (`UVDRPS...exr`) and the plugin **RE:Map UV (UV Mapper Pete)**.

In `16_BIT_CAN`, three key UV layers are used:

1. `UVDRPS_SF`
2. `UV_FOP`
3. `UVDRPS[0000-0180].exr`

Each UV layer applies:
- `EXtractoR` (channel extraction from EXR)
- `RE:Map UV` (UV Mapper Pete)

Important configured details (as exported):
- `Warp Mode = 1`
- `Texture` differs by layer (`1`, `4`, `3`) to target different texture sources
- `Position Offset X = 0.99`
- GPU path enabled (`Use GPU = 2`)

So the build is: **source texture/precomp → UV EXR + RE:Map UV warp → projected can-surface pass**.

---

## 3) Matte isolation stage (Set Matte)

After UV projection, layers are carved into specific can regions with `Set Matte`.

### In `16_BIT_CAN`

- `SHOT04_COL_WHITE_SF`
  - `Set Matte`: `Take Matte From Layer = 5` (`UVDRPS_SF`)
- `SHOT04_COL_BLUE_SF`
  - `Set Matte`: `Take Matte From Layer = 5`
- `SHOT04_BRAUN.mov`
  - `Set Matte`: `Take Matte From Layer = 7` (`UVDRPS[0000-0180].exr`)
- `SHOT04_ALU.mov`
  - `Set Matte`: `Take Matte From Layer = 7`, `Invert Matte = 1`

This separates color/print zones from metal zones using UV-driven mattes.

---

## 4) Edge refinement and integration

Once matte splits are done, edges are refined and integrated with:

- `Matte Choker` (notably on ALU/metal segments)
- Additional grading/treatment (`Lumetri`, `Selective Color`, `Tint`, `Hue/Saturation`)

This avoids hard seams between label and aluminium regions and matches the rendered plate look.

---

## 5) Variant and country-driven switching (expression layer)

The same comp uses expression-driven opacity switches to choose which projected/matted passes are visible:

- `lib.sfCheck()` gates sugarfree-specific color passes
- `lib.countryOnlyCheck()` gates country tab behavior
- `comp("DATA").layer("COUNTRY")...` and `comp("DATA").layer("DISRUPTOR TYPE")...` drive selection logic

So **UV/matte mechanics are constant**, while visible outputs are controlled by DATA-driven expressions.

---

## 6) Shot-level equivalents (SHOT01/02/03)

`SHOT01_CAN_SL`, `SHOT02_CAN_SL`, and `SHOT03_CAN_SL` follow the same construction pattern:

1. UV EXR layers (`UVDRPS...`) loaded.
2. `RE:Map UV` applied to build projected label/color passes.
3. `Set Matte` uses UV-derived layers to isolate regions.
4. `Matte Choker` refines seams where needed.
5. Final can layers (`COL`, `ALU`, etc.) are composed with DOF/depth/background passes.

Examples visible in logs:
- `SHOT01`: `SHOT01_UV_SL*` layers use `RE:Map UV`; downstream layers use `Set Matte` and `Matte Choker`.
- `SHOT02`: `UVDRPS_*` layers with `RE:Map UV`; multiple `Set Matte` steps isolate color/alu/drips passes.
- `SHOT03`: `UVDRPS_*` layers with `RE:Map UV`; `Set Matte` on color and metal layers plus `Matte Choker` cleanup.

---

## 7) Practical debug order for can issues

If the can looks wrong, debug in this order:

1. **Texture source present?** (modular-label/FOP precomps)
2. **UV EXR valid?** (`UVDRPS...` footage online and framed correctly)
3. **RE:Map UV active?** (effect present and mapped texture index correct)
4. **Set Matte targets correct layer index?** (`Take Matte From Layer` points to expected UV layer)
5. **Matte edge cleanup correct?** (`Matte Choker` settings)
6. **Expression gating correct?** (`sfCheck`, country/disruptor logic from `DATA`)

This sequence matches the actual build dependency chain.
