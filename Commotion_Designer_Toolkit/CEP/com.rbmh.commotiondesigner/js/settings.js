(function () {
  var DEFAULT_SCRIPTS_PATH = 'G:/04_Library/16_scripts/Custom_Scripts/AFX_EXPRESSIONS/RB_Commotion_Designer_Toolkit/scripts';

  var state = {
    scriptsFolder: DEFAULT_SCRIPTS_PATH,
    showLabels: false,
    showLog: false,
    updateInfo: null
  };

  var els = {
    status: document.getElementById('status'),
    folderPath: document.getElementById('folderPath'),
    browseBtn: document.getElementById('browseBtn'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    showLabelsToggle: document.getElementById('showLabelsToggle'),
    showLogToggle: document.getElementById('showLogToggle'),
    localUpdateBtn: document.getElementById('localUpdateBtn'),
    currentVersion: document.getElementById('currentVersion'),
    aboutBtn: document.getElementById('aboutBtn')
  };

  function setStatus(message) {
    els.status.textContent = message;
  }

  function safeEval(script, done) {
    window.csInterface.evalScript(script, function (result) {
      done(result);
    });
  }

  function parseJSON(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function escapeForEval(path) {
    return path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  function notifyMainPanel() {
    if (window.opener && window.opener.cdtMain && typeof window.opener.cdtMain.refreshFromState === 'function') {
      window.opener.cdtMain.refreshFromState();
    }
  }

  function renderVersion() {
    var version = state.updateInfo && state.updateInfo.version ? state.updateInfo.version : '-';
    els.currentVersion.textContent = version;
  }

  function loadUpdateInfo(done) {
    window.fetch('./update.json?ts=' + Date.now())
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (payload) {
        state.updateInfo = payload || null;
      })
      .catch(function () {
        state.updateInfo = null;
      })
      .then(function () {
        renderVersion();
        if (typeof done === 'function') done();
      });
  }

  function saveState() {
    var folder = els.folderPath.value.trim();
    if (!folder) {
      setStatus('Please set a scripts folder.');
      return;
    }

    state.scriptsFolder = folder;
    state.showLabels = !!els.showLabelsToggle.checked;
    state.showLog = !!els.showLogToggle.checked;

    safeEval(
      "$._cdt.saveState('" +
        escapeForEval(folder) +
        "',45," +
        (state.showLabels ? 'true' : 'false') +
        ',false,' +
        (state.showLog ? 'true' : 'false') +
        ')',
      function () {
        setStatus('Settings saved automatically.');
        notifyMainPanel();
      }
    );
  }

  function runLocalUpdate() {
    setStatus('Running local update...');
    safeEval('$._cdt.localUpdate()', function (raw) {
      var res = parseJSON(raw, { ok: false, message: 'Invalid host response.' });
      if (!res.ok) {
        setStatus('Local update failed: ' + res.message);
        window.alert('Update failed: ' + res.message);
        return;
      }

      setStatus('Local update complete: ' + res.message);
      window.alert('Update successful: ' + res.message);
      loadUpdateInfo();
      notifyMainPanel();
    });
  }

  function openAbout() {
    var version = (state.updateInfo && state.updateInfo.version) || '-';
    var notes = (state.updateInfo && state.updateInfo.lastUpdateNotes) || 'No update notes available.';
    var text = [
      'Commotion Designer Toolkit',
      '',
      'Current version: ' + version,
      '',
      'Last update notes:',
      notes,
      '',
      'Created by a random guy in Red Bull Media House. All rights reserved, I guess?'
    ];
    window.alert(text.join('\n'));
  }

  function browseFolder() {
    setStatus('Opening folder picker...');
    safeEval('$._cdt.pickFolder()', function (raw) {
      var result = parseJSON(raw, { ok: false });
      if (!result.ok || !result.path) {
        setStatus('Folder selection cancelled.');
        return;
      }

      els.folderPath.value = result.path;
      saveState();
      setStatus('Selected: ' + result.path);
    });
  }

  function loadState() {
    safeEval('$._cdt.getState()', function (raw) {
      var result = parseJSON(raw, {});

      state.scriptsFolder = result.scriptsFolder || DEFAULT_SCRIPTS_PATH;
      state.showLabels = String(result.showLabels || 'false') === 'true';
      state.showLog = String(result.showLog || 'false') === 'true';

      els.folderPath.value = state.scriptsFolder;
      els.showLabelsToggle.checked = state.showLabels;
      els.showLogToggle.checked = state.showLog;

      setStatus('Ready. Changes save automatically.');
    });
  }

  function wireControls() {
    els.browseBtn.addEventListener('click', browseFolder);
    els.localUpdateBtn.addEventListener('click', runLocalUpdate);
    els.aboutBtn.addEventListener('click', openAbout);

    els.closeSettingsBtn.addEventListener('click', function () {
      window.close();
    });

    els.folderPath.addEventListener('change', saveState);

    els.showLabelsToggle.addEventListener('change', saveState);
    els.showLogToggle.addEventListener('change', saveState);
  }

  wireControls();
  loadUpdateInfo(loadState);
})();
