// The shared config (the user's idea, Nov 2 2026): what the page and the connector both read, kept once here so a league or a code fix lands with a page release. The connector reads this file
// from the page it follows and keeps a copy built into its program, for when this one is missing or newer than it understands (`schema`). Data only: no imports, nothing that runs.
// leagues.js adds each league's teams and looks, calc.js keeps the money and model rules (RULES.leagues), and lines.js, the connector's line refreshes, reads the rest.
const SHARED = {
  schema: 1,
  // The NFL season: its year, as ESPN asks for it, and when Week 8 starts, Wednesday Oct 28 2026 at midnight MT; each week is the 7 days from its Wednesday.
  season: { year: 2026, week8: Date.UTC(2026, 9, 28, 6) },
  // Each league. slate: "week", or "day" for a daily league, whose slate is base plus the Eastern-time day as yyyymmdd, so no two leagues share a tab, a ticket's week or a slate document.
  // tag starts the slate documents' ids (w8-…, w20261102-…, nhl20261102-…). kalshi: its series' prefix (KXNFLGAME, KXNFLSPREAD, KXNFLTOTAL). espn: its ESPN scoreboard.
  // codes turn Kalshi's and Polymarket US's team codes into the slate's, espnCodes ESPN's. polymarket: what a full pull asks Polymarket US for, spreads at 1.5 up to this and a half,
  // totals at these whole numbers and a half, named with "total-" or not; null, Kalshi only. start: its season's first day. days: how many day tabs it shows, today first [U, Nov 2 2026: the
  // next seven days]. neutralTotal: the total a game holds before its own prices, never shown.
  leagues: {
    nfl: { name: "NFL", slate: "week", tag: "w", kalshi: "KXNFL", espn: "football/nfl",
      codes: { WAS: "WSH", JAC: "JAX", LA: "LAR", LVR: "LV", NWE: "NE", NOR: "NO", GNB: "GB", TAM: "TB", SFO: "SF", KAN: "KC", SDG: "LAC" },
      espnCodes: { WAS: "WSH", JAC: "JAX", LA: "LAR" },
      polymarket: { spreads: 20, totals: [30, 60], totalWord: true } },
    nba: { name: "NBA", slate: "day", base: 0, tag: "w", kalshi: "KXNBA", espn: "basketball/nba", start: Date.UTC(2026, 9, 20), days: 7, neutralTotal: 220,
      codes: {},
      espnCodes: { GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS", UTAH: "UTA", WSH: "WAS" },
      polymarket: null },
    // The NHL: Kalshi's codes are ESPN's but UTA for Utah; Polymarket US has four of its own. Puck lines at 1.5 and 2.5 goals, and totals named without "total-".
    nhl: { name: "NHL", slate: "day", base: 1e8, tag: "nhl", kalshi: "KXNHL", espn: "hockey/nhl", start: Date.UTC(2026, 9, 6), days: 7, neutralTotal: 6,   // the season's start [C]
      codes: { UTAH: "UTA", MON: "MTL", NAS: "NSH", VEG: "VGK", WAS: "WSH" },
      espnCodes: { UTAH: "UTA", MON: "MTL", NAS: "NSH", VEG: "VGK", WAS: "WSH" },
      polymarket: { spreads: 2, totals: [3, 9], totalWord: false } },
    mlb: { name: "MLB", nextYear: true }
  }
};
export { SHARED };
