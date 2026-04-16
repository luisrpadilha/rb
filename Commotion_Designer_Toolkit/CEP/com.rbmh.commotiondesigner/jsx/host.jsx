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
  var RB_COLOR_GLOBAL_ASE = RB_COLOR_GLOBAL_PATH + '/redbull.ase';
  var RB_COLOR_LOCAL_FOLDER_KEY = 'rbColorLocalFolder';
  var LEGACY_HIDDEN = { 'color palette': true, 'standard': true, 'standard 2': true };
  var DEFAULT_RB_PALETTE = {
    id: 'redbull.ase',
    name: 'Red Bull',
    readOnly: true,
    filePath: RB_COLOR_GLOBAL_ASE,
    colors: [
      { name: 'RED', r: 210, g: 0, b: 60 },
      { name: 'BLUE', r: 15, g: 0, b: 105 },
      { name: 'YELLOW', r: 255, g: 204, b: 0 },
      { name: 'GREY', r: 218, g: 218, b: 218 }
    ]
  };

  function clamp255(value) {
    var n = Number(value);
    if (!isFinite(n)) n = 0;
    if (n < 0) n = 0;
    if (n > 255) n = 255;
    return Math.round(n);
  }

  function sanitizeName(name) {
    var value = String(name || '');
    var illegal = ['\\', '/', ':', '*', '?', '"', '<', '>', '|'];
    var i;
    for (i = 0; i < illegal.length; i += 1) {
      while (value.indexOf(illegal[i]) !== -1) {
        value = value.replace(illegal[i], '_');
      }
    }
    value = value.replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ');
    return value || 'Palette';
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

    if (exponent === 255) return 0;
    return sign * (1 + mantissa / Math.pow(2, 23)) * Math.pow(2, exponent - 127);
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

  function encodeAse(colors) {
    var blocks = '';
    for (var i = 0; i < colors.length; i += 1) {
      var color = normalizeColor(colors[i], 'Color ' + (i + 1));
      var swatchName = String(color.name || ('Color ' + (i + 1)));
      var charCount = swatchName.length + 1;
      var nameBytes = u16be(charCount);
      var j;
      for (j = 0; j < swatchName.length; j += 1) {
        nameBytes += u16be(swatchName.charCodeAt(j));
      }
      nameBytes += u16be(0);

      var rgbPart = 'RGB ' +
        floatToBinary32BE(color.r / 255) +
        floatToBinary32BE(color.g / 255) +
        floatToBinary32BE(color.b / 255) +
        u16be(0);

      var blockBody = nameBytes + rgbPart;
      blocks += u16be(1) + u32be(blockBody.length) + blockBody;
    }

    return 'ASEF' + u16be(1) + u16be(0) + u32be(colors.length) + blocks;
  }

  function decodeAse(file) {
    var colors = [];
    if (!file || !file.exists) return colors;

    try {
      file.encoding = 'BINARY';
      if (!file.open('r')) return colors;
      var raw = file.read();
      file.close();

      if (raw.substr(0, 4) !== 'ASEF') return colors;
      var blockCount = readU32(raw, 8);
      var offset = 12;

      var i;
      for (i = 0; i < blockCount && offset + 6 <= raw.length; i += 1) {
        var blockType = readU16(raw, offset); offset += 2;
        var blockLen = readU32(raw, offset); offset += 4;
        if (offset + blockLen > raw.length) break;
        if (blockType !== 1) { offset += blockLen; continue; }

        var nameLen = readU16(raw, offset); offset += 2;
        var name = '';
        var n;
        for (n = 0; n < nameLen - 1; n += 1) {
          name += String.fromCharCode(readU16(raw, offset));
          offset += 2;
        }
        offset += 2;

        var model = raw.substr(offset, 4); offset += 4;
        if (model === 'RGB ') {
          var r = clamp255(Math.round(binary32ToFloatBE(raw, offset) * 255)); offset += 4;
          var g = clamp255(Math.round(binary32ToFloatBE(raw, offset) * 255)); offset += 4;
          var b = clamp255(Math.round(binary32ToFloatBE(raw, offset) * 255)); offset += 4;
          colors.push({ name: name || ('Color ' + (colors.length + 1)), r: r, g: g, b: b });
        }

        offset += 2;
      }

      return colors;
    } catch (e) {
      try { file.close(); } catch (ignore) {}
      return [];
    }
  }

  function saveAseFile(file, colors) {
    try {
      file.encoding = 'BINARY';
      if (!file.open('w')) return false;
      file.write(encodeAse(colors));
      file.close();
      return true;
    } catch (e) {
      try { file.close(); } catch (ignore2) {}
      return false;
    }
  }

  function getRBColorLocalFolderPath() {
    var current = readSetting(RB_COLOR_LOCAL_FOLDER_KEY, '');
    if (current) return sanitizePath(current);

    var appData = $.getenv('APPDATA');
    var fallback = appData
      ? sanitizePath(appData) + '/RB_Commotion_Designer_Toolkit/local_palettes_ase'
      : '~/RB_Commotion_Designer_Toolkit/local_palettes_ase';
    writeSetting(RB_COLOR_LOCAL_FOLDER_KEY, fallback);
    return fallback;
  }

  function ensurePaletteFolder(path) {
    var folder = new Folder(path);
    if (!folder.exists) folder.create();
    return folder;
  }

  function loadGlobalPalette() {
    var file = new File(RB_COLOR_GLOBAL_ASE);
    var palette = {
      id: DEFAULT_RB_PALETTE.id,
      name: DEFAULT_RB_PALETTE.name,
      readOnly: true,
      filePath: RB_COLOR_GLOBAL_ASE,
      colors: DEFAULT_RB_PALETTE.colors
    };

    ensurePaletteFolder(RB_COLOR_GLOBAL_PATH);
    if (!file.exists) {
      saveAseFile(file, DEFAULT_RB_PALETTE.colors);
      return palette;
    }

    var loaded = decodeAse(file);
    if (loaded.length) palette.colors = loaded;
    return palette;
  }

  function loadLocalPalettes() {
    var path = getRBColorLocalFolderPath();
    var folder = ensurePaletteFolder(path);
    var files = folder.getFiles(function (entry) { return entry instanceof File && /\.ase$/i.test(entry.name); });
    var palettes = [];

    var i;
    for (i = 0; i < files.length; i += 1) {
      var name = files[i].name.replace(/\.ase$/i, '');
      if (LEGACY_HIDDEN[name.toLowerCase()]) continue;
      var colors = decodeAse(files[i]);
      if (!colors.length) continue;
      palettes.push({
        id: files[i].name,
        name: name,
        readOnly: false,
        filePath: sanitizePath(files[i].fsName),
        colors: colors
      });
    }

    palettes.sort(function (a, b) { return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1; });
    return palettes;
  }

  $._cdt.getColorPalettes = function () {
    try {
      var palettes = [loadGlobalPalette()].concat(loadLocalPalettes());
      return toJSON({ ok: true, palettes: palettes, localPath: getRBColorLocalFolderPath() });
    } catch (e) {
      return toJSON({ ok: false, palettes: [], message: String(e) });
    }
  };

  $._cdt.saveLocalPalette = function (paletteJSON) {
    try {
      var parsed = parseJSON(paletteJSON || '{}', {});
      var paletteName = sanitizeName(parsed.name || 'Palette');
      var colors = parsed.colors || [];
      if (!colors.length) return toJSON({ ok: false, message: 'Palette needs at least one color.' });

      var localPath = getRBColorLocalFolderPath();
      ensurePaletteFolder(localPath);

      var previousId = String(parsed.id || '');
      var nextName = paletteName + '.ase';
      var file = new File(localPath + '/' + nextName);
      var saved = saveAseFile(file, colors);
      if (!saved) return toJSON({ ok: false, message: 'Could not write ASE file.' });

      if (previousId && previousId !== nextName) {
        var oldFile = new File(localPath + '/' + previousId);
        if (oldFile.exists) oldFile.remove();
      }

      return toJSON({ ok: true, id: nextName, message: 'Palette saved.' });
    } catch (e) {
      return toJSON({ ok: false, message: String(e) });
    }
  };

  $._cdt.deleteLocalPalette = function (paletteId) {
    try {
      var localPath = getRBColorLocalFolderPath();
      var file = new File(localPath + '/' + String(paletteId || ''));
      if (!file.exists) return toJSON({ ok: false, message: 'Palette file not found.' });
      var removed = file.remove();
      return toJSON({ ok: removed, message: removed ? 'Deleted.' : 'Could not delete file.' });
    } catch (e) {
      return toJSON({ ok: false, message: String(e) });
    }
  };

  $._cdt.copyToClipboard = function (text) {
    try {
      var payload = String(text || '').replace(/"/g, '\\"');
      system.callSystem('cmd.exe /c echo ' + payload + '| clip');
      return toJSON({ ok: true });
    } catch (e) {
      return toJSON({ ok: false, message: String(e) });
    }
  };

  function colorToHexRGB(r, g, b) {
    function pad(v) {
      var s = clamp255(v).toString(16).toUpperCase();
      return s.length < 2 ? '0' + s : s;
    }
    return '#' + pad(r) + pad(g) + pad(b);
  }

  function pickColorWithDialog(initialValue, title) {
    var r = clamp255((initialValue >> 16) & 255);
    var g = clamp255((initialValue >> 8) & 255);
    var b = clamp255(initialValue & 255);

    var dlg = new Window('dialog', title || 'Pick Color');
    dlg.orientation = 'column';
    dlg.alignChildren = ['fill', 'top'];
    dlg.spacing = 8;
    dlg.margins = 12;

    var hexLabel = dlg.add('statictext', undefined, colorToHexRGB(r, g, b));
    hexLabel.alignment = ['fill', 'top'];

    function addChannelRow(labelText, value) {
      var row = dlg.add('group');
      row.orientation = 'row';
      row.alignChildren = ['left', 'center'];
      row.add('statictext', undefined, labelText + ':');
      var slider = row.add('slider', undefined, value, 0, 255);
      slider.preferredSize.width = 210;
      var input = row.add('edittext', undefined, String(value));
      input.characters = 4;
      return { slider: slider, input: input };
    }

    var rRow = addChannelRow('R', r);
    var gRow = addChannelRow('G', g);
    var bRow = addChannelRow('B', b);

    function refreshHex() {
      hexLabel.text = colorToHexRGB(r, g, b);
    }

    function bindChannel(row, setValue) {
      row.slider.onChanging = function () {
        var v = clamp255(row.slider.value);
        row.input.text = String(v);
        setValue(v);
        refreshHex();
      };
      row.input.onChange = function () {
        var v = clamp255(Number(row.input.text));
        row.slider.value = v;
        row.input.text = String(v);
        setValue(v);
        refreshHex();
      };
    }

    bindChannel(rRow, function (v) { r = v; });
    bindChannel(gRow, function (v) { g = v; });
    bindChannel(bRow, function (v) { b = v; });

    var buttonRow = dlg.add('group');
    buttonRow.alignment = ['right', 'center'];
    buttonRow.add('button', undefined, 'Cancel', { name: 'cancel' });
    var okBtn = buttonRow.add('button', undefined, 'Apply', { name: 'ok' });

    okBtn.onClick = function () {
      dlg.close(1);
    };

    var result = dlg.show();
    if (result !== 1) return null;
    return ((clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b));
  }

  function openPreferredColorPicker(initialValue) {
    var normalized = typeof initialValue === 'number' ? initialValue : 0;
    var picked = pickColorWithDialog(normalized, 'Pick Color');
    if (picked !== null) return picked;
    return null;
  }

  $._cdt.pickColor = function (colorJSON) {
    try {
      var parsed = parseJSON(colorJSON || '{}', {});
      var start = (clamp255(parsed.r) << 16) | (clamp255(parsed.g) << 8) | clamp255(parsed.b);
      var picked = openPreferredColorPicker(start);
      if (picked === null || picked < 0) return toJSON({ ok: false, cancelled: true });
      return toJSON({
        ok: true,
        color: {
          name: parsed.name || 'Color',
          r: (picked >> 16) & 255,
          g: (picked >> 8) & 255,
          b: picked & 255
        }
      });
    } catch (e) {
      return toJSON({ ok: false, message: String(e) });
    }
  };

  $._cdt.openColorPaletteDialog = function (paletteJSON, optionsJSON) {
    try {
      var palette = parseJSON(paletteJSON || '{}', {});
      palette.name = sanitizeName(palette.name || 'New Palette');
      palette.colors = palette.colors || [];

      var options = parseJSON(optionsJSON || '{}', {});
      var allowDelete = !!options.allowDelete;
      var allowImport = !!options.allowImport;
      var allowExport = !!options.allowExport;
      var mode = options.mode || 'create';

      var dlg = new Window('dialog', mode === 'create' ? 'Add Palette' : 'Edit Palette');
      dlg.orientation = 'column';
      dlg.alignChildren = ['fill', 'top'];
      dlg.spacing = 8;
      dlg.margins = 12;

      dlg.add('statictext', undefined, 'Palette name:');
      var nameInput = dlg.add('edittext', undefined, palette.name);
      nameInput.characters = 35;

      var list = dlg.add('listbox', undefined, [], { multiselect: false });
      list.preferredSize = [420, 180];

      function refreshList() {
        list.removeAll();
        var i;
        for (i = 0; i < palette.colors.length; i += 1) {
          var c = normalizeColor(palette.colors[i], 'Color ' + (i + 1));
          list.add('item', c.name + ' (#' + ((c.r << 16) | (c.g << 8) | c.b).toString(16).toUpperCase() + ')');
        }
        if (list.items.length) list.selection = list.items[0];
      }

      function pickColor(initial) {
        var picked = openPreferredColorPicker(initial);
        if (picked === null || picked < 0) return null;
        return { r: (picked >> 16) & 255, g: (picked >> 8) & 255, b: picked & 255 };
      }

      var buttons = dlg.add('group');
      buttons.orientation = 'row';
      var addColorBtn = buttons.add('button', undefined, 'Add Color');
      var editColorBtn = buttons.add('button', undefined, 'Edit Color');
      var deleteColorBtn = buttons.add('button', undefined, '✕ Color');
      deleteColorBtn.helpTip = 'Delete selected color';

      addColorBtn.onClick = function () {
        var picked = pickColor();
        if (!picked) return;
        palette.colors.push({
          name: 'Color ' + (palette.colors.length + 1),
          r: picked.r,
          g: picked.g,
          b: picked.b
        });
        refreshList();
      };

      editColorBtn.onClick = function () {
        if (!list.selection) return;
        var idx = list.selection.index;
        var current = normalizeColor(palette.colors[idx], 'Color ' + (idx + 1));
        var picked = pickColor((current.r << 16) | (current.g << 8) | current.b);
        if (!picked) return;
        palette.colors[idx] = { name: current.name, r: picked.r, g: picked.g, b: picked.b };
        refreshList();
      };

      deleteColorBtn.onClick = function () {
        if (!list.selection) return;
        palette.colors.splice(list.selection.index, 1);
        refreshList();
      };

      var ioRow = dlg.add('group');
      ioRow.orientation = 'row';
      if (allowImport) {
        var importBtn = ioRow.add('button', undefined, 'Import .ase');
        importBtn.onClick = function () {
          var file = File.openDialog('Import ASE palette', '*.ase');
          if (!file) return;
          var imported = decodeAse(file);
          if (!imported.length) {
            alert('Could not read ASE palette.');
            return;
          }
          palette.colors = imported;
          palette.name = sanitizeName(file.displayName.replace(/\.ase$/i, ''));
          nameInput.text = palette.name;
          refreshList();
        };
      }
      if (allowExport) {
        var exportBtn = ioRow.add('button', undefined, 'Export .ase');
        exportBtn.onClick = function () {
          if (!palette.colors.length) {
            alert('Add at least one color before exporting.');
            return;
          }
          var file = File.saveDialog('Export ASE palette', '*.ase');
          if (!file) return;
          if (!/\.ase$/i.test(file.name)) file = new File(file.fsName + '.ase');
          if (!saveAseFile(file, palette.colors)) alert('Could not export ASE file.');
        };
      }

      var bottom = dlg.add('group');
      bottom.orientation = 'row';
      bottom.alignment = ['right', 'center'];

      var deleteBtn = null;
      if (allowDelete) deleteBtn = bottom.add('button', undefined, 'Delete Palette');
      bottom.add('button', undefined, 'Cancel', { name: 'cancel' });
      var saveBtn = bottom.add('button', undefined, 'Save', { name: 'ok' });

      var response = { ok: true, action: 'cancel' };
      if (deleteBtn) {
        deleteBtn.onClick = function () {
          if (!confirm('Delete this palette?')) return;
          response.action = 'delete';
          dlg.close(1);
        };
      }

      saveBtn.onClick = function () {
        if (!palette.colors.length) {
          alert('Please add at least one color.');
          return;
        }
        palette.name = sanitizeName(nameInput.text || 'Palette');
        response.action = 'save';
        response.palette = {
          id: palette.id || '',
          name: palette.name,
          readOnly: false,
          colors: palette.colors
        };
        dlg.close(1);
      };

      refreshList();
      var shown = dlg.show();
      if (shown !== 1) return toJSON({ ok: true, action: 'cancel' });
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

      var browseBtn = folderGroup.add('button', undefined, 'Browse...');
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
