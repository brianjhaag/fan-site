// The connector's own work in its engine, with or without a page open: it runs here beside calc.js and reaches the world only through `fan` (the connector's README).
// Today, one job: each second the live book moved, the games it moved get their fresh prices in the saved lines, as a fill's read gives the page. Arm, the triggers and responses that lived here,
// was taken out on Nov 3 2026 to make way for algos (TRADING.md), which the connector's runtime will run; this file is where that runtime's page side starts.
const Auto = (() => {
  // The games the live book moved in the last second: their saved lines, so the page follows the market.
  function priced(ev) {
    ((ev && ev.games) || []).forEach(({ id, q }) => {
      if (!q || q.skip || q.start == null) return;
      let doc;
      try { doc = fan.records.get("slate", id); } catch (e) { return; }
      if (!doc || Array.isArray(doc.final)) return;   // not in the slate yet, or over
      try { fan.records.update("slate", id, Calc.freshPrices({ t: new Date(q.start).toISOString(), lad: doc.lad }, q, fan.now())); } catch (e) {}
    });
  }
  fan.on("prices", priced);
  return { priced };
})();
