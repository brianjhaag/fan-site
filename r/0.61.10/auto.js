


const Auto = (() => {
  
  function priced(ev) {
    ((ev && ev.games) || []).forEach(({ id, q }) => {
      if (!q || q.skip || q.start == null) return;
      let doc;
      try { doc = fan.records.get("slate", id); } catch (e) { return; }
      if (!doc || Array.isArray(doc.final)) return;   
      try { fan.records.update("slate", id, Calc.freshPrices({ t: new Date(q.start).toISOString(), lad: doc.lad }, q, fan.now())); } catch (e) {}
    });
  }
  fan.on("prices", priced);
  return { priced };
})();
