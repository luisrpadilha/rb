(function () {
  function CEPBridge() {}

  CEPBridge.prototype.evalScript = function (script, callback) {
    if (window.__adobe_cep__ && typeof window.__adobe_cep__.evalScript === 'function') {
      window.__adobe_cep__.evalScript(script, callback || function () {});
      return;
    }

    console.warn('CEP host bridge unavailable. Running in browser preview mode.');
    if (callback) {
      callback('');
    }
  };

  window.csInterface = new CEPBridge();
})();
