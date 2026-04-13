(function () {
  var DEFAULT_SCRIPTS_PATH = 'G:/04_Library/16_scripts/Custom_Scripts/AFX_EXPRESSIONS/RB_Commotion_Designer_Toolkit/scripts';

  var state = {
    scriptsFolder: DEFAULT_SCRIPTS_PATH,
    showLabels: false,
    showLog: false,
    scripts: [],
    order: {}
  };

  var els = {
    status: document.getElementById('status'),
    bottomControls: document.getElementById('bottomControls'),
    folderPath: document.getElementById('folderPath'),
    browseBtn: document.getElementById('browseBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    localUpdateBtn: document.getElementById('localUpdateBtn'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    openSettingsFromMain: document.getElementById('openSettingsFromMain'),
    emptyState: document.getElementById('emptyState'),
    emptyStateText: document.getElementById('emptyStateText'),
    scriptGrid: document.getElementById('scriptGrid'),
    showLabelsToggle: document.getElementById('showLabelsToggle'),
    showLogToggle: document.getElementById('showLogToggle')
  };

  var SCREEN_IDS = {
    MAIN: 'mainScreen',
    SETTINGS: 'settingsScreen'
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

  function switchScreen(id) {
    var screens = document.querySelectorAll('.screen');
    Array.prototype.forEach.call(screens, function (screen) {
      screen.classList.toggle('hidden', screen.id !== id);
    });
  }

  function setEmptyState(message, showSettingsLink) {
    els.emptyStateText.textContent = message;
    els.emptyState.classList.remove('hidden');
    els.openSettingsFromMain.classList.toggle('hidden', !showSettingsLink);
    els.scriptGrid.classList.add('hidden');
  }

  function hideEmptyState() {
    els.emptyState.classList.add('hidden');
    els.scriptGrid.classList.remove('hidden');
  }

  function applyLogVisibility() {
    els.bottomControls.classList.toggle('log-hidden', !state.showLog);
  }

  function escapeForEval(path) {
    return path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  function getOrderedScripts(items) {
    var keyed = {};
    var ordered = [];

    for (var i = 0; i < items.length; i += 1) {
      keyed[items[i].id] = items[i];
    }

    Object.keys(state.order)
      .sort(function (a, b) {
        return state.order[a] - state.order[b];
      })
      .forEach(function (id) {
        if (keyed[id]) {
          ordered.push(keyed[id]);
          delete keyed[id];
        }
      });

    Object.keys(keyed)
      .sort()
      .forEach(function (id) {
        ordered.push(keyed[id]);
      });

    return ordered;
  }

  function persistOrder() {
    if (!state.scriptsFolder) return;

    var payload = JSON.stringify(state.order).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    safeEval("$._cdt.saveOrder('" + escapeForEval(state.scriptsFolder) + "','" + payload + "')", function () {});
  }

  function rebuildOrderFromDOM() {
    var nodes = els.scriptGrid.querySelectorAll('.script-btn[data-id]');
    var nextOrder = {};

    Array.prototype.forEach.call(nodes, function (node, idx) {
      if (node.getAttribute('data-id') !== '__settings__') {
        nextOrder[node.getAttribute('data-id')] = idx;
      }
    });

    state.order = nextOrder;
    persistOrder();
  }

  function enableDragAndDrop(button) {
    if (button.getAttribute('data-id') === '__settings__') {
      button.setAttribute('draggable', 'false');
      return;
    }

    button.setAttribute('draggable', 'true');

    button.addEventListener('dragstart', function () {
      button.classList.add('dragging');
    });

    button.addEventListener('dragend', function () {
      button.classList.remove('dragging');
      rebuildOrderFromDOM();
    });

    button.addEventListener('dragover', function (event) {
      event.preventDefault();
      var dragging = els.scriptGrid.querySelector('.dragging');
      if (!dragging || dragging === button || button.getAttribute('data-id') === '__settings__') return;

      var rect = button.getBoundingClientRect();
      var before = event.clientY < rect.top + rect.height / 2;
      if (before) {
        els.scriptGrid.insertBefore(dragging, button);
      } else {
        els.scriptGrid.insertBefore(dragging, button.nextSibling);
      }
    });
  }

  function renderScriptVisual(iconUri) {
    var visual = document.createElement('div');
    visual.className = 'script-visual';

    var icon = document.createElement('div');
    icon.className = 'script-icon';
    var resolved = iconUri || './assets/info.svg';
    icon.style.webkitMaskImage = "url('" + resolved + "')";
    icon.style.maskImage = "url('" + resolved + "')";

    visual.appendChild(icon);
    return visual;
  }

  function runScript(scriptItem, btn) {
    btn.classList.add('is-active');
    setTimeout(function () {
      btn.classList.remove('is-active');
    }, 260);

    setStatus('Running: ' + scriptItem.name + ' ...');
    safeEval("$._cdt.runScript('" + escapeForEval(scriptItem.jsxPath) + "')", function (raw) {
      var res = parseJSON(raw, { ok: false, message: 'Invalid host response.' });
      setStatus(res.ok ? 'Done: ' + scriptItem.name : 'Error: ' + res.message);
    });
  }

  function createSettingsButton() {
    var btn = document.createElement('button');
    btn.className = 'script-btn';
    btn.setAttribute('data-id', '__settings__');
    btn.setAttribute('title', 'Open Settings');
    btn.appendChild(renderScriptVisual('./assets/info.svg'));

    if (state.showLabels) {
      var label = document.createElement('span');
      label.textContent = 'Settings';
      btn.appendChild(label);
    }

    btn.addEventListener('click', function () {
      switchScreen(SCREEN_IDS.SETTINGS);
    });

    enableDragAndDrop(btn);
    return btn;
  }

  function renderScripts(items) {
    els.scriptGrid.innerHTML = '';
    els.scriptGrid.appendChild(createSettingsButton());

    var ordered = getOrderedScripts(items);
    for (var i = 0; i < ordered.length; i += 1) {
      (function (scriptItem) {
        var btn = document.createElement('button');
        btn.className = 'script-btn';
        btn.setAttribute('title', scriptItem.description || 'No description available.');
        btn.setAttribute('data-id', scriptItem.id);

        btn.appendChild(renderScriptVisual(scriptItem.iconUri));

        if (state.showLabels) {
          var label = document.createElement('span');
          label.textContent = scriptItem.name;
          btn.appendChild(label);
        }

        btn.addEventListener('click', function () {
          runScript(scriptItem, btn);
        });

        enableDragAndDrop(btn);
        els.scriptGrid.appendChild(btn);
      })(ordered[i]);
    }

    hideEmptyState();

    if (!ordered.length) {
      setStatus('Warning: No scripts found in selected folder.');
    }
  }

  function loadScripts() {
    if (!state.scriptsFolder) {
      setEmptyState('No scripts path selected yet.', true);
      setStatus('Warning: Please configure a scripts folder.');
      switchScreen(SCREEN_IDS.MAIN);
      return;
    }

    setStatus('Scanning scripts...');
    safeEval("$._cdt.scanScripts('" + escapeForEval(state.scriptsFolder) + "')", function (raw) {
      var result = parseJSON(raw, { ok: false, message: 'Unable to parse scan result.', scripts: [] });
      if (!result.ok) {
        setEmptyState('Script folder is not accessible or invalid. Open Settings.', true);
        renderScripts([]);
        setStatus('Warning: ' + (result.message || 'Could not access scripts folder.'));
        return;
      }

      state.scripts = result.scripts || [];
      renderScripts(state.scripts);
      switchScreen(SCREEN_IDS.MAIN);

      if (!state.scripts.length) {
        setStatus('Warning: Folder accessible, but no scripts found.');
      } else {
        setStatus('Loaded ' + state.scripts.length + ' script(s).');
      }
    });
  }

  function loadState() {
    safeEval('$._cdt.getState()', function (raw) {
      var result = parseJSON(raw, {});

      state.scriptsFolder = result.scriptsFolder || DEFAULT_SCRIPTS_PATH;
      state.order = result.order || {};
      state.showLabels = String(result.showLabels || 'false') === 'true';
      state.showLog = String(result.showLog || 'false') === 'true';

      els.folderPath.value = state.scriptsFolder;
      els.showLabelsToggle.checked = state.showLabels;
      els.showLogToggle.checked = state.showLog;

      applyLogVisibility();
      loadScripts();
    });
  }

  function saveSettings() {
    var folder = els.folderPath.value.trim();
    if (!folder) {
      setStatus('Please set a scripts folder.');
      return;
    }

    state.scriptsFolder = folder;
    state.showLabels = !!els.showLabelsToggle.checked;
    state.showLog = !!els.showLogToggle.checked;
    applyLogVisibility();

    safeEval(
      "$._cdt.saveState('" +
        escapeForEval(folder) +
        "',45," +
        (state.showLabels ? 'true' : 'false') +
        ',false,' +
        (state.showLog ? 'true' : 'false') +
        ')',
      function () {
        setStatus('Settings saved.');
        loadScripts();
        switchScreen(SCREEN_IDS.MAIN);
      }
    );
  }

  function runLocalUpdate() {
    setStatus('Running local update...');
    safeEval('$._cdt.localUpdate()', function (raw) {
      var res = parseJSON(raw, { ok: false, message: 'Invalid host response.' });
      if (!res.ok) {
        setStatus('Local update failed: ' + res.message);
        return;
      }

      setStatus('Local update complete: ' + res.message);
    });
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
      setStatus('Selected: ' + result.path);
    });
  }

  function wireControls() {
    els.browseBtn.addEventListener('click', browseFolder);
    els.saveSettingsBtn.addEventListener('click', saveSettings);
    els.localUpdateBtn.addEventListener('click', runLocalUpdate);

    els.closeSettingsBtn.addEventListener('click', function () {
      switchScreen(SCREEN_IDS.MAIN);
    });

    els.openSettingsFromMain.addEventListener('click', function () {
      switchScreen(SCREEN_IDS.SETTINGS);
    });

    els.showLabelsToggle.addEventListener('change', function () {
      state.showLabels = !!els.showLabelsToggle.checked;
      safeEval('$._cdt.saveShowLabels(' + (state.showLabels ? 'true' : 'false') + ')', function () {
        renderScripts(state.scripts || []);
      });
    });

    els.showLogToggle.addEventListener('change', function () {
      state.showLog = !!els.showLogToggle.checked;
      applyLogVisibility();
      safeEval('$._cdt.saveShowLog(' + (state.showLog ? 'true' : 'false') + ')', function () {});
    });
  }

  function initializeFlyoutMenu() {
    window.csInterface.setFlyoutMenu('<Menu><MenuItem Id="showSettings" Label="Settings" Enabled="true" Checked="false"/></Menu>');
    window.csInterface.onFlyoutClick(function (menuId) {
      if (menuId === 'showSettings') {
        switchScreen(SCREEN_IDS.SETTINGS);
      }
    });
  }

  wireControls();
  initializeFlyoutMenu();
  switchScreen(SCREEN_IDS.MAIN);
  loadState();
})();
