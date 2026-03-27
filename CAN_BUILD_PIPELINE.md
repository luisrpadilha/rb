# Can Build Pipeline

This is the same can-build process, explained in **motion design language** (not developer language).

Think of it as: **label artwork in → wrapped on can → masked into areas → edge polish → final comp switches**.

## What this guide is based on

Main build reference:
- `02_PRECOMPS/0_KV_CAN/0_KV_CAN Content.txt` → comp `16_BIT_CAN`

Matching shot setups:
- `02_PRECOMPS/COMPOSITING/SHOT01/SHOT01 Content.txt`
- `02_PRECOMPS/COMPOSITING/SHOT02/SHOT02 Content.txt`
- `02_PRECOMPS/COMPOSITING/SHOT03/SHOT03 Content.txt`

---

## 1) Start with the label sources (your artwork inputs)

Inside `16_BIT_CAN`, the can uses these label sources as texture inputs:

- `Modular_Label_SF_Banderoles`
- `EDITIONS_MODULAR_LABEL_UPSCALE` (Time Remap on)
- `EDITIONS_FOP_COL` (Time Remap on)

In practical terms: these are your **design plates** that will be wrapped around the can geometry.

---

## 2) Wrap stage: UV maps + RE:Map UV

The wrap is driven by UV EXR sequences (`UVDRPS...exr`) and the plugin **RE:Map UV (UV Mapper Pete)**.

In `16_BIT_CAN`, key UV layers are:

1. `UVDRPS_SF`
2. `UV_FOP`
3. `UVDRPS[0000-0180].exr`

Each UV layer runs:
- `EXtractoR` (pulls the needed channels from EXR)
- `RE:Map UV` (does the actual texture wrap)

Typical settings in this template:
- `Warp Mode = 1`
- `Texture` set per layer (`1`, `4`, `3`) so each UV pass reads the correct source
- `Position Offset X = 0.99`
- `Use GPU = 2`

So the flow is:
**label input → UV wrap (RE:Map UV) → can surface pass**.

---

## 3) Region masks: Set Matte splits the can parts

After the wrap, `Set Matte` is used like region masking to separate areas (print/color/metal).

### In `16_BIT_CAN`

- `SHOT04_COL_WHITE_SF`
  - `Set Matte`: `Take Matte From Layer = 5` (`UVDRPS_SF`)
- `SHOT04_COL_BLUE_SF`
  - `Set Matte`: `Take Matte From Layer = 5`
- `SHOT04_BRAUN.mov`
  - `Set Matte`: `Take Matte From Layer = 7` (`UVDRPS[0000-0180].exr`)
- `SHOT04_ALU.mov`
  - `Set Matte`: `Take Matte From Layer = 7`, `Invert Matte = 1`

In motion-design terms: this is where the can gets **separated into material zones**.

---

## 4) Edge polish and blend-in

Once split, transitions are softened and matched with:

- `Matte Choker` (especially useful on metal/ALU edges)
- Look matching effects (`Lumetri`, `Selective Color`, `Tint`, `Hue/Saturation`)

This keeps seams from looking cut out and helps the wrapped label sit naturally with the render.

---

## 5) Version switching (data-driven visibility)

The UV/matte setup stays the same, but visible outputs are switched by expressions:

- `lib.sfCheck()` for sugarfree variants
- `lib.countryOnlyCheck()` for country-tab behavior
- `comp("DATA").layer("COUNTRY")...` and `comp("DATA").layer("DISRUPTOR TYPE")...` for variant logic

Designer-friendly view: this is the **built-in version control layer** that turns specific passes on/off per market/variant.

---

## 6) Same pattern in SHOT01 / SHOT02 / SHOT03

`SHOT01_CAN_SL`, `SHOT02_CAN_SL`, and `SHOT03_CAN_SL` all follow the same structure:

1. Bring in UV EXR layers.
2. Wrap textures using `RE:Map UV`.
3. Use `Set Matte` to isolate can zones.
4. Refine edges with `Matte Choker`.
5. Composite final can layers (`COL`, `ALU`, etc.) with depth/DOF/background.

So if you understand one shot, you understand the core build logic for the others.

---

## 7) Fast troubleshooting order (designer workflow)

If something looks wrong on the can, check in this order:

1. **Is the artwork source correct?** (modular label / FOP inputs)
2. **Is the UV EXR loaded and timed correctly?** (`UVDRPS...` online, right frame range)
3. **Is RE:Map UV active and reading the right texture index?**
4. **Is Set Matte pulling from the intended UV layer?** (`Take Matte From Layer`)
5. **Are edge settings too harsh or too soft?** (`Matte Choker`)
6. **Is a variant switch hiding your pass?** (`sfCheck`, country/disruptor logic in `DATA`)

This order usually finds the issue quickly because it follows the actual dependency chain of the comp.
