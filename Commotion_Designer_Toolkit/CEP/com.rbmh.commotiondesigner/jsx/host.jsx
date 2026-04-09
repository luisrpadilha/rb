/* global app, Folder, File, $ */

(function () {
  if (!$._cdt) {
    $._cdt = {};
  }

  var SETTINGS_SECTION = 'CommotionDesignerToolkit';
  var SETTINGS_FOLDER_KEY = 'scriptsFolder';
  var SETTINGS_ICON_SIZE_KEY = 'iconSize';

  function toJSON(obj) {
    try {
      return JSON.stringify(obj);
    } catch (err) {
      return '{"ok":false,"message":"JSON stringify failed."}';
    }
  }

  function readSetting(key, fallback) {
    try {
      if (app.settings.haveSetting(SETTINGS_SECTION, key)) {
        return app.settings.getSetting(SETTINGS_SECTION, key);
      }
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
    var meta = {
      name: fallbackName,
      description: 'No description available.'
    };

    if (!metaFile.exists) {
      return meta;
    }

    try {
      metaFile.encoding = 'UTF-8';
      metaFile.open('r');
      var raw = metaFile.read();
      metaFile.close();

      var parsed = JSON.parse(raw);
      meta.name = parsed.name || fallbackName;
      meta.description = parsed.description || meta.description;
    } catch (e) {}

    return meta;
  }

  $._cdt.getState = function () {
    var scriptsFolder = readSetting(SETTINGS_FOLDER_KEY, '');
    var iconSize = readSetting(SETTINGS_ICON_SIZE_KEY, '72');
    var orderRaw = readSetting(getOrderKey(scriptsFolder), '{}');

    return toJSON({
      scriptsFolder: scriptsFolder,
      iconSize: iconSize,
      order: JSON.parse(orderRaw || '{}')
    });
  };

  $._cdt.saveState = function (folderPath, iconSize) {
    writeSetting(SETTINGS_FOLDER_KEY, sanitizePath(folderPath));
    writeSetting(SETTINGS_ICON_SIZE_KEY, String(iconSize || 72));
    return toJSON({ ok: true });
  };

  $._cdt.saveIconSize = function (iconSize) {
    writeSetting(SETTINGS_ICON_SIZE_KEY, String(iconSize || 72));
    return toJSON({ ok: true });
  };

  $._cdt.saveOrder = function (folderPath, orderJSON) {
    var safeFolder = sanitizePath(folderPath || '');
    writeSetting(getOrderKey(safeFolder), orderJSON || '{}');
    return toJSON({ ok: true });
  };

  $._cdt.pickFolder = function () {
    var selected = Folder.selectDialog('Select Commotion Designer Toolkit scripts folder');
    if (!selected) {
      return toJSON({ ok: false, path: '' });
    }

    return toJSON({ ok: true, path: sanitizePath(selected.fsName) });
  };

  $._cdt.scanScripts = function (rootPath) {
    var safeRoot = sanitizePath(rootPath);
    var root = new Folder(safeRoot);

    if (!root.exists) {
      return toJSON({ ok: false, message: 'Configured folder does not exist.', scripts: [] });
    }

    var scriptFolders = root.getFiles(function (entry) {
      return entry instanceof Folder;
    });

    var scripts = [];
    for (var i = 0; i < scriptFolders.length; i += 1) {
      var folder = scriptFolders[i];
      var entries = folder.getFiles();
      var jsxFile = null;
      var svgFile = null;

      for (var j = 0; j < entries.length; j += 1) {
        var file = entries[j];
        if (!(file instanceof File)) {
          continue;
        }

        var name = file.name.toLowerCase();
        if (!jsxFile && /\.jsx$/.test(name)) {
          jsxFile = file;
        }
        if (!svgFile && /\.svg$/.test(name)) {
          svgFile = file;
        }
      }

      if (!jsxFile) {
        continue;
      }

      var metaFile = new File(folder.fsName + '/meta.json');
      var meta = readMeta(metaFile, folder.name);

      scripts.push({
        id: folder.name,
        name: meta.name,
        description: meta.description,
        jsxPath: sanitizePath(jsxFile.fsName),
        iconUri: svgFile ? 'file:///' + sanitizePath(svgFile.fsName) : ''
      });
    }

    return toJSON({ ok: true, scripts: scripts });
  };

  $._cdt.runScript = function (scriptPath) {
    try {
      var file = new File(sanitizePath(scriptPath));
      if (!file.exists) {
        return toJSON({ ok: false, message: 'Script file not found.' });
      }

      $.evalFile(file);
      return toJSON({ ok: true, message: 'Script executed successfully.' });
    } catch (e) {
      return toJSON({ ok: false, message: String(e) });
    }
  };
})();
