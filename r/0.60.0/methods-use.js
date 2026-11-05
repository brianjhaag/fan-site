// In the connector's engine only (engine.json), after calc.js and the user's own methods file: puts the user's methods in Fan's place, as the page does on connecting (start.js),
// so the page and the engine decide the same way. The report says what was replaced, refused and why; the connector journals it.
var __methodsReport = Calc.useMethods(typeof UserMethods === "undefined" ? null : UserMethods, typeof __userMethodsError === "undefined" ? null : __userMethodsError);
