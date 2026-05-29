(() => {
  const currentScript = document.currentScript;
  const token = currentScript?.dataset.cloudflareToken?.trim();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

  if (!token || window.location.protocol === "file:" || localHosts.has(window.location.hostname)) {
    return;
  }

  const beacon = document.createElement("script");
  beacon.defer = true;
  beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
  beacon.dataset.cfBeacon = JSON.stringify({ token });

  document.head.append(beacon);
})();
