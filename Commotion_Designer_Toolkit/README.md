# Commotion Designer Toolkit

A plug-and-play Adobe After Effects CEP extension panel built as an HTML/CSS/JS UI.

## What it does

- Dockable, movable, and resizable panel inside After Effects (standard CEP panel behavior).
- Configuration screen to select a scripts root folder.
- Main screen that auto-discovers scripts from subfolders.
- About screen with credit to **RBMH**.
- Grid buttons with:
  - SVG icon
  - Script title
  - Hover description tooltip
  - Click to run script
  - Drag-and-drop reorder
- Responsive layout.
- Bottom slider to control icon size.
- Dark theme aligned with common After Effects UI styling.

## Script pack format

Inside your configured scripts root folder, each script must be in its own subfolder:

```text
YourScripts/
  MyScript/
    my_script.jsx
    icon.svg
    meta.json
```

`meta.json` example:

```json
{
  "name": "My Script",
  "description": "What this script does in one sentence."
}
```

> If `meta.json` is missing, the folder name is used as script name and description defaults to `No description available.`

## Install in After Effects (CEP)

1. Copy `Commotion_Designer_Toolkit/CEP/com.rbmh.commotiondesigner` to your CEP extensions folder.
2. Enable unsigned CEP extensions (development/testing) if needed.
3. Launch After Effects.
4. Open panel from: `Window > Extensions > Commotion Designer Toolkit`.

## Local example content

A sample script package lives in:

- `scripts_example/HelloWorld`

Point the configuration screen to `scripts_example` to test quickly.

## Notes

- Script execution uses ExtendScript `$.evalFile(...)`.
- Folder browsing uses native ExtendScript folder selection.
- Button order is persisted per configured folder path.
