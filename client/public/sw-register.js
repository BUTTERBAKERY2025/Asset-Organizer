(function () {
  if (!("serviceWorker" in navigator)) return;

  var attempts = 0;
  var retryTimer;

  function registerServiceWorker() {
    clearTimeout(retryTimer);
    navigator.serviceWorker.register("/sw.js").then(function (registration) {
      attempts = 0;
      registration.update().catch(function (error) {
        console.warn("Service worker update check failed:", error);
      });
    }).catch(function (error) {
      attempts += 1;
      console.error("Service worker registration failed:", error);
      if (attempts < 3) {
        retryTimer = setTimeout(registerServiceWorker, attempts * 3000);
      }
    });
  }

  window.addEventListener("online", registerServiceWorker);
  registerServiceWorker();
})();