


(() => { try { const m = localStorage.getItem("fan.mode"); if (m === "light" || m === "dark") document.documentElement.dataset.mode = m; } catch (e) {} })();
