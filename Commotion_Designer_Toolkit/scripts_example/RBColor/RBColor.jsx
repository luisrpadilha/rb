/*
  RBColor - dockable Color Palette panel for After Effects.
  - Global read-only Red Bull palette from .ase in the global scripts path.
  - Local editable palettes persisted as .ase in APPDATA.
  - Single-click swatch copies HEX to clipboard.
  - Double-click swatch opens color modal for editable palettes.
*/

(function rbColorPanel(thisObj) {
  var GLOBAL_RBCOLOR_FOLDER = 'G:/04_Library/16_scripts/Custom_Scripts/AFX_EXPRESSIONS/RB_Commotion_Designer_Toolkit/scripts/RBColor';
  var GLOBAL_RED_BULL_ASE = GLOBAL_RBCOLOR_FOLDER + '/redbull.ase';

  function clamp255(value) {
    var n = Number(value);
    if (!isFinite(n)) n = 0;
    if (n < 0) n = 0;
    if (n > 255) n = 255;
    return Math.round(n);
  }

  function rgbToHex(rgb) {
    function p(n) {
      var h = clamp255(n).toString(16).toUpperCase();
      return h.length < 2 ? '0' + h : h;
    }
    return '#' + p(rgb.r) + p(rgb.g) + p(rgb.b);
  }

  function normalizeColor(color, fallbackName) {
    var c = color || {};
    return {
      name: c.name || fallbackName || 'Color',
      r: clamp255(c.r),
      g: clamp255(c.g),
      b: clamp255(c.b)
    };
  }

  function u16be(n) {
    return String.fromCharCode((n >> 8) & 255) + String.fromCharCode(n & 255);
  }

  function u32be(n) {
    return String.fromCharCode((n >> 24) & 255) + String.fromCharCode((n >> 16) & 255) + String.fromCharCode((n >> 8) & 255) + String.fromCharCode(n & 255);
  }

  function readU16(raw, offset) {
    return (raw.charCodeAt(offset) << 8) | raw.charCodeAt(offset + 1);
  }

  function readU32(raw, offset) {
    return (raw.charCodeAt(offset) << 24) | (raw.charCodeAt(offset + 1) << 16) | (raw.charCodeAt(offset + 2) << 8) | raw.charCodeAt(offset + 3);
  }

  function floatToBinary32BE(value) {
    var sign = value < 0 ? 1 : 0;
    var abs = Math.abs(value);
    var exponent;
    var mantissa;

    if (abs === 0) {
      exponent = 0;
      mantissa = 0;
    } else {
      exponent = Math.floor(Math.log(abs) / Math.LN2);
      var normalized = abs / Math.pow(2, exponent);
      exponent += 127;
      if (exponent <= 0) {
        exponent = 0;
        mantissa = Math.round(abs / Math.pow(2, -126 - 23));
      } else {
        mantissa = Math.round((normalized - 1) * Math.pow(2, 23));
      }
    }

    var bits = (sign << 31) | ((exponent & 255) << 23) | (mantissa & 0x7fffff);
    return u32be(bits >>> 0);
  }

  function binary32ToFloatBE(raw, offset) {
    var bits = readU32(raw, offset);
    var sign = (bits >>> 31) ? -1 : 1;
    var exponent = (bits >>> 23) & 255;
    var mantissa = bits & 0x7fffff;

    if (exponent === 0) {
      if (mantissa === 0) return 0;
      return sign * (mantissa / Math.pow(2, 23)) * Math.pow(2, -126);
    }

    if (exponent === 255) return sign * Number.POSITIVE_INFINITY;
    return sign * (1 + mantissa / Math.pow(2, 23)) * Math.pow(2, exponent - 127);
  }

  function encodeAse(paletteName, colors) {
    var blocks = '';
    for (var i = 0; i < colors.length; i += 1) {
      var color = normalizeColor(colors[i], 'Color ' + (i + 1));
      var swatchName = String(color.name);
      var charCount = swatchName.length + 1;
      var nameBytes = u16be(charCount);
      for (var j = 0; j < swatchName.length; j += 1) {
        nameBytes += u16be(swatchName.charCodeAt(j));
      }
      nameBytes += u16be(0);

      var rgbPart =
        'RGB ' +
        floatToBinary32BE(color.r / 255) +
        floatToBinary32BE(color.g / 255) +
        floatToBinary32BE(color.b / 255) +
        u16be(0);

      var blockBody = nameBytes + rgbPart;
      blocks += u16be(1) + u32be(blockBody.length) + blockBody;
    }

    var header = 'ASEF' + u16be(1) + u16be(0) + u32be(colors.length);
    return header + blocks;
  }

  function decodeAse(file) {
    var fallback = [];
    if (!file || !file.exists) return fallback;

    try {
      file.encoding = 'BINARY';
      if (!file.open('r')) return fallback;
      var raw = file.read();
      file.close();

      if (raw.substr(0, 4) !== 'ASEF') return fallback;
      var blockCount = readU32(raw, 8);
      var offset = 12;
      var colors = [];

      for (var i = 0; i < blockCount && offset + 6 <= raw.length; i += 1) {
        var blockType = readU16(raw, offset);
        offset += 2;
        var blockLen = readU32(raw, offset);
        offset += 4;

        if (offset + blockLen > raw.length) break;
        if (blockType !== 1) {
          offset += blockLen;
          continue;
        }

        var nameLen = readU16(raw, offset);
        offset += 2;
        var swatchName = '';
        for (var n = 0; n < nameLen - 1; n += 1) {
          swatchName += String.fromCharCode(readU16(raw, offset));
          offset += 2;
        }
        offset += 2;

        var model = raw.substr(offset, 4);
        offset += 4;
        if (model === 'RGB ') {
          var r = clamp255(Math.round(binary32ToFloatBE(raw, offset) * 255));
          offset += 4;
          var g = clamp255(Math.round(binary32ToFloatBE(raw, offset) * 255));
          offset += 4;
          var b = clamp255(Math.round(binary32ToFloatBE(raw, offset) * 255));
          offset += 4;
          colors.push({ name: swatchName || 'Color ' + (colors.length + 1), r: r, g: g, b: b });
        }

        offset += 2;
      }

      return colors;
    } catch (err) {
      try { file.close(); } catch (ignore) {}
      return fallback;
    }
  }

  function saveAseFile(file, paletteName, colors) {
    try {
      file.encoding = 'BINARY';
      if (!file.open('w')) return false;
      file.write(encodeAse(paletteName, colors));
      file.close();
      return true;
    } catch (err) {
      try { file.close(); } catch (ignore) {}
      return false;
    }
  }

  function sanitizeName(name) {
    var v = String(name || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    return v || 'Palette';
  }

  function ensureFolder(path) {
    var folder = new Folder(path);
    if (!folder.exists) folder.create();
    return folder;
  }

  function getLocalPaletteFolder() {
    var appData = $.getenv('APPDATA');
    var basePath = appData ? appData + '/RB_Commotion_Designer_Toolkit/local_palettes_ase' : Folder.userData.fsName + '/RB_Commotion_Designer_Toolkit/local_palettes_ase';
    return ensureFolder(basePath);
  }

  function writeClipboard(text) {
    try {
      var payload = String(text || '').replace(/"/g, '\\"');
      system.callSystem('cmd.exe /c echo ' + payload + '| clip');
      return true;
    } catch (e) {
      return false;
    }
  }

  function rgbToPickerValue(rgb) {
    return (clamp255(rgb.r) << 16) | (clamp255(rgb.g) << 8) | clamp255(rgb.b);
  }

  function pickerValueToRGB(value, fallback) {
    if (!value || value < 0) return fallback;
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255,
      name: fallback && fallback.name ? fallback.name : 'Color'
    };
  }

  function defaultRedBullPalette() {
    return {
      id: 'redbull',
      name: 'Red Bull',
      readOnly: true,
      filePath: GLOBAL_RED_BULL_ASE,
      colors: [
        { name: 'RED', r: 210, g: 0, b: 60 },
        { name: 'BLUE', r: 15, g: 0, b: 105 },
        { name: 'YELLOW', r: 255, g: 204, b: 0 },
        { name: 'GREY', r: 218, g: 218, b: 218 }
      ]
    };
  }

  function colorsMatchRedBullPreset(colors) {
    if (!colors || colors.length !== 4) return false;
    var expected = defaultRedBullPalette().colors;
    for (var i = 0; i < expected.length; i += 1) {
      if (
        clamp255(colors[i].r) !== expected[i].r ||
        clamp255(colors[i].g) !== expected[i].g ||
        clamp255(colors[i].b) !== expected[i].b
      ) {
        return false;
      }
    }
    return true;
  }

  function loadGlobalPalette() {
    var file = new File(GLOBAL_RED_BULL_ASE);
    var palette = defaultRedBullPalette();
    if (!file.exists) {
      ensureFolder(new Folder(GLOBAL_RBCOLOR_FOLDER).fsName);
      saveAseFile(file, palette.name, palette.colors);
      return palette;
    }

    var loaded = decodeAse(file);
    if (loaded.length && colorsMatchRedBullPreset(loaded)) {
      palette.colors = loaded;
    } else {
      saveAseFile(file, palette.name, palette.colors);
    }
    return palette;
  }

  function loadLocalPalettes() {
    var folder = getLocalPaletteFolder();
    var files = folder.getFiles(function (f) { return f instanceof File && /\.ase$/i.test(f.name); });
    var palettes = [];
    var hiddenLegacyNames = {
      'color palette': true,
      'standard': true,
      'standard 2': true
    };

    for (var i = 0; i < files.length; i += 1) {
      var colors = decodeAse(files[i]);
      if (!colors.length) continue;
      var paletteName = files[i].name.replace(/\.ase$/i, '');
      if (hiddenLegacyNames[paletteName.toLowerCase()]) continue;
      palettes.push({
        id: files[i].name,
        name: paletteName,
        readOnly: false,
        filePath: files[i].fsName,
        colors: colors
      });
    }

    palettes.sort(function (a, b) {
      return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
    });
    return palettes;
  }

  function saveLocalPalette(palette) {
    var folder = getLocalPaletteFolder();
    var fileName = sanitizeName(palette.name) + '.ase';
    var file = new File(folder.fsName + '/' + fileName);
    return saveAseFile(file, palette.name, palette.colors);
  }

  function deleteLocalPalette(palette) {
    if (!palette || !palette.filePath) return false;
    var file = new File(palette.filePath);
    return file.exists ? file.remove() : false;
  }

  function openPaletteDialog(existingPalette) {
    var isEdit = !!existingPalette;
    var working = {
      name: isEdit ? existingPalette.name : 'New Palette',
      colors: []
    };
    if (isEdit) {
      for (var i = 0; i < existingPalette.colors.length; i += 1) {
        working.colors.push(normalizeColor(existingPalette.colors[i], 'Color ' + (i + 1)));
      }
    }

    var dlg = new Window('dialog', isEdit ? 'Edit Palette' : 'New Palette', undefined, { closeButton: true });
    dlg.orientation = 'column';
    dlg.alignChildren = ['fill', 'top'];
    dlg.margins = 12;

    dlg.add('statictext', undefined, 'Palette name:');
    var nameInput = dlg.add('edittext', undefined, working.name);
    nameInput.characters = 34;

    dlg.add('statictext', undefined, 'Use the native After Effects color picker for visual selection.');

    var list = dlg.add('listbox', undefined, [], { multiselect: false });
    list.preferredSize = [440, 180];
    var swatchStrip = dlg.add('group');
    swatchStrip.orientation = 'row';
    swatchStrip.alignChildren = ['left', 'center'];
    swatchStrip.spacing = 6;

    function refreshList() {
      list.removeAll();
      for (var i = 0; i < working.colors.length; i += 1) {
        var c = working.colors[i];
        var item = list.add('item', c.name + ' - ' + rgbToHex(c) + ' (' + c.r + ',' + c.g + ',' + c.b + ')');
        item.indexRef = i;
      }
      if (list.items.length) list.selection = list.items[0];
      refreshSwatchStrip();
    }

    function refreshSwatchStrip() {
      while (swatchStrip.children.length) {
        swatchStrip.remove(swatchStrip.children[0]);
      }
      if (!working.colors.length) {
        swatchStrip.add('statictext', undefined, 'No colors yet');
        return;
      }

      for (var i = 0; i < working.colors.length; i += 1) {
        (function (index) {
          var c = working.colors[index];
          var sw = swatchStrip.add('button', undefined, '');
          sw.preferredSize = [20, 20];
          sw.helpTip = c.name + ' ' + rgbToHex(c);
          sw.graphics.backgroundColor = sw.graphics.newBrush(sw.graphics.BrushType.SOLID_COLOR, [c.r / 255, c.g / 255, c.b / 255, 1]);
          sw.onClick = function () {
            if (list.items[index]) list.selection = list.items[index];
          };
        })(i);
      }
    }

    var buttons = dlg.add('group');
    buttons.orientation = 'row';
    var addBtn = buttons.add('button', undefined, 'Add Color');
    var editBtn = buttons.add('button', undefined, 'Edit Color');
    var removeBtn = buttons.add('button', undefined, 'Remove Color');
    var importBtn = buttons.add('button', undefined, 'Import .ase');
    var exportBtn = buttons.add('button', undefined, 'Export .ase');

    function pickAndAppendColor() {
      var picked = $.colorPicker();
      if (picked < 0) return;
      var rgb = pickerValueToRGB(picked, null);
      if (!rgb) return;
      rgb.name = 'Color ' + (working.colors.length + 1);
      working.colors.push(rgb);
      refreshList();
    }

    function editSelectedColor() {
      if (!list.selection) return;
      var idx = list.selection.indexRef;
      var c = working.colors[idx];
      if (!c) return;
      var picked = $.colorPicker(rgbToPickerValue(c));
      if (picked < 0) return;
      var updated = pickerValueToRGB(picked, c);
      updated.name = c.name;
      working.colors[idx] = updated;
      refreshList();
      if (list.items[idx]) list.selection = list.items[idx];
    }

    addBtn.onClick = pickAndAppendColor;
    editBtn.onClick = editSelectedColor;

    removeBtn.onClick = function () {
      if (!list.selection) return;
      var removeIdx = list.selection.indexRef;
      working.colors.splice(removeIdx, 1);
      refreshList();
      if (list.items.length) {
        list.selection = list.items[Math.min(removeIdx, list.items.length - 1)];
      }
    };

    list.onDoubleClick = function () {
      editSelectedColor();
    };

    importBtn.onClick = function () {
      var chosen = File.openDialog('Import ASE palette', '*.ase');
      if (!chosen) return;
      var imported = decodeAse(chosen);
      if (!imported.length) {
        alert('Could not read .ase file or it has no RGB swatches.');
        return;
      }
      working.colors = imported;
      working.name = chosen.displayName.replace(/\.ase$/i, '');
      nameInput.text = working.name;
      refreshList();
    };

    exportBtn.onClick = function () {
      if (!working.colors.length) {
        alert('Add at least one color before exporting.');
        return;
      }
      var target = File.saveDialog('Export ASE palette', '*.ase');
      if (!target) return;
      if (!/\.ase$/i.test(target.name)) target = new File(target.fsName + '.ase');
      if (!saveAseFile(target, nameInput.text || working.name, working.colors)) {
        alert('Could not export the palette file.');
      }
    };

    var footer = dlg.add('group');
    footer.alignment = ['right', 'center'];
    var deletePaletteBtn = footer.add('button', undefined, 'Delete Palette');
    deletePaletteBtn.visible = isEdit;

    footer.add('button', undefined, 'Cancel', { name: 'cancel' });
    var saveBtn = footer.add('button', undefined, 'Save', { name: 'ok' });

    var action = 'cancel';
    deletePaletteBtn.onClick = function () {
      if (confirm('Delete this palette?')) {
        action = 'delete';
        dlg.close(1);
      }
    };

    saveBtn.onClick = function () {
      if (!working.colors.length) {
        alert('Please add at least one color.');
        return;
      }
      working.name = sanitizeName(nameInput.text);
      action = 'save';
      dlg.close(1);
    };

    refreshList();

    var result = dlg.show();
    if (result !== 1) return { action: 'cancel' };
    if (action === 'delete') return { action: 'delete' };
    return {
      action: 'save',
      palette: {
        name: working.name,
        colors: working.colors
      }
    };
  }

  function buildUI(thisObj) {
    var isDockedPanel = (typeof Panel !== 'undefined') && (thisObj instanceof Panel);
    var panel = isDockedPanel ? thisObj : new Window('palette', 'RB Color Palette', undefined, { resizeable: true });
    panel.orientation = 'column';
    panel.alignChildren = ['fill', 'top'];
    panel.spacing = 8;
    panel.margins = 8;

    var paletteGrid = panel.add('group');
    paletteGrid.orientation = 'column';
    paletteGrid.alignChildren = ['fill', 'top'];
    paletteGrid.spacing = 8;

    var status = panel.add('statictext', undefined, 'Ready');
    status.alignment = ['fill', 'bottom'];

    var palettes = [];

    function setStatus(msg) {
      status.text = msg;
    }

    function showToast(message) {
      try {
        var toast = new Window('palette', '');
        toast.orientation = 'column';
        toast.margins = 8;
        toast.add('statictext', undefined, message);
        toast.show();
        toast.update();
        $.sleep(850);
        toast.close();
      } catch (e) {}
    }

    function copyHexWithFeedback(color) {
      var hex = rgbToHex(color);
      if (writeClipboard(hex)) {
        setStatus('Copied ' + hex + ' to clipboard.');
        showToast('Copied ' + hex);
      } else {
        setStatus('Could not copy to clipboard: ' + hex);
      }
    }

    function onEditPalette(palette) {
      var response = openPaletteDialog(palette);
      if (response.action === 'delete') {
        if (deleteLocalPalette(palette)) {
          setStatus('Deleted palette: ' + palette.name);
          reloadPalettes();
        } else {
          setStatus('Could not delete palette: ' + palette.name);
        }
        return;
      }

      if (response.action !== 'save') return;

      if (!saveLocalPalette(response.palette)) {
        setStatus('Could not save palette.');
        return;
      }

      if (palette.filePath && sanitizeName(palette.name) !== sanitizeName(response.palette.name)) {
        deleteLocalPalette(palette);
      }

      setStatus('Saved palette: ' + response.palette.name);
      reloadPalettes();
    }

    function onSwatchDoubleClick(palette, colorIndex) {
      if (palette.readOnly) {
        setStatus('Red Bull palette is read-only.');
        return;
      }
      var picked = $.colorPicker(rgbToPickerValue(palette.colors[colorIndex]));
      if (picked < 0) return;

      palette.colors[colorIndex] = pickerValueToRGB(picked, palette.colors[colorIndex]);
      if (saveAseFile(new File(palette.filePath), palette.name, palette.colors)) {
        setStatus('Updated color in ' + palette.name);
        reloadPalettes();
      } else {
        setStatus('Could not update color in ' + palette.name);
      }
    }

    function makeSwatch(parent, palette, color, colorIndex) {
      var hex = rgbToHex(color);
      var btn = parent.add('button', undefined, '');
      btn.preferredSize = [22, 22];
      btn.helpTip = 'Click: copy HEX (' + hex + ')\nDouble-click: edit color in color modal';
      btn.graphics.backgroundColor = btn.graphics.newBrush(btn.graphics.BrushType.SOLID_COLOR, [color.r / 255, color.g / 255, color.b / 255, 1]);
      var lastClickAt = 0;
      btn.onClick = function () {
        var now = new Date().getTime();
        if (now - lastClickAt < 320) {
          onSwatchDoubleClick(palette, colorIndex);
          lastClickAt = 0;
          return;
        }
        lastClickAt = now;
        copyHexWithFeedback(color);
      };
      return btn;
    }

    function renderPalettes() {
      while (paletteGrid.children.length) {
        paletteGrid.remove(paletteGrid.children[0]);
      }

      var controls = paletteGrid.add('group');
      controls.orientation = 'row';
      controls.alignChildren = ['left', 'center'];
      var addBtn = controls.add('button', undefined, 'Add Palette');
      addBtn.helpTip = 'Create a new local ASE palette';
      addBtn.onClick = function () {
        var response = openPaletteDialog(null);
        if (response.action !== 'save') return;
        if (saveLocalPalette(response.palette)) {
          setStatus('Created palette: ' + response.palette.name);
          reloadPalettes();
        } else {
          setStatus('Could not create palette.');
        }
      };

      var panelWidth = panel.size && panel.size.width ? panel.size.width : 260;
      var usableWidth = Math.max(180, panelWidth - 32);
      var swatchesPerRow = Math.max(1, Math.floor(usableWidth / 30));

      for (var i = 0; i < palettes.length; i += 1) {
        (function (palette) {
          var card = paletteGrid.add('panel', undefined, '');
          card.orientation = 'column';
          card.alignChildren = ['fill', 'top'];
          card.margins = [8, 8, 8, 6];

          var cardHeader = card.add('group');
          cardHeader.orientation = 'row';
          cardHeader.alignChildren = ['fill', 'center'];
          cardHeader.alignment = ['fill', 'top'];
          var nameTxt = cardHeader.add('statictext', undefined, palette.name + (palette.readOnly ? ' (Standard)' : ''));
          nameTxt.alignment = ['fill', 'center'];

          if (!palette.readOnly) {
            var editBtn = cardHeader.add('button', undefined, 'Edit');
            editBtn.helpTip = 'Edit name/colors, delete palette, import/export ASE';
            editBtn.onClick = function () {
              onEditPalette(palette);
            };
          }

          var swatchArea = card.add('group');
          swatchArea.orientation = 'column';
          swatchArea.alignChildren = ['left', 'top'];
          swatchArea.spacing = 4;

          var swatchRow = null;
          for (var c = 0; c < palette.colors.length; c += 1) {
            if (c % swatchesPerRow === 0) {
              swatchRow = swatchArea.add('group');
              swatchRow.orientation = 'row';
              swatchRow.spacing = 6;
              swatchRow.alignChildren = ['left', 'center'];
            }
            makeSwatch(swatchRow, palette, palette.colors[c], c);
          }
        })(palettes[i]);
      }

      panel.layout.layout(true);
      panel.layout.resize();
    }

    function reloadPalettes() {
      palettes = [loadGlobalPalette()].concat(loadLocalPalettes());
      renderPalettes();
    }

    panel.onResizing = panel.onResize = function () {
      renderPalettes();
      this.layout.resize();
    };

    reloadPalettes();
    return panel;
  }

  var rbPanel = buildUI(thisObj);
  if (rbPanel instanceof Window) {
    rbPanel.center();
    rbPanel.show();
  } else {
    rbPanel.layout.layout(true);
    rbPanel.layout.resize();
  }
})(this);
