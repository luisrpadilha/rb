(function () {
  var DEFAULT_SCRIPTS_PATH = 'G:/04_Library/16_scripts/Custom_Scripts/AFX_EXPRESSIONS/RB_Commotion_Designer_Toolkit/scripts';

  var state = {
    scriptsFolder: DEFAULT_SCRIPTS_PATH,
    showLabels: false,
    showLog: false,
    updateAvailable: false,
    scripts: [],
    order: {}
  };

  var els = {
    status: document.getElementById('status'),
    bottomControls: document.getElementById('bottomControls'),
    openSettingsFromMain: document.getElementById('openSettingsFromMain'),
    emptyState: document.getElementById('emptyState'),
    emptyStateText: document.getElementById('emptyStateText'),
    scriptGrid: document.getElementById('scriptGrid')
  };

  var SCREEN_IDS = {
    MAIN: 'mainScreen'
  };

  var lastKnownGridWidth = -1;
  var lastKnownItemCount = -1;

  function setStatus(message) {
    els.status.textContent = message;
  }

  function getGridGapPx() {
    var computed = window.getComputedStyle(els.scriptGrid);
    var columnGap = parseFloat(computed.columnGap || computed.gap || '0');
    return isFinite(columnGap) ? columnGap : 0;
  }

  function getTileSizePx() {
    var computed = window.getComputedStyle(document.documentElement);
    var tile = parseFloat(computed.getPropertyValue('--tile-size'));
    return isFinite(tile) ? tile : 25;
  }

  function getResponsiveColumnCount(itemCount) {
    if (!itemCount) return 1;

    var gridWidth = els.scriptGrid.clientWidth || (els.scriptGrid.parentNode ? els.scriptGrid.parentNode.clientWidth : 0);
    if (!gridWidth) return 1;

    var tileSize = getTileSizePx();
    var gap = getGridGapPx();
    var slot = tileSize + gap;
    var maxColumnsThatFit = Math.floor((gridWidth + gap) / slot);
    var columns = Math.max(1, maxColumnsThatFit);
    return Math.min(itemCount, columns);
  }

  function applyResponsiveGridLayout() {
    if (!els.scriptGrid || els.scriptGrid.classList.contains('hidden')) return;

    var gridWidth = els.scriptGrid.clientWidth || (els.scriptGrid.parentNode ? els.scriptGrid.parentNode.clientWidth : 0);
    var itemCount = els.scriptGrid.querySelectorAll('.script-btn').length;
    if (!gridWidth) return;
    if (gridWidth === lastKnownGridWidth && itemCount === lastKnownItemCount) return;

    lastKnownGridWidth = gridWidth;
    lastKnownItemCount = itemCount;
    var columns = getResponsiveColumnCount(itemCount);
    els.scriptGrid.style.gridTemplateColumns = 'repeat(' + columns + ', var(--tile-size))';
    updateCompactUpdateButton();
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
    if (id === SCREEN_IDS.MAIN) applyResponsiveGridLayout();
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

  function runLocalUpdateFromMain() {
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
      loadState(function () {
        applyResponsiveGridLayout();
      });
    });
  }

  function createUpdateButton() {
    var btn = document.createElement('button');
    btn.className = 'script-btn';
    btn.setAttribute('data-id', '__update__');
    btn.setAttribute('title', 'New version found. Please update');
    btn.appendChild(renderScriptVisual('./assets/info.svg'));

    var label = document.createElement('span');
    label.textContent = 'New version found. Please update';
    label.className = 'update-btn-label';
    btn.appendChild(label);

    btn.addEventListener('click', runLocalUpdateFromMain);
    return btn;
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

    btn.addEventListener('click', openSettingsDialog);

    enableDragAndDrop(btn);
    return btn;
  }

  function renderScripts(items) {
    els.scriptGrid.innerHTML = '';
    if (state.updateAvailable) {
      els.scriptGrid.appendChild(createUpdateButton());
    }
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

    applyResponsiveGridLayout();
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

  function loadUpdateStatus(done) {
    safeEval('$._cdt.checkLocalUpdateStatus()', function (raw) {
      var result = parseJSON(raw, { ok: false, different: false });
      state.updateAvailable = !!(result && result.ok && result.different);
      if (typeof done === 'function') done();
    });
  }

  function loadState(done) {
    safeEval('$._cdt.getState()', function (raw) {
      var result = parseJSON(raw, {});

      state.scriptsFolder = result.scriptsFolder || DEFAULT_SCRIPTS_PATH;
      state.order = result.order || {};
      state.showLabels = String(result.showLabels || 'false') === 'true';
      state.showLog = String(result.showLog || 'false') === 'true';

      applyLogVisibility();
      loadUpdateStatus(function () {
        loadScripts();
      });

      if (typeof done === 'function') {
        done();
      }
    });
  }

  function openSettingsDialog() {
    setStatus('Opening settings dialog...');
    safeEval('$._cdt.openSettingsDialog()', function (raw) {
      var result = parseJSON(raw, { ok: false, saved: false, message: 'Unknown settings response.' });
      if (!result.ok) {
        setStatus('Could not open settings dialog.');
        return;
      }

      if (result.saved) {
        setStatus('Settings updated.');
        loadState(function () {
          lastKnownGridWidth = -1;
          lastKnownItemCount = -1;
          applyResponsiveGridLayout();
        });
      } else {
        setStatus(result.message || 'Settings closed.');
      }
    });
  }

  function wireControls() {
    els.openSettingsFromMain.addEventListener('click', openSettingsDialog);

    window.addEventListener('resize', applyResponsiveGridLayout);

    if (typeof ResizeObserver === 'function') {
      var observer = new ResizeObserver(function () {
        lastKnownGridWidth = -1;
        lastKnownItemCount = -1;
        applyResponsiveGridLayout();
        updateCompactUpdateButton();
      });
      observer.observe(document.body);
      observer.observe(els.scriptGrid);
    } else {
      setInterval(function () {
        applyResponsiveGridLayout();
        updateCompactUpdateButton();
      }, 200);
    }
  }

  function updateCompactUpdateButton() {
    var updateBtnLabel = els.scriptGrid.querySelector('.update-btn-label');
    if (!updateBtnLabel) return;
    var columns = getResponsiveColumnCount(els.scriptGrid.querySelectorAll('.script-btn').length);
    updateBtnLabel.textContent = columns <= 1 ? '!' : 'New version found. Please update';
  }

  function initializeFlyoutMenu() {
    window.csInterface.setFlyoutMenu('<Menu><MenuItem Id="showSettings" Label="Settings" Enabled="true" Checked="false"/></Menu>');
    window.csInterface.onFlyoutClick(function (menuId) {
      if (menuId === 'showSettings') {
        openSettingsDialog();
      }
    });
  }

  wireControls();
  initializeFlyoutMenu();
  switchScreen(SCREEN_IDS.MAIN);
  loadState(function () {
    updateCompactUpdateButton();
  });
})();
