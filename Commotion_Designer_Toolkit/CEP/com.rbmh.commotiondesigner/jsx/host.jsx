/* global app, Folder, File, $ */

(function () {
  if (!$._cdt) {
    $._cdt = {};
  }

  var SETTINGS_SECTION = 'CommotionDesignerToolkit';
  var SETTINGS_FOLDER_KEY = 'scriptsFolder';
  var SETTINGS_ICON_SIZE_KEY = 'iconSize';
  var SETTINGS_SHOW_LABELS_KEY = 'showLabels';
  var SETTINGS_SHOW_SLIDER_KEY = 'showSlider';
  var SETTINGS_SHOW_LOG_KEY = 'showLog';

  var DEFAULT_SCRIPTS_PATH = 'G:/04_Library/16_scripts/Custom_Scripts/AFX_EXPRESSIONS/RB_Commotion_Designer_Toolkit/scripts';
  var LOCAL_UPDATE_SOURCE = 'G:/04_Library/16_scripts/Custom_Scripts/AFX_EXPRESSIONS/RB_Commotion_Designer_Toolkit/CEP/com.rbmh.commotiondesigner';

  function stringifyJSON(value) {
    if (typeof JSON !== 'undefined' && JSON && typeof JSON.stringify === 'function') return JSON.stringify(value);

    var type = typeof value;
    if (value === null) return 'null';
    if (type === 'number' || type === 'boolean') return String(value);
    if (type === 'string') return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';

    if (Object.prototype.toString.call(value) === '[object Array]') {
      var arr = [];
      for (var i = 0; i < value.length; i += 1) arr.push(stringifyJSON(value[i]));
      return '[' + arr.join(',') + ']';
    }

    var keys = [];
    for (var key in value) {
      if (value.hasOwnProperty(key)) keys.push('"' + key.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '":' + stringifyJSON(value[key]));
    }
    return '{' + keys.join(',') + '}';
  }

  function parseJSON(raw, fallback) {
    try {
      if (typeof JSON !== 'undefined' && JSON && typeof JSON.parse === 'function') return JSON.parse(raw);
      return eval('(' + raw + ')');
    } catch (e) {
      return fallback;
    }
  }

  function toJSON(obj) {
    try {
      return stringifyJSON(obj);
    } catch (err) {
      return '{"ok":false,"message":"JSON stringify failed."}';
    }
  }

  function readSetting(key, fallback) {
    try {
      if (app.settings.haveSetting(SETTINGS_SECTION, key)) return app.settings.getSetting(SETTINGS_SECTION, key);
    } catch (e) {}
    return fallback;
  }

  function writeSetting(key, value) {
    try {
      app.settings.saveSetting(SETTINGS_SECTION, key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function sanitizePath(path) {
    return decodeURI(path || '').replace(/\\/g, '/');
  }

  function getOrderKey(folderPath) {
    return 'order::' + folderPath;
  }

  function readMeta(metaFile, fallbackName) {
    var meta = { name: fallbackName, description: 'No description available.', icon: '' };
    if (!metaFile.exists) return meta;

    try {
      metaFile.encoding = 'UTF-8';
      metaFile.open('r');
      var raw = metaFile.read();
      metaFile.close();

      var parsed = parseJSON(raw, {});
      meta.name = parsed.name || fallbackName;
      meta.description = parsed.description || meta.description;
      meta.icon = parsed.icon || '';
    } catch (e) {}

    return meta;
  }

  function ensureFolder(path) {
    var folder = new Folder(path);
    if (!folder.exists) folder.create();
    return folder.exists;
  }

  function copyFolderRecursive(sourceFolder, targetFolder) {
    if (!targetFolder.exists) targetFolder.create();

    var entries = sourceFolder.getFiles();
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (entry instanceof Folder) {
        copyFolderRecursive(entry, new Folder(targetFolder.fsName + '/' + entry.name));
      } else if (entry instanceof File) {
        entry.copy(targetFolder.fsName + '/' + entry.name);
      }
    }
  }

  function deleteFolderRecursive(folder) {
    if (!folder.exists) return true;

    var entries = folder.getFiles();
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (entry instanceof Folder) {
        if (!deleteFolderRecursive(entry)) return false;
      } else if (entry instanceof File) {
        if (!entry.remove()) return false;
      }
    }

    return folder.remove();
  }

  function syncFolderRecursive(sourceFolder, targetFolder) {
    if (!targetFolder.exists) targetFolder.create();

    var sourceEntries = sourceFolder.getFiles();
    var sourceMap = {};
    var i;

    for (i = 0; i < sourceEntries.length; i += 1) {
      sourceMap[sourceEntries[i].name] = sourceEntries[i];
    }

    var targetEntries = targetFolder.getFiles();
    for (i = 0; i < targetEntries.length; i += 1) {
      var targetEntry = targetEntries[i];
      var sourceMatch = sourceMap[targetEntry.name];
      if (!sourceMatch) {
        if (targetEntry instanceof Folder) {
          if (!deleteFolderRecursive(targetEntry)) throw new Error('Could not remove folder: ' + targetEntry.fsName);
        } else if (targetEntry instanceof File) {
          if (!targetEntry.remove()) throw new Error('Could not remove file: ' + targetEntry.fsName);
        }
        continue;
      }

      if (sourceMatch instanceof Folder && targetEntry instanceof Folder) {
        syncFolderRecursive(sourceMatch, targetEntry);
      } else if (sourceMatch instanceof File && targetEntry instanceof File) {
        if (!sourceMatch.copy(targetEntry.fsName)) {
          throw new Error('Could not overwrite file: ' + targetEntry.fsName);
        }
      } else {
        if (targetEntry instanceof Folder) {
          if (!deleteFolderRecursive(targetEntry)) throw new Error('Could not replace folder: ' + targetEntry.fsName);
        } else if (targetEntry instanceof File) {
          if (!targetEntry.remove()) throw new Error('Could not replace file: ' + targetEntry.fsName);
        }

        if (sourceMatch instanceof Folder) {
          copyFolderRecursive(sourceMatch, new Folder(targetFolder.fsName + '/' + sourceMatch.name));
        } else if (sourceMatch instanceof File) {
          if (!sourceMatch.copy(targetFolder.fsName + '/' + sourceMatch.name)) {
            throw new Error('Could not copy file: ' + sourceMatch.fsName);
          }
        }
      }
    }

    for (i = 0; i < sourceEntries.length; i += 1) {
      var sourceEntry = sourceEntries[i];
      var targetPath = targetFolder.fsName + '/' + sourceEntry.name;
      var targetFile = new File(targetPath);
      var targetSubfolder = new Folder(targetPath);
      if (sourceEntry instanceof Folder) {
        if (!targetSubfolder.exists) copyFolderRecursive(sourceEntry, targetSubfolder);
      } else if (sourceEntry instanceof File) {
        if (!targetFile.exists && !sourceEntry.copy(targetPath)) {
          throw new Error('Could not copy file: ' + sourceEntry.fsName);
        }
      }
    }
  }

  function getUpdateInfo() {
    var updateFile = new File(LOCAL_UPDATE_SOURCE + '/update.json');
    if (!updateFile.exists) {
      return { version: 'unknown', lastUpdateNotes: 'No update notes available.' };
    }

    try {
      updateFile.encoding = 'UTF-8';
      updateFile.open('r');
      var raw = updateFile.read();
      updateFile.close();
      var parsed = parseJSON(raw, {});
      return {
        version: parsed.version || 'unknown',
        lastUpdateNotes: parsed.lastUpdateNotes || 'No update notes available.'
      };
    } catch (e) {
      try { updateFile.close(); } catch (ignore) {}
      return { version: 'unknown', lastUpdateNotes: 'No update notes available.' };
    }
  }

  function hashFileBinary(file) {
    try {
      file.encoding = 'BINARY';
      if (!file.open('r')) return '';
      var raw = file.read();
      file.close();

      var hash = 0;
      for (var i = 0; i < raw.length; i += 1) {
        hash = (hash * 31 + raw.charCodeAt(i)) % 2147483647;
      }
      return String(hash) + ':' + String(raw.length);
    } catch (e) {
      try { file.close(); } catch (ignore) {}
      return '';
    }
  }

  function collectFolderSnapshot(baseFolder, relativePath, snapshot) {
    var entries = baseFolder.getFiles();
    entries.sort(function (a, b) { return String(a.name).toLowerCase() > String(b.name).toLowerCase() ? 1 : -1; });

    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      var rel = relativePath ? relativePath + '/' + entry.name : entry.name;

      if (entry instanceof Folder) {
        snapshot['d:' + rel] = 'dir';
        collectFolderSnapshot(entry, rel, snapshot);
      } else if (entry instanceof File) {
        snapshot['f:' + rel] = hashFileBinary(entry);
      }
    }
  }

  function foldersAreIdentical(sourcePath, destPath) {
    var source = new Folder(sourcePath);
    var dest = new Folder(destPath);

    if (!source.exists || !dest.exists) return false;

    var sourceSnapshot = {};
    var destSnapshot = {};
    collectFolderSnapshot(source, '', sourceSnapshot);
    collectFolderSnapshot(dest, '', destSnapshot);

    var sourceKeys = [];
    var destKeys = [];
    var key;

    for (key in sourceSnapshot) {
      if (sourceSnapshot.hasOwnProperty(key)) sourceKeys.push(key);
    }

    for (key in destSnapshot) {
      if (destSnapshot.hasOwnProperty(key)) destKeys.push(key);
    }

    if (sourceKeys.length !== destKeys.length) return false;

    for (var i = 0; i < sourceKeys.length; i += 1) {
      key = sourceKeys[i];
      if (!destSnapshot.hasOwnProperty(key)) return false;
      if (sourceSnapshot[key] !== destSnapshot[key]) return false;
    }

    return true;
  }

  $._cdt.getState = function () {
    var scriptsFolder = readSetting(SETTINGS_FOLDER_KEY, DEFAULT_SCRIPTS_PATH);
    var iconSize = readSetting(SETTINGS_ICON_SIZE_KEY, '45');
    var orderRaw = readSetting(getOrderKey(scriptsFolder), '{}');
    var showLabels = readSetting(SETTINGS_SHOW_LABELS_KEY, 'false');
    var showSlider = readSetting(SETTINGS_SHOW_SLIDER_KEY, 'false');
    var showLog = readSetting(SETTINGS_SHOW_LOG_KEY, 'false');

    return toJSON({
      scriptsFolder: scriptsFolder,
      iconSize: iconSize,
      showLabels: showLabels,
      showSlider: showSlider,
      showLog: showLog,
      order: parseJSON(orderRaw || '{}', {})
    });
  };

  $._cdt.saveState = function (folderPath, iconSize, showLabels, showSlider, showLog) {
    writeSetting(SETTINGS_FOLDER_KEY, sanitizePath(folderPath));
    writeSetting(SETTINGS_ICON_SIZE_KEY, String(iconSize || 45));
    writeSetting(SETTINGS_SHOW_LABELS_KEY, showLabels ? 'true' : 'false');
    writeSetting(SETTINGS_SHOW_SLIDER_KEY, showSlider ? 'true' : 'false');
    writeSetting(SETTINGS_SHOW_LOG_KEY, showLog ? 'true' : 'false');
    return toJSON({ ok: true });
  };

  $._cdt.saveShowLabels = function (showLabels) {
    writeSetting(SETTINGS_SHOW_LABELS_KEY, showLabels ? 'true' : 'false');
    return toJSON({ ok: true });
  };

  $._cdt.saveShowLog = function (showLog) {
    writeSetting(SETTINGS_SHOW_LOG_KEY, showLog ? 'true' : 'false');
    return toJSON({ ok: true });
  };

  $._cdt.saveOrder = function (folderPath, orderJSON) {
    writeSetting(getOrderKey(sanitizePath(folderPath || '')), orderJSON || '{}');
    return toJSON({ ok: true });
  };

  $._cdt.pickFolder = function () {
    var selected = Folder.selectDialog('Select Commotion Designer Toolkit scripts folder');
    if (!selected) return toJSON({ ok: false, path: '' });
    return toJSON({ ok: true, path: sanitizePath(selected.fsName) });
  };

  $._cdt.scanScripts = function (rootPath) {
    var safeRoot = sanitizePath(rootPath);
    var root = new Folder(safeRoot);

    if (!root.exists) {
      return toJSON({ ok: false, message: 'Configured folder does not exist or is inaccessible.', scripts: [] });
    }

    var scriptFolders = root.getFiles(function (entry) { return entry instanceof Folder; });
    var scripts = [];

    for (var i = 0; i < scriptFolders.length; i += 1) {
      var folder = scriptFolders[i];
      var entries = folder.getFiles();
      var jsxFile = null;
      var svgFile = null;
      var svgByName = {};

      for (var j = 0; j < entries.length; j += 1) {
        var file = entries[j];
        if (!(file instanceof File)) continue;
        var name = file.name.toLowerCase();
        if (!jsxFile && /\.jsx$/.test(name)) jsxFile = file;
        if (/\.svg$/.test(name)) {
          if (!svgFile) svgFile = file;
          svgByName[file.name.toLowerCase()] = file;
        }
      }

      if (!jsxFile) continue;

      var meta = readMeta(new File(folder.fsName + '/meta.json'), folder.name);
      var iconFromMeta = meta.icon ? svgByName[String(meta.icon).toLowerCase()] : null;
      var resolvedIcon = iconFromMeta || svgFile;
      scripts.push({
        id: folder.name,
        name: meta.name,
        description: meta.description,
        jsxPath: sanitizePath(jsxFile.fsName),
        iconUri: resolvedIcon ? 'file:///' + sanitizePath(resolvedIcon.fsName) : ''
      });
    }

    return toJSON({ ok: true, scripts: scripts });
  };

  $._cdt.localUpdate = function () {
    try {
      var source = new Folder(LOCAL_UPDATE_SOURCE);
      if (!source.exists) {
        return toJSON({ ok: false, message: 'Source folder not found: ' + LOCAL_UPDATE_SOURCE });
      }

      var appData = $.getenv('APPDATA');
      if (!appData) {
        return toJSON({ ok: false, message: 'APPDATA environment variable not found.' });
      }

      var destRoot = sanitizePath(appData) + '/Adobe/CEP/extensions/com.rbmh.commotiondesigner';
      ensureFolder(sanitizePath(appData) + '/Adobe/CEP/extensions');
      syncFolderRecursive(source, new Folder(destRoot));

      return toJSON({ ok: true, message: 'Synchronized extension at ' + destRoot });
    } catch (e) {
      return toJSON({ ok: false, message: String(e) });
    }
  };

  $._cdt.checkLocalUpdateStatus = function () {
    try {
      var source = new Folder(LOCAL_UPDATE_SOURCE);
      if (!source.exists) {
        return toJSON({ ok: false, different: false, message: 'Source folder not found.' });
      }

      var appData = $.getenv('APPDATA');
      if (!appData) {
        return toJSON({ ok: false, different: false, message: 'APPDATA environment variable not found.' });
      }

      var destRoot = sanitizePath(appData) + '/Adobe/CEP/extensions/com.rbmh.commotiondesigner';
      var dest = new Folder(destRoot);
      if (!dest.exists) {
        return toJSON({ ok: true, different: true, message: 'Installed extension folder is missing.' });
      }

      var same = foldersAreIdentical(source.fsName, dest.fsName);
      return toJSON({
        ok: true,
        different: !same,
        message: same ? 'You are up to date.' : 'New version found. Please update.'
      });
    } catch (e) {
      return toJSON({ ok: false, different: false, message: String(e) });
    }
  };

  var RB_COLOR_GLOBAL_PATH = 'G:/04_Library/16_scripts/Custom_Scripts/AFX_EXPRESSIONS/RB_Commotion_Designer_Toolkit/scripts/RBColor';
  var RB_COLOR_LOCAL_FOLDER_KEY = 'rbColorLocalFolder';
  var DEFAULT_RB_PALETTE = {
    id: 'rb_redbull',
    name: 'Red Bull',
    readOnly: true,
    colors: [
      { name: 'RED', r: 15, g: 0, b: 105 },
      { name: 'BLUE', r: 15, g: 0, b: 105 },
      { name: 'YELLOW', r: 255, g: 204, b: 0 },
      { name: 'GREY', r: 218, g: 218, b: 218 }
    ]
  };

  function getRBColorLocalFolderPath() {
    var current = readSetting(RB_COLOR_LOCAL_FOLDER_KEY, '');
    if (current) return sanitizePath(current);

    var appData = $.getenv('APPDATA');
    var fallback = appData
      ? sanitizePath(appData) + '/RB_Commotion_Designer_Toolkit/local_palettes'
      : '~/RB_Commotion_Designer_Toolkit/local_palettes';
    writeSetting(RB_COLOR_LOCAL_FOLDER_KEY, fallback);
    return fallback;
  }

  function ensurePaletteFolder(path) {
    var folder = new Folder(path);
    if (!folder.exists) folder.create();
    return folder;
  }

  function sanitizePalette(palette, readOnlyFlag) {
    var result = {
      id: String((palette && palette.id) || ('palette_' + Date.now())),
      name: String((palette && palette.name) || 'Custom'),
      readOnly: !!readOnlyFlag,
      colors: []
    };
    var colors = palette && palette.colors ? palette.colors : [];
    for (var i = 0; i < colors.length; i += 1) {
      var c = colors[i] || {};
      result.colors.push({
        name: String(c.name || ('Color ' + (i + 1))),
        r: Math.max(0, Math.min(255, Number(c.r || 0))),
        g: Math.max(0, Math.min(255, Number(c.g || 0))),
        b: Math.max(0, Math.min(255, Number(c.b || 0)))
      });
    }
    return result;
  }

  function readPaletteFile(file, readOnlyFlag) {
    try {
      file.encoding = 'UTF-8';
      if (!file.open('r')) return null;
      var raw = file.read();
      file.close();
      var parsed = parseJSON(raw, null);
      if (!parsed) return null;
      if (!parsed.id) parsed.id = file.displayName.replace(/\.json$/i, '');
      return sanitizePalette(parsed, readOnlyFlag);
    } catch (e) {
      try { file.close(); } catch (ignore) {}
      return null;
    }
  }

  function writePaletteFile(folderPath, palette) {
    var safe = sanitizePalette(palette, false);
    var file = new File(folderPath + '/' + safe.id + '.json');
    file.encoding = 'UTF-8';
    if (!file.open('w')) return false;
    file.write(stringifyJSON(safe));
    file.close();
    return true;
  }

  function listPaletteFiles(folderPath, readOnlyFlag) {
    var folder = new Folder(folderPath);
    if (!folder.exists) return [];
    var files = folder.getFiles(function (entry) { return entry instanceof File && /\.json$/i.test(entry.name); });
    var palettes = [];
    for (var i = 0; i < files.length; i += 1) {
      var palette = readPaletteFile(files[i], readOnlyFlag);
      if (palette) palettes.push(palette);
    }
    return palettes;
  }

  $._cdt.getColorPalettes = function () {
    try {
      var palettes = [];
      var globalFolder = new Folder(RB_COLOR_GLOBAL_PATH);
      if (globalFolder.exists) {
        palettes = palettes.concat(listPaletteFiles(RB_COLOR_GLOBAL_PATH, true));
      }

      if (!palettes.length) {
        palettes.push(sanitizePalette(DEFAULT_RB_PALETTE, true));
      }

      var localPath = getRBColorLocalFolderPath();
      ensurePaletteFolder(localPath);
      palettes = palettes.concat(listPaletteFiles(localPath, false));
      return toJSON({ ok: true, palettes: palettes, localPath: localPath });
    } catch (e) {
      return toJSON({ ok: false, palettes: [], message: String(e) });
    }
  };

  $._cdt.saveLocalPalette = function (paletteJSON) {
    try {
      var parsed = parseJSON(paletteJSON || '{}', {});
      var localPath = getRBColorLocalFolderPath();
      ensurePaletteFolder(localPath);
      if (!parsed.id) parsed.id = 'palette_' + String(new Date().getTime());
      var ok = writePaletteFile(localPath, parsed);
      return toJSON({ ok: ok, id: parsed.id, message: ok ? 'Palette saved.' : 'Could not write file.' });
    } catch (e) {
      return toJSON({ ok: false, message: String(e) });
    }
  };

  $._cdt.deleteLocalPalette = function (paletteId) {
    try {
      var localPath = getRBColorLocalFolderPath();
      var file = new File(localPath + '/' + String(paletteId || '') + '.json');
      if (!file.exists) return toJSON({ ok: false, message: 'Palette file not found.' });
      var removed = file.remove();
      return toJSON({ ok: removed, message: removed ? 'Deleted.' : 'Could not delete file.' });
    } catch (e) {
      return toJSON({ ok: false, message: String(e) });
    }
  };

  $._cdt.openColorPaletteDialog = function (paletteJSON, optionsJSON) {
    try {
      var palette = sanitizePalette(parseJSON(paletteJSON || '{}', { colors: [] }), false);
      var options = parseJSON(optionsJSON || '{}', {});
      var allowDelete = !!options.allowDelete;
      var allowImport = !!options.allowImport;
      var allowExport = !!options.allowExport;
      var mode = options.mode || 'edit';

      var dlg = new Window('dialog', mode === 'create' ? 'New Color Palette' : 'Edit Color Palette');
      dlg.orientation = 'column';
      dlg.alignChildren = ['fill', 'top'];
      dlg.spacing = 8;
      dlg.margins = 12;

      dlg.add('statictext', undefined, 'Palette name:');
      var nameInput = dlg.add('edittext', undefined, palette.name || '');
      nameInput.characters = 35;

      var list = dlg.add('listbox', undefined, [], { multiselect: false });
      list.preferredSize = [360, 130];

      function refreshList() {
        list.removeAll();
        for (var i = 0; i < palette.colors.length; i += 1) {
          var c = palette.colors[i];
          list.add('item', c.name + ' (' + c.r + ',' + c.g + ',' + c.b + ')');
        }
        if (palette.colors.length) list.selection = 0;
      }

      var colorRow = dlg.add('group');
      colorRow.orientation = 'row';
      var colorName = colorRow.add('edittext', undefined, 'Color');
      colorName.characters = 14;
      var rInput = colorRow.add('edittext', undefined, '255'); rInput.characters = 4;
      var gInput = colorRow.add('edittext', undefined, '255'); gInput.characters = 4;
      var bInput = colorRow.add('edittext', undefined, '255'); bInput.characters = 4;

      var actionRow = dlg.add('group');
      actionRow.orientation = 'row';
      var addBtn = actionRow.add('button', undefined, 'Add Color');
      var updateBtn = actionRow.add('button', undefined, 'Update');
      var removeBtn = actionRow.add('button', undefined, 'Delete Color');

      addBtn.onClick = function () {
        palette.colors.push({
          name: colorName.text || 'Color',
          r: Math.max(0, Math.min(255, Number(rInput.text || 0))),
          g: Math.max(0, Math.min(255, Number(gInput.text || 0))),
          b: Math.max(0, Math.min(255, Number(bInput.text || 0)))
        });
        refreshList();
      };

      updateBtn.onClick = function () {
        if (!list.selection) return;
        var idx = list.selection.index;
        palette.colors[idx] = {
          name: colorName.text || 'Color',
          r: Math.max(0, Math.min(255, Number(rInput.text || 0))),
          g: Math.max(0, Math.min(255, Number(gInput.text || 0))),
          b: Math.max(0, Math.min(255, Number(bInput.text || 0)))
        };
        refreshList();
      };

      removeBtn.onClick = function () {
        if (!list.selection) return;
        palette.colors.splice(list.selection.index, 1);
        refreshList();
      };

      list.onChange = function () {
        if (!list.selection) return;
        var current = palette.colors[list.selection.index];
        colorName.text = current.name;
        rInput.text = String(current.r);
        gInput.text = String(current.g);
        bInput.text = String(current.b);
      };

      var topButtons = dlg.add('group');
      topButtons.orientation = 'row';
      if (allowImport) {
        var importBtn = topButtons.add('button', undefined, 'Load JSON');
        importBtn.onClick = function () {
          var file = File.openDialog('Select palette JSON', '*.json');
          if (!file) return;
          var imported = readPaletteFile(file, false);
          if (!imported) {
            alert('Could not parse JSON palette.');
            return;
          }
          palette = sanitizePalette(imported, false);
          nameInput.text = palette.name;
          refreshList();
        };
      }
      if (allowExport) {
        var exportBtn = topButtons.add('button', undefined, 'Export JSON');
        exportBtn.onClick = function () {
          var target = File.saveDialog('Export palette as JSON', '*.json');
          if (!target) return;
          target.encoding = 'UTF-8';
          if (!target.open('w')) return;
          target.write(stringifyJSON(sanitizePalette(palette, false)));
          target.close();
          alert('Palette exported.');
        };
      }

      var buttons = dlg.add('group');
      buttons.orientation = 'row';
      buttons.alignment = ['right', 'center'];
      var deleteBtn = null;
      if (allowDelete) deleteBtn = buttons.add('button', undefined, 'Delete Palette');
      buttons.add('button', undefined, 'Cancel', { name: 'cancel' });
      var saveBtn = buttons.add('button', undefined, 'Save', { name: 'ok' });

      var response = { ok: true, action: 'cancel' };
      if (deleteBtn) {
        deleteBtn.onClick = function () {
          if (!confirm('Delete this palette?')) return;
          response.action = 'delete';
          dlg.close(1);
        };
      }
      saveBtn.onClick = function () {
        palette.name = nameInput.text || 'Custom';
        response.action = 'save';
        response.palette = sanitizePalette(palette, false);
        dlg.close(1);
      };

      refreshList();
      dlg.show();
      return toJSON(response);
    } catch (e) {
      return toJSON({ ok: false, action: 'cancel', message: String(e) });
    }
  };

  $._cdt.openSettingsDialog = function () {
    try {
      var currentFolder = readSetting(SETTINGS_FOLDER_KEY, DEFAULT_SCRIPTS_PATH);
      var currentShowLabels = readSetting(SETTINGS_SHOW_LABELS_KEY, 'false') === 'true';
      var currentShowLog = readSetting(SETTINGS_SHOW_LOG_KEY, 'false') === 'true';

      var dlg = new Window('dialog', 'Commotion Designer Toolkit Settings');
      dlg.orientation = 'column';
      dlg.alignChildren = ['fill', 'top'];
      dlg.spacing = 10;
      dlg.margins = 14;

      var folderGroup = dlg.add('group');
      folderGroup.orientation = 'column';
      folderGroup.alignChildren = ['fill', 'top'];
      folderGroup.add('statictext', undefined, 'Scripts folder:');
      var folderInput = folderGroup.add('edittext', undefined, currentFolder);
      folderInput.characters = 55;

      var browseBtn = folderGroup.add('button', undefined, 'Browse…');
      browseBtn.onClick = function () {
        var picked = Folder.selectDialog('Select Commotion Designer Toolkit scripts folder');
        if (picked) folderInput.text = sanitizePath(picked.fsName);
      };

      var showLabelsCheckbox = dlg.add('checkbox', undefined, 'Show icon labels');
      showLabelsCheckbox.value = currentShowLabels;

      var showLogCheckbox = dlg.add('checkbox', undefined, 'Show bottom log panel');
      showLogCheckbox.value = currentShowLog;

      var updateState = parseJSON($._cdt.checkLocalUpdateStatus(), { ok: false, different: false, message: '' });
      var updateInfo = getUpdateInfo();
      var updateStatusText = dlg.add('statictext', undefined, updateState.message || '');
      var versionText = dlg.add('statictext', undefined, 'Current version: ' + updateInfo.version);

      var buttonRow = dlg.add('group');
      buttonRow.orientation = 'row';
      buttonRow.alignment = ['right', 'center'];

      var updateBtn = buttonRow.add('button', undefined, updateState.different ? 'Update' : "You're up to date");
      updateBtn.enabled = !!updateState.different;
      updateBtn.onClick = function () {
        var updateRaw = $._cdt.localUpdate();
        var updateRes = parseJSON(updateRaw, { ok: false, message: 'Invalid host response.' });
        if (updateRes.ok) {
          alert('Update successful: ' + updateRes.message);
          updateBtn.text = "You're up to date";
          updateBtn.enabled = false;
          updateStatusText.text = 'You are up to date.';
        } else {
          alert('Update failed: ' + updateRes.message);
        }
      };

      var aboutBtn = buttonRow.add('button', undefined, 'About');
      aboutBtn.onClick = function () {
        alert(
          'Commotion Designer Toolkit\n\n' +
            'Current version: ' +
            updateInfo.version +
            '\n\nLast update notes:\n' +
            updateInfo.lastUpdateNotes +
            '\n\nCreated by a random guy in Red Bull Media House. All rights reserved, I guess?'
        );
      };

      buttonRow.add('button', undefined, 'Cancel', { name: 'cancel' });
      var saveBtn = buttonRow.add('button', undefined, 'Save', { name: 'ok' });

      saveBtn.onClick = function () {
        var folder = sanitizePath(folderInput.text || '');
        if (!folder) {
          alert('Please select a scripts folder.');
          return;
        }

        $._cdt.saveState(folder, 45, showLabelsCheckbox.value, false, showLogCheckbox.value);
        dlg.close(1);
      };

      var result = dlg.show();
      if (result === 1) {
        return toJSON({ ok: true, saved: true, message: 'Settings saved.' });
      }

      return toJSON({ ok: true, saved: false, message: 'Settings cancelled.' });
    } catch (e) {
      return toJSON({ ok: false, saved: false, message: String(e) });
    }
  };

  $._cdt.runScript = function (scriptPath) {
    try {
      var file = new File(sanitizePath(scriptPath));
      if (!file.exists) return toJSON({ ok: false, message: 'Script file not found.' });
      $.evalFile(file);
      return toJSON({ ok: true, message: 'Script executed successfully.' });
    } catch (e) {
      return toJSON({ ok: false, message: String(e) });
    }
  };
})();
