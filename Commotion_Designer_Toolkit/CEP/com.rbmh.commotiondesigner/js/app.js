(function () {
  var state = {
    scriptsFolder: '',
    iconSize: 72,
    showLabels: false,
    showSlider: true,
    scripts: [],
    order: {}
  };

  var els = {
    status: document.getElementById('status'),
    folderPath: document.getElementById('folderPath'),
    browseBtn: document.getElementById('browseBtn'),
    saveConfigBtn: document.getElementById('saveConfigBtn'),
    closeConfigBtn: document.getElementById('closeConfigBtn'),
    closeAboutBtn: document.getElementById('closeAboutBtn'),
    openConfigFromMain: document.getElementById('openConfigFromMain'),
    emptyState: document.getElementById('emptyState'),
    emptyStateText: document.getElementById('emptyStateText'),
    scriptGrid: document.getElementById('scriptGrid'),
    iconSize: document.getElementById('iconSize'),
    showLabelsToggle: document.getElementById('showLabelsToggle'),
    bottomControls: document.querySelector('.bottom-controls')
  };

  var SCREEN_IDS = {
    MAIN: 'mainScreen',
    CONFIG: 'configScreen',
    ABOUT: 'aboutScreen'
  };

  var RESPONSIVE = {
    hideSliderAtWidth: 230,
    minAutoIconSize: 64,
    iconPadding: 30
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

  function setEmptyState(message, showConfigLink) {
    els.emptyStateText.textContent = message;
    els.emptyState.classList.remove('hidden');
    els.openConfigFromMain.classList.toggle('hidden', !showConfigLink);
    els.scriptGrid.classList.add('hidden');
  }

  function hideEmptyState() {
    els.emptyState.classList.add('hidden');
    els.scriptGrid.classList.remove('hidden');
  }

  function applyTileSize(size) {
    document.documentElement.style.setProperty('--tile-size', size + 'px');
  }

  function updateResponsiveLayout() {
    var width = window.innerWidth || 400;
    var autoHideSlider = width < RESPONSIVE.hideSliderAtWidth;
    var sliderVisible = state.showSlider && !autoHideSlider;

    els.bottomControls.classList.toggle('slider-hidden', !sliderVisible);

    if (autoHideSlider) {
      var autoSize = Math.max(
        RESPONSIVE.minAutoIconSize,
        Math.min(state.iconSize, Math.floor(width - RESPONSIVE.iconPadding))
      );
      applyTileSize(autoSize);
      return;
    }

    applyTileSize(state.iconSize);
  }

  function escapeForEval(path) {
    return path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  function getOrderedScripts(items) {
    var keyed = {};
    var ordered = [];
    var id;

    for (var i = 0; i < items.length; i += 1) {
      keyed[items[i].id] = items[i];
    }

    var orderedIds = Object.keys(state.order).sort(function (a, b) {
      return state.order[a] - state.order[b];
    });

    for (var j = 0; j < orderedIds.length; j += 1) {
      id = orderedIds[j];
      if (keyed[id]) {
        ordered.push(keyed[id]);
        delete keyed[id];
      }
    }

    var remaining = Object.keys(keyed).sort();
    for (var k = 0; k < remaining.length; k += 1) {
      ordered.push(keyed[remaining[k]]);
    }

    return ordered;
  }

  function persistOrder() {
    if (!state.scriptsFolder) return;

    var payload = JSON.stringify(state.order).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    safeEval("$._cdt.saveOrder('" + escapeForEval(state.scriptsFolder) + "','" + payload + "')", function () {});
  }

  function rebuildOrderFromDOM() {
    var nodes = els.scriptGrid.querySelectorAll('.script-btn');
    var nextOrder = {};

    Array.prototype.forEach.call(nodes, function (node, idx) {
      nextOrder[node.getAttribute('data-id')] = idx;
    });

    state.order = nextOrder;
    persistOrder();
  }

  function enableDragAndDrop(button) {
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
      if (!dragging || dragging === button) return;

      var rect = button.getBoundingClientRect();
      var before = event.clientY < rect.top + rect.height / 2;
      if (before) {
        els.scriptGrid.insertBefore(dragging, button);
      } else {
        els.scriptGrid.insertBefore(dragging, button.nextSibling);
      }
    });
  }

  function renderScriptVisual(scriptItem) {
    var visual = document.createElement('div');
    visual.className = 'script-visual';

    var img = document.createElement('img');
    img.alt = scriptItem.name;
    img.src = scriptItem.iconUri || './assets/info.svg';
    visual.appendChild(img);

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

  function renderScripts(items) {
    els.scriptGrid.innerHTML = '';

    var ordered = getOrderedScripts(items);
    for (var i = 0; i < ordered.length; i += 1) {
      (function (scriptItem) {
        var btn = document.createElement('button');
        btn.className = 'script-btn';
        btn.setAttribute('title', scriptItem.description || 'No description available.');
        btn.setAttribute('data-id', scriptItem.id);

        btn.appendChild(renderScriptVisual(scriptItem));

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

    if (!ordered.length) {
      setEmptyState('No script folders were found in the selected path.', true);
      setStatus('No script packages found.');
      return;
    }

    hideEmptyState();
  }

  function loadScripts() {
    if (!state.scriptsFolder) {
      setEmptyState('No scripts path selected yet.', true);
      setStatus('Please configure a scripts folder first.');
      switchScreen(SCREEN_IDS.MAIN);
      return;
    }

    setStatus('Scanning scripts...');
    safeEval("$._cdt.scanScripts('" + escapeForEval(state.scriptsFolder) + "')", function (raw) {
      var result = parseJSON(raw, { ok: false, message: 'Unable to parse scan result.', scripts: [] });
      if (!result.ok) {
        setEmptyState('Could not load scripts. Open Configuration to verify the folder.', true);
        setStatus('Scan failed: ' + (result.message || 'Unknown error'));
        return;
      }

      state.scripts = result.scripts || [];
      renderScripts(state.scripts);
      switchScreen(SCREEN_IDS.MAIN);
      setStatus('Loaded ' + state.scripts.length + ' script(s).');
    });
  }

  function refreshFlyoutMenu() {
    var menuXML =
      '<Menu>' +
      '<MenuItem Id="refresh" Label="Refresh" Enabled="true" Checked="false"/>' +
      '<MenuItem Label="---"/>' +
      '<MenuItem Id="toggleSlider" Label="Show Icon Size Slider" Enabled="true" Checked="' +
      (state.showSlider ? 'true' : 'false') +
      '"/>' +
      '<MenuItem Label="---"/>' +
      '<MenuItem Id="showMain" Label="Default" Enabled="true" Checked="true"/>' +
      '<MenuItem Id="showConfig" Label="Configure" Enabled="true" Checked="false"/>' +
      '<MenuItem Label="---"/>' +
      '<MenuItem Id="showAbout" Label="About &amp; License..." Enabled="true" Checked="false"/>' +
      '</Menu>';

    window.csInterface.setFlyoutMenu(menuXML);
  }

  function loadState() {
    safeEval('$._cdt.getState()', function (raw) {
      var result = parseJSON(raw, {});
      state.scriptsFolder = result.scriptsFolder || '';
      state.order = result.order || {};
      state.iconSize = Number(result.iconSize || 72);
      state.showLabels = String(result.showLabels || 'false') === 'true';
      state.showSlider = String(result.showSlider || 'true') !== 'false';

      els.folderPath.value = state.scriptsFolder;
      els.iconSize.value = state.iconSize;
      els.showLabelsToggle.checked = state.showLabels;
      updateResponsiveLayout();
      refreshFlyoutMenu();

      if (state.scriptsFolder) {
        loadScripts();
      } else {
        setEmptyState('No scripts path selected yet.', true);
        setStatus('Configure scripts folder from panel menu > Configure.');
      }
    });
  }

  function saveConfig() {
    var folder = els.folderPath.value.trim();
    if (!folder) {
      setStatus('Pick a scripts folder first.');
      return;
    }

    state.scriptsFolder = folder;
    state.showLabels = !!els.showLabelsToggle.checked;

    state.iconSize = Number(els.iconSize.value || 72);
    updateResponsiveLayout();

    safeEval(
      "$._cdt.saveState('" +
        escapeForEval(folder) +
        "'," +
        state.iconSize +
        ',' +
        (state.showLabels ? 'true' : 'false') +
        ',' +
        (state.showSlider ? 'true' : 'false') +
        ')',
      function () {
        setStatus('Configuration saved.');
        loadScripts();
      }
    );
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
    els.saveConfigBtn.addEventListener('click', saveConfig);
    els.closeConfigBtn.addEventListener('click', function () {
      switchScreen(SCREEN_IDS.MAIN);
    });
    els.closeAboutBtn.addEventListener('click', function () {
      switchScreen(SCREEN_IDS.MAIN);
    });
    els.openConfigFromMain.addEventListener('click', function () {
      switchScreen(SCREEN_IDS.CONFIG);
    });

    els.iconSize.addEventListener('input', function () {
      state.iconSize = Number(els.iconSize.value || 72);
      updateResponsiveLayout();
      safeEval('$._cdt.saveIconSize(' + state.iconSize + ')', function () {});
    });

    els.showLabelsToggle.addEventListener('change', function () {
      state.showLabels = !!els.showLabelsToggle.checked;
      safeEval('$._cdt.saveShowLabels(' + (state.showLabels ? 'true' : 'false') + ')', function () {
        renderScripts(state.scripts || []);
      });
    });

    window.addEventListener('resize', updateResponsiveLayout);
  }

  function initializeFlyoutMenu() {
    refreshFlyoutMenu();

    window.csInterface.onFlyoutClick(function (menuId) {
      if (menuId === 'refresh') {
        loadScripts();
      } else if (menuId === 'toggleSlider') {
        state.showSlider = !state.showSlider;
        safeEval('$._cdt.saveShowSlider(' + (state.showSlider ? 'true' : 'false') + ')', function () {});
        updateResponsiveLayout();
        refreshFlyoutMenu();
      } else if (menuId === 'showConfig') {
        switchScreen(SCREEN_IDS.CONFIG);
      } else if (menuId === 'showAbout') {
        switchScreen(SCREEN_IDS.ABOUT);
      } else if (menuId === 'showMain') {
        switchScreen(SCREEN_IDS.MAIN);
      }
    });
  }

  wireControls();
  initializeFlyoutMenu();
  switchScreen(SCREEN_IDS.MAIN);
  loadState();
})();
