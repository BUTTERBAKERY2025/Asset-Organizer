(function () {
  if (!("serviceWorker" in navigator)) return;

  var attempts = 0;
  var retryTimer;
  var inFlight = false;
  var onlinePending = false;

  function registerServiceWorker() {
    clearTimeout(retryTimer);
    retryTimer = undefined;
    if (inFlight) {
      onlinePending = true;
      return;
    }
    inFlight = true;
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then(function (registration) {
      attempts = 0;
      onlinePending = false;
      registration.update().catch(function (error) {
        console.warn("Service worker update check failed:", error);
      });
    }).catch(function (error) {
      attempts += 1;
      console.error("Service worker registration failed:", error);
      if (onlinePending) {
        onlinePending = false;
        retryTimer = setTimeout(registerServiceWorker, 0);
      } else {
        retryTimer = setTimeout(registerServiceWorker, Math.min(60000, 3000 * Math.pow(2, Math.min(attempts - 1, 5))));
      }
    }).finally(function () {
      inFlight = false;
    });
  }

  window.addEventListener("online", registerServiceWorker);
  registerServiceWorker();
})();