(function () {
  var state = {
    scriptsFolder: '',
    iconSize: 72,
    scripts: [],
    order: {}
  };

  var els = {
    status: document.getElementById('status'),
    folderPath: document.getElementById('folderPath'),
    browseBtn: document.getElementById('browseBtn'),
    saveConfigBtn: document.getElementById('saveConfigBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    scriptsRootLabel: document.getElementById('scriptsRootLabel'),
    scriptGrid: document.getElementById('scriptGrid'),
    iconSize: document.getElementById('iconSize')
  };

  function setStatus(message) {
    els.status.textContent = message;
  }

  function safeEval(script) {
    return new Promise(function (resolve) {
      window.csInterface.evalScript(script, function (result) {
        resolve(result);
      });
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
    Array.prototype.forEach.call(document.querySelectorAll('.screen'), function (screen) {
      screen.classList.toggle('hidden', screen.id !== id);
    });
  }

  function wireNav() {
    Array.prototype.forEach.call(document.querySelectorAll('.nav-btn'), function (btn) {
      btn.addEventListener('click', function () {
        switchScreen(btn.getAttribute('data-screen'));
      });
    });
  }

  function applyIconSize(size) {
    state.iconSize = size;
    document.documentElement.style.setProperty('--tile-size', size + 'px');
  }

  function escapeForEval(path) {
    return path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  function getOrderedScripts(items) {
    var keyed = {};
    items.forEach(function (item) {
      keyed[item.id] = item;
    });

    var ordered = [];
    Object.keys(state.order).sort(function (a, b) {
      return state.order[a] - state.order[b];
    }).forEach(function (id) {
      if (keyed[id]) {
        ordered.push(keyed[id]);
        delete keyed[id];
      }
    });

    Object.keys(keyed).sort().forEach(function (id) {
      ordered.push(keyed[id]);
    });

    return ordered;
  }

  function persistOrder() {
    if (!state.scriptsFolder) return;

    var payload = JSON.stringify(state.order).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    safeEval("$._cdt.saveOrder('" + escapeForEval(state.scriptsFolder) + "','" + payload + "')");
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

  function renderScripts(items) {
    els.scriptGrid.innerHTML = '';

    var ordered = getOrderedScripts(items);
    ordered.forEach(function (scriptItem) {
      var btn = document.createElement('button');
      btn.className = 'script-btn';
      btn.setAttribute('title', scriptItem.description || 'No description available.');
      btn.setAttribute('data-id', scriptItem.id);

      var img = document.createElement('img');
      img.alt = scriptItem.name;
      img.src = scriptItem.iconUri || './assets/info.svg';

      var label = document.createElement('span');
      label.textContent = scriptItem.name;

      btn.appendChild(img);
      btn.appendChild(label);

      btn.addEventListener('click', function () {
        setStatus('Running: ' + scriptItem.name + ' ...');
        safeEval("$._cdt.runScript('" + escapeForEval(scriptItem.jsxPath) + "')").then(function (raw) {
          var res = parseJSON(raw, { ok: false, message: 'Invalid host response.' });
          setStatus(res.ok ? 'Done: ' + scriptItem.name : 'Error: ' + res.message);
        });
      });

      enableDragAndDrop(btn);
      els.scriptGrid.appendChild(btn);
    });

    if (!ordered.length) {
      setStatus('No script packages found.');
    }
  }

  function loadScripts() {
    if (!state.scriptsFolder) {
      setStatus('Please configure a scripts folder first.');
      switchScreen('configScreen');
      return;
    }

    setStatus('Scanning scripts...');
    safeEval("$._cdt.scanScripts('" + escapeForEval(state.scriptsFolder) + "')").then(function (raw) {
      var result = parseJSON(raw, { ok: false, message: 'Unable to parse scan result.', scripts: [] });
      if (!result.ok) {
        setStatus('Scan failed: ' + (result.message || 'Unknown error'));
        return;
      }

      state.scripts = result.scripts || [];
      els.scriptsRootLabel.textContent = 'Folder: ' + state.scriptsFolder;
      renderScripts(state.scripts);
      switchScreen('mainScreen');
      setStatus('Loaded ' + state.scripts.length + ' script(s).');
    });
  }

  function loadState() {
    safeEval('$._cdt.getState()').then(function (raw) {
      var result = parseJSON(raw, {});
      state.scriptsFolder = result.scriptsFolder || '';
      state.order = result.order || {};
      state.iconSize = Number(result.iconSize || 72);

      els.folderPath.value = state.scriptsFolder;
      els.iconSize.value = state.iconSize;
      applyIconSize(state.iconSize);

      if (state.scriptsFolder) {
        loadScripts();
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
    var iconSize = Number(els.iconSize.value || 72);
    applyIconSize(iconSize);

    safeEval("$._cdt.saveState('" + escapeForEval(folder) + "'," + iconSize + ')').then(function () {
      setStatus('Configuration saved.');
      loadScripts();
    });
  }

  function browseFolder() {
    setStatus('Opening folder picker...');
    safeEval('$._cdt.pickFolder()').then(function (raw) {
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
    els.refreshBtn.addEventListener('click', loadScripts);

    els.iconSize.addEventListener('input', function () {
      var size = Number(els.iconSize.value || 72);
      applyIconSize(size);
      safeEval('$._cdt.saveIconSize(' + size + ')');
    });
  }

  wireNav();
  wireControls();
  loadState();
})();
