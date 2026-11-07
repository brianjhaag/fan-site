


const SHARED = {
  schema: 1,
  
  season: { year: 2026, week8: Date.UTC(2026, 9, 28, 6) },
  
  
  fees: { kalshi: 0.07, polymarket: 0.085 },
  
  
  
  refresh: { lines: 900, live: 300, state: 5, games: 600 },
  
  
  
  
  
  leagues: {
    nfl: { name: "NFL", slate: "week", tag: "w", kalshi: "KXNFL", espn: "football/nfl",
      codes: { WAS: "WSH", JAC: "JAX", LA: "LAR", LVR: "LV", NWE: "NE", NOR: "NO", GNB: "GB", TAM: "TB", SFO: "SF", KAN: "KC", SDG: "LAC" },
      espnCodes: { WAS: "WSH", JAC: "JAX", LA: "LAR" },
      polymarket: { spreads: 20, totals: [30, 60], totalWord: true } },
    nba: { name: "NBA", slate: "day", base: 0, tag: "w", kalshi: "KXNBA", espn: "basketball/nba", start: Date.UTC(2026, 9, 20), days: 7, neutralTotal: 220,
      codes: { GS: "GSW", NO: "NOP", NY: "NYK", PHO: "PHX", SA: "SAS" },   
      espnCodes: { GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS", UTAH: "UTA", WSH: "WAS" },
      polymarket: { spreads: 16, totals: [200, 250], totalWord: false } },   
    
    nhl: { name: "NHL", slate: "day", base: 1e8, tag: "nhl", kalshi: "KXNHL", espn: "hockey/nhl", start: Date.UTC(2026, 9, 6), days: 7, neutralTotal: 6,   
      codes: { UTAH: "UTA", MON: "MTL", NAS: "NSH", VEG: "VGK", WAS: "WSH" },
      espnCodes: { UTAH: "UTA", MON: "MTL", NAS: "NSH", VEG: "VGK", WAS: "WSH" },
      polymarket: { spreads: 2, totals: [3, 9], totalWord: false } },
    mlb: { name: "MLB", nextYear: true },
    
    ncaafb: { name: "NCAA FB", nextYear: true, listedAs: "later" },
    ncaabb: { name: "NCAA BB", nextYear: true, listedAs: "later" }
  }
};
export { SHARED };
