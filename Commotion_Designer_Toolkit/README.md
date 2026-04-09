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

## Where to put files to test quickly

1. Keep the extension folder here:
   - `Commotion_Designer_Toolkit/CEP/com.rbmh.commotiondesigner`
2. Create (or use) any scripts root folder (anywhere you have write access), e.g.:
   - `~/Documents/AE-Toolkit-Scripts` (macOS)
   - `%USERPROFILE%\Documents\AE-Toolkit-Scripts` (Windows)
3. Put script packs in that folder using the format above.
4. In the panel's **Configuration** screen, browse to that scripts root folder and click **Save & Load Scripts**.

### Included test pack

A sample script package lives in:

- `Commotion_Designer_Toolkit/scripts_example/HelloWorld`

For a first test, point the panel to:

- `Commotion_Designer_Toolkit/scripts_example`

## Install in After Effects (no admin required)

Use the **user-level CEP extensions folder** (not system-level), then open from AE's Extensions menu.

### macOS user-level CEP folder

```text
~/Library/Application Support/Adobe/CEP/extensions/
```

Copy this folder into that location:

```text
com.rbmh.commotiondesigner
```

Final path should be:

```text
~/Library/Application Support/Adobe/CEP/extensions/com.rbmh.commotiondesigner
```

### Windows user-level CEP folder

```text
%APPDATA%\Adobe\CEP\extensions\
```

Copy this folder into that location:

```text
com.rbmh.commotiondesigner
```

Final path should be:

```text
%APPDATA%\Adobe\CEP\extensions\com.rbmh.commotiondesigner
```

Then in After Effects:

- Open `Window > Extensions > Commotion Designer Toolkit`.

## Enable unsigned CEP panels (dev/testing)

If needed, enable `PlayerDebugMode` for your CSXS version. This is typically possible without admin rights when set in user scope.

- CSXS 11 (common for newer AE): `PlayerDebugMode=1`
- CSXS 10/9 (older AE): set corresponding CSXS key similarly

If your machine is locked by IT policy, ask them to allow unsigned CEP extensions for your user.

## Install in After Effects (system-level, optional)

If you *do* have admin rights, you can alternatively install to machine-wide CEP extension folders. This is optional.

## Notes

- Script execution uses ExtendScript `$.evalFile(...)`.
- Folder browsing uses native ExtendScript folder selection.
- Button order is persisted per configured folder path.
