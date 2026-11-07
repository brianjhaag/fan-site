



(() => {
  const found = location.pathname.match(/\/r\/([^/]+)\//), here = found && found[1];
  if (!here || here === "dev") return;
  const query = new URLSearchParams(location.search);
  let kept = null;
  try { kept = localStorage.getItem("fan.release"); } catch (e) {}
  if (query.has("launch")) {
    query.delete("launch");
    const rest = query.toString() ? "?" + query : "";
    if (kept && kept !== here && /^\d+\.\d+\.\d+$/.test(kept)) {   
      location.replace(location.pathname.replace(/r\/[^/]+\/[^/]*$/, "") + "r/" + kept + "/" + rest + location.hash);
      return;
    }
    history.replaceState(null, "", location.pathname + rest + location.hash);   
  }
  try { localStorage.setItem("fan.release", here); } catch (e) {}
})();
