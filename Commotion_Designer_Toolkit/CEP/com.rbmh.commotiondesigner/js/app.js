(function () {
  var DEFAULT_SCRIPTS_PATH = 'G:/04_Library/16_scripts/Custom_Scripts/AFX_EXPRESSIONS/RB_Commotion_Designer_Toolkit/scripts';

  var state = {
    scriptsFolder: DEFAULT_SCRIPTS_PATH,
    showLabels: false,
    showLog: false,
    updateAvailable: false,
    updateInfo: null,
    scripts: [],
    order: {},
    palettes: []
  };

  var els = {
    status: document.getElementById('status'),
    bottomControls: document.getElementById('bottomControls'),
    openSettingsFromMain: document.getElementById('openSettingsFromMain'),
    emptyState: document.getElementById('emptyState'),
    emptyStateText: document.getElementById('emptyStateText'),
    scriptGrid: document.getElementById('scriptGrid'),
    colorPaletteScreen: document.getElementById('colorPaletteScreen'),
    paletteList: document.getElementById('paletteList'),
    paletteBackBtn: document.getElementById('paletteBackBtn')
  };

  var SCREEN_IDS = {
    MAIN: 'mainScreen',
    COLOR_PALETTE: 'colorPaletteScreen'
  };

  var lastKnownGridWidth = -1;
  var lastKnownItemCount = -1;

  function getEffectiveTileSizePx() {
    return state.showLabels ? 92 : 25;
  }

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
    return isFinite(tile) ? tile : getEffectiveTileSizePx();
  }

  function applyLabelModeSizing() {
    var tileSize = getEffectiveTileSizePx();
    document.documentElement.style.setProperty('--tile-size', tileSize + 'px');
    els.scriptGrid.classList.toggle('labels-visible', !!state.showLabels);
    lastKnownGridWidth = -1;
    lastKnownItemCount = -1;
  }

  function formatScriptLabel(name) {
    var text = String(name || '').trim();
    if (!text) return '';
    if (text.length <= 10) return text;
    if (text.length <= 20) return text.slice(0, 10) + '\n' + text.slice(10);
    return text.slice(0, 10) + '\n' + text.slice(10, 17) + '...';
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
    els.scriptGrid.style.gridTemplateColumns = 'repeat(' + columns + ', minmax(0, var(--tile-size)))';
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
    if (state.updateAvailable) {
      setStatus('Update required. Only Settings is available until update is complete.');
      return;
    }

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

  function colorToCSS(color) {
    var r = Math.max(0, Math.min(255, Number(color.r || 0)));
    var g = Math.max(0, Math.min(255, Number(color.g || 0)));
    var b = Math.max(0, Math.min(255, Number(color.b || 0)));
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  }

  function rgbToHex(color) {
    function p(v) {
      var s = Math.max(0, Math.min(255, Number(v || 0))).toString(16).toUpperCase();
      return s.length < 2 ? '0' + s : s;
    }
    return '#' + p(color.r) + p(color.g) + p(color.b);
  }

  function showTransientStatus(message) {
    setStatus(message);
    setTimeout(function () {
      if (els.status.textContent === message) {
        els.status.textContent = 'Ready';
      }
    }, 1300);
  }

  var activeCopyToast = null;

  function showCopyToastAt(x, y) {
    if (activeCopyToast && activeCopyToast.parentNode) {
      activeCopyToast.parentNode.removeChild(activeCopyToast);
    }

    var toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.textContent = 'Copied to clipboard';
    toast.style.left = Math.max(8, Math.round(x + 14)) + 'px';
    toast.style.top = Math.max(8, Math.round(y - 10)) + 'px';
    document.body.appendChild(toast);
    activeCopyToast = toast;

    window.setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
      if (activeCopyToast === toast) activeCopyToast = null;
    }, 1000);
  }

  function renderPaletteCard(palette) {
    var card = document.createElement('div');
    card.className = 'palette-card';

    var swatches = document.createElement('div');
    swatches.className = 'palette-swatches';

    var colors = palette.colors || [];
    for (var i = 0; i < colors.length; i += 1) {
      var swatch = document.createElement('div');
      swatch.className = 'swatch';
      swatch.title = 'Click: copy HEX | Double-click: edit color\n' + colors[i].name + ' (' + colors[i].r + ',' + colors[i].g + ',' + colors[i].b + ')';
      swatch.style.background = colorToCSS(colors[i]);
      (function (colorIndex) {
        swatch.addEventListener('click', function (event) {
          var hex = rgbToHex(palette.colors[colorIndex]);
          safeEval("$._cdt.copyToClipboard('" + hex.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "')", function (raw) {
            var res = parseJSON(raw, { ok: false });
            if (res.ok) {
              showCopyToastAt(event.clientX, event.clientY);
              showTransientStatus(hex + ' copied to clipboard');
            } else {
              setStatus('Could not copy ' + hex);
            }
          });
        });

        swatch.addEventListener('dblclick', function () {
          if (palette.readOnly) {
            return;
          }

          var current = palette.colors[colorIndex];
          var currentJSON = JSON.stringify(current || {}).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          safeEval("$._cdt.pickColor('" + currentJSON + "')", function (pickRaw) {
            var pickRes = parseJSON(pickRaw, { ok: false });
            if (!pickRes.ok || !pickRes.color) return;
            palette.colors[colorIndex] = pickRes.color;

            var paletteJSON = JSON.stringify(palette).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            safeEval("$._cdt.saveLocalPalette('" + paletteJSON + "')", function (saveRaw) {
              var saveRes = parseJSON(saveRaw, { ok: false, message: 'Unable to save palette.' });
              setStatus(saveRes.ok ? 'Palette updated.' : 'Error: ' + saveRes.message);
              loadPalettes();
            });
          });
        });
      })(i);
      swatches.appendChild(swatch);
    }
    card.appendChild(swatches);

    var footer = document.createElement('div');
    footer.className = 'palette-footer';
    var name = document.createElement('span');
    name.className = 'palette-name';
    name.textContent = palette.name || 'Palette';
    footer.appendChild(name);

    if (!palette.readOnly) {
      var editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'palette-edit';
      editBtn.title = 'Edit palette';
      editBtn.style.webkitMaskImage = "url('./assets/edit.svg')";
      editBtn.style.maskImage = "url('./assets/edit.svg')";
      editBtn.addEventListener('click', function () {
        openPaletteEditor(palette);
      });
      footer.appendChild(editBtn);
    }

    card.appendChild(footer);
    return card;
  }

  function renderPalettes() {
    els.paletteList.innerHTML = '';
    els.paletteList.appendChild(els.paletteBackBtn);
    for (var i = 0; i < state.palettes.length; i += 1) {
      els.paletteList.appendChild(renderPaletteCard(state.palettes[i]));
    }

    var plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'palette-add';
    plus.title = 'Add palette';
    plus.textContent = '+';
    plus.addEventListener('click', openNewPaletteDialog);
    els.paletteList.appendChild(plus);
  }

  function loadPalettes(done) {
    safeEval('$._cdt.getColorPalettes()', function (raw) {
      var result = parseJSON(raw, { ok: false, palettes: [], message: 'Invalid palette response.' });
      if (!result.ok) {
        setStatus('Error: ' + (result.message || 'Unable to load palettes.'));
        state.palettes = [];
      } else {
        state.palettes = result.palettes || [];
        setStatus('Loaded ' + state.palettes.length + ' palette(s).');
      }
      renderPalettes();
      if (typeof done === 'function') done();
    });
  }

  function openNewPaletteDialog() {
    safeEval('$._cdt.openColorPaletteDialog("", "{\\"mode\\":\\"create\\",\\"allowDelete\\":false,\\"allowImport\\":true,\\"allowExport\\":false}")', function (raw) {
      var result = parseJSON(raw, { ok: false, action: 'cancel' });
      if (!result.ok || result.action === 'cancel') return;
      if (result.action === 'save') {
        var payload = JSON.stringify(result.palette || {}).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        safeEval("$._cdt.saveLocalPalette('" + payload + "')", function (saveRaw) {
          var saveRes = parseJSON(saveRaw, { ok: false, message: 'Unable to save palette.' });
          setStatus(saveRes.ok ? 'Palette saved.' : 'Error: ' + saveRes.message);
          loadPalettes();
        });
      }
    });
  }

  function openPaletteEditor(palette) {
    var paletteJSON = JSON.stringify(palette || {}).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var optionsJSON = '{"mode":"edit","allowDelete":true,"allowImport":true,"allowExport":true}';
    var evalCommand = "$._cdt.openColorPaletteDialog('" + paletteJSON + "', '" + optionsJSON + "')";
    safeEval(
      evalCommand,
      function (raw) {
        var result = parseJSON(raw, { ok: false, action: 'cancel' });
        if (!result.ok || result.action === 'cancel') return;

        if (result.action === 'delete') {
          safeEval("$._cdt.deleteLocalPalette('" + (palette.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "')", function (delRaw) {
            var delRes = parseJSON(delRaw, { ok: false, message: 'Unable to delete palette.' });
            setStatus(delRes.ok ? 'Palette deleted.' : 'Error: ' + delRes.message);
            loadPalettes();
          });
          return;
        }

        if (result.action === 'save') {
          var payload = JSON.stringify(result.palette || {}).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          safeEval("$._cdt.saveLocalPalette('" + payload + "')", function (saveRaw) {
            var saveRes = parseJSON(saveRaw, { ok: false, message: 'Unable to save palette.' });
            setStatus(saveRes.ok ? 'Palette updated.' : 'Error: ' + saveRes.message);
            loadPalettes();
          });
        }
      }
    );
  }

  function openColorPaletteScreen() {
    switchScreen(SCREEN_IDS.COLOR_PALETTE);
    loadPalettes();
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
    var targetVersion = state.updateInfo && state.updateInfo.version ? ' (v' + state.updateInfo.version + ')' : '';
    btn.setAttribute('title', 'New version found. Please update' + targetVersion);
    btn.appendChild(renderScriptVisual('./assets/update.svg'));

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
      label.textContent = formatScriptLabel('Settings');
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
          label.textContent = formatScriptLabel(scriptItem.name);
          btn.appendChild(label);
        }

        btn.addEventListener('click', function () {
          if (state.updateAvailable) {
            setStatus('Update required. Only Settings is available until update is complete.');
            return;
          }
          var idLower = String(scriptItem.id || '').toLowerCase();
          var nameLower = String(scriptItem.name || '').toLowerCase();
          var isRBColorLauncher =
            idLower === 'rbcolor' ||
            nameLower === 'rbcolor' ||
            nameLower === 'color palette';

          if (isRBColorLauncher) {
            openColorPaletteScreen();
            return;
          }
          runScript(scriptItem, btn);
        });

        enableDragAndDrop(btn);
        if (state.updateAvailable) {
          btn.setAttribute('draggable', 'false');
        }
        btn.classList.toggle('is-disabled', state.updateAvailable);
        btn.disabled = !!state.updateAvailable;
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
      applyLabelModeSizing();
      loadUpdateInfo(function () {
        loadUpdateStatus(function () {
          loadScripts();
        });
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
    els.paletteBackBtn.addEventListener('click', function () {
      switchScreen(SCREEN_IDS.MAIN);
      setStatus('Returned to main panel.');
    });

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

  window.cdtMain = {
    refreshFromState: function () {
      lastKnownGridWidth = -1;
      loadState(function () {
        applyResponsiveGridLayout();
      });
    },
    reloadPanel: function () {
      window.location.reload();
    }
  };

  applyLabelModeSizing();
  wireControls();
  initializeFlyoutMenu();
  switchScreen(SCREEN_IDS.MAIN);
  loadState(function () {
    updateCompactUpdateButton();
  });
})();
