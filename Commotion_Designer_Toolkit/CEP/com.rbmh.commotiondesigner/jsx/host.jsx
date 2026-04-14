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
