(function () {
  function CEPBridge() {
    this.host = window.__adobe_cep__ || null;
  }

  CEPBridge.prototype.evalScript = function (script, callback) {
    if (this.host && typeof this.host.evalScript === 'function') {
      this.host.evalScript(script, callback || function () {});
      return;
    }

    console.warn('CEP host bridge unavailable. Running in browser preview mode.');
    if (callback) {
      callback('');
    }
  };

  CEPBridge.prototype.setFlyoutMenu = function (menuXML) {
    if (!this.host || typeof this.host.invokeSync !== 'function') return;
    this.host.invokeSync('setPanelFlyoutMenu', menuXML);
  };

  CEPBridge.prototype.onFlyoutClick = function (handler) {
    if (!this.host || typeof this.host.addEventListener !== 'function') return;

    this.host.addEventListener('com.adobe.csxs.events.flyoutMenuClicked', function (event) {
      var menuId = event && event.data ? event.data.menuId : '';
      handler(menuId || '');
    });
  };

  window.csInterface = new CEPBridge();
})();
