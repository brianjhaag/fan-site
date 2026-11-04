// Each league's identity in one place, from what adding the NBA and NHL taught on Nov 2 2026: how its slates are numbered and named, where ESPN keeps it,
// and its teams, with their codes, colors, home states and art, keyed the way calc.js's nick() keys them. The money and model rules stay in calc.js (RULES.leagues).
import { HELMETS, NBA_LOGOS, NHL_LOGOS } from "./data/assets.js?v=mw240dec";
import { Calc } from "./calc.js?v=mw240dec";
import { SHARED } from "./shared.js?v=mw240dec";

// A slate is what one tab shows: an NFL week is its number, a daily league's slate its base plus the Eastern-time day. The leagues themselves are the shared config's (shared.js), which the connector reads too.
const LEAGUE_DEFS = SHARED.leagues;
// On the user's word (Nov 2 2026): a first visit has the NFL only; the NBA and NHL can be turned on, and stay as the user left them. MLB waits for next year: struck through in the Leagues tab, not in the league picker.
const LEAGUE_ORDER = Object.keys(LEAGUE_DEFS);
const LEAGUES_READY = LEAGUE_ORDER.filter(k => !LEAGUE_DEFS[k].nextYear), LEAGUES_LATER = LEAGUE_ORDER.filter(k => LEAGUE_DEFS[k].nextYear);
const DAILY = LEAGUE_ORDER.filter(k => LEAGUE_DEFS[k].slate === "day").sort((a, b) => LEAGUE_DEFS[b].base - LEAGUE_DEFS[a].base);
// The league a slate number (a ticket's week) belongs to: under 10000000 an NFL week, 0 a market in no league.
const leagueOfSlate = w => (!w ? null : w < 1e7 ? "nfl" : DAILY.find(k => w > LEAGUE_DEFS[k].base) || null);
const slateOfDay = (l, day) => LEAGUE_DEFS[l].base + day;   // day: an Eastern-time yyyymmdd
const slatePrefix = w => { const l = leagueOfSlate(w), d = LEAGUE_DEFS[l || "nfl"]; return d.tag + (w - (d.base || 0)); };
const metaDocId = w => (w === 7 ? "meta" : "meta" + slatePrefix(w).replace(/^w/, ""));   // Week 7's note document predates the tabs
// A slate's title over the cards: "Week 8", or the league and the day, "NHL Nov 2".
function slateTitleOf(w) {
  const l = leagueOfSlate(w), d = LEAGUE_DEFS[l || "nfl"];
  if (d.slate !== "day") return "Week " + w;
  const day = w - d.base;
  return d.name + " " + new Date(Date.UTC(Math.floor(day / 1e4), Math.floor(day % 1e4 / 100) - 1, day % 100, 12)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// The NFL's teams by nickname: Kalshi's code, the user's team color table [U] (background, text) and home state.
const NFL_ROWS = {
  Cardinals: ["ARI", "#FF0000", "#FFFFFF", "AZ"],
  Falcons: ["ATL", "#000000", "#CC4125", "GA"],
  Ravens: ["BAL", "#000000", "#FFFFFF", "MD"],
  Bills: ["BUF", "#FFFFFF", "#1155CC", "NY"],
  Panthers: ["CAR", "#1155CC", "#F3F3F3", "NC"],
  Bears: ["CHI", "#073763", "#B45F06", "IL"],
  Bengals: ["CIN", "#E69138", "#000000", "OH"],
  Browns: ["CLE", "#B45F06", "#000000", "OH"],
  Cowboys: ["DAL", "#1C4587", "#EFEFEF", "TX"],
  Broncos: ["DEN", "#0000FF", "#E69138", "CO"],
  Lions: ["DET", "#1155CC", "#F3F3F3", "MI"],
  Packers: ["GB", "#FFFF00", "#274E13", "WI"],
  Texans: ["HOU", "#FF0000", "#0B5394", "TX"],
  Colts: ["IND", "#FFFFFF", "#1C4587", "IN"],
  Jaguars: ["JAX", "#000000", "#76A5AF", "FL"],
  Chiefs: ["KC", "#A61C00", "#FFFFFF", "MO"],
  Chargers: ["LAC", "#6D9EEB", "#FFE599", "CA"],
  Rams: ["LAR", "#0000FF", "#FFFF00", "CA"],
  Raiders: ["LV", "#000000", "#FFFFFF", "NV"],
  Dolphins: ["MIA", "#A2C4C9", "#B45F06", "FL"],
  Vikings: ["MIN", "#351C75", "#FFFF00", "MN"],
  Patriots: ["NE", "#CC0000", "#FFFFFF", "MA"],
  Saints: ["NO", "#F1C232", "#000000", "LA"],
  Giants: ["NYG", "#073763", "#FFFFFF", "NJ"],
  Jets: ["NYJ", "#274E13", "#FFFFFF", "NJ"],
  Eagles: ["PHI", "#38761D", "#D9D9D9", "PA"],
  Steelers: ["PIT", "#000000", "#FFFF00", "PA"],
  Seahawks: ["SEA", "#00FFFF", "#0B5394", "WA"],
  "49ers": ["SF", "#FF0000", "#FFD966", "CA"],
  Buccaneers: ["TB", "#B7B7B7", "#CC4125", "FL"],
  Titans: ["TEN", "#3D85C6", "#20124D", "TN"],
  Commanders: ["WSH", "#FF0000", "#FFFF00", "MD"]
};
// The NBA's and NHL's by Kalshi's code: full name, home state or province, then ESPN's team color and alternate color. Not game data.
const NBA_ROWS = {
  ATL: ["Atlanta Hawks", "GA", "#c8102e", "#fdb927"],
  BOS: ["Boston Celtics", "MA", "#008348", "#ffffff"],
  BKN: ["Brooklyn Nets", "NY", "#000000", "#ffffff"],
  CHA: ["Charlotte Hornets", "NC", "#008ca8", "#1d1060"],
  CHI: ["Chicago Bulls", "IL", "#ce1141", "#000000"],
  CLE: ["Cleveland Cavaliers", "OH", "#860038", "#bc945c"],
  DAL: ["Dallas Mavericks", "TX", "#0064b1", "#bbc4ca"],
  DEN: ["Denver Nuggets", "CO", "#0e2240", "#fec524"],
  DET: ["Detroit Pistons", "MI", "#1d428a", "#c8102e"],
  GSW: ["Golden State Warriors", "CA", "#fdb927", "#1d428a"],
  HOU: ["Houston Rockets", "TX", "#ce0e2d", "#000000"],
  IND: ["Indiana Pacers", "IN", "#0c2340", "#ffd520"],
  LAC: ["LA Clippers", "CA", "#12173f", "#c8102e"],
  LAL: ["Los Angeles Lakers", "CA", "#552583", "#fdb927"],
  MEM: ["Memphis Grizzlies", "TN", "#5d76a9", "#12173f"],
  MIA: ["Miami Heat", "FL", "#98002e", "#000000"],
  MIL: ["Milwaukee Bucks", "WI", "#00471b", "#eee1c6"],
  MIN: ["Minnesota Timberwolves", "MN", "#266092", "#79bc43"],
  NOP: ["New Orleans Pelicans", "LA", "#0a2240", "#b4975a"],
  NYK: ["New York Knicks", "NY", "#1d428a", "#f58426"],
  OKC: ["Oklahoma City Thunder", "OK", "#007ac1", "#ef3b24"],
  ORL: ["Orlando Magic", "FL", "#0150b5", "#9ca0a3"],
  PHI: ["Philadelphia 76ers", "PA", "#1d428a", "#e01234"],
  PHX: ["Phoenix Suns", "AZ", "#29127a", "#e56020"],
  POR: ["Portland Trail Blazers", "OR", "#e03a3e", "#000000"],
  SAC: ["Sacramento Kings", "CA", "#5a2d81", "#6a7a82"],
  SAS: ["San Antonio Spurs", "TX", "#000000", "#c4ced4"],
  TOR: ["Toronto Raptors", "ON", "#d91244", "#000000"],
  UTA: ["Utah Jazz", "UT", "#4e008e", "#79a3dc"],
  WAS: ["Washington Wizards", "DC", "#e31837", "#002b5c"]
};
const NHL_ROWS = {
  ANA: ["Anaheim Ducks", "CA", "#fc4c02", "#000000"],
  BOS: ["Boston Bruins", "MA", "#231f20", "#fdb71a"],
  BUF: ["Buffalo Sabres", "NY", "#00468b", "#fdb71a"],
  CGY: ["Calgary Flames", "AB", "#dd1a32", "#000000"],
  CAR: ["Carolina Hurricanes", "NC", "#e30426", "#000000"],
  CHI: ["Chicago Blackhawks", "IL", "#e31937", "#000000"],
  COL: ["Colorado Avalanche", "CO", "#860038", "#005ea3"],
  CBJ: ["Columbus Blue Jackets", "OH", "#002d62", "#e31937"],
  DAL: ["Dallas Stars", "TX", "#20864c", "#000000"],
  DET: ["Detroit Red Wings", "MI", "#e30526", "#ffffff"],
  EDM: ["Edmonton Oilers", "AB", "#00205b", "#ff4c00"],
  FLA: ["Florida Panthers", "FL", "#e51937", "#002d62"],
  LA: ["Los Angeles Kings", "CA", "#121212", "#a2aaad"],
  MIN: ["Minnesota Wild", "MN", "#124734", "#ae122a"],
  MTL: ["Montreal Canadiens", "QC", "#c41230", "#013a81"],
  NSH: ["Nashville Predators", "TN", "#fdba31", "#002d62"],
  NJ: ["New Jersey Devils", "NJ", "#e30b2b", "#000000"],
  NYI: ["New York Islanders", "NY", "#00529b", "#f47d31"],
  NYR: ["New York Rangers", "NY", "#0056ae", "#e51937"],
  OTT: ["Ottawa Senators", "ON", "#dd1a32", "#b79257"],
  PHI: ["Philadelphia Flyers", "PA", "#fe5823", "#000000"],
  PIT: ["Pittsburgh Penguins", "PA", "#000000", "#fdb71a"],
  SJ: ["San Jose Sharks", "CA", "#00788a", "#070707"],
  SEA: ["Seattle Kraken", "WA", "#000d33", "#a3dce4"],
  STL: ["St. Louis Blues", "MO", "#0070b9", "#fdb71a"],
  TB: ["Tampa Bay Lightning", "FL", "#003e7e", "#ffffff"],
  TOR: ["Toronto Maple Leafs", "ON", "#003e7e", "#ffffff"],
  UTA: ["Utah Mammoth", "UT", "#000000", "#7ab2e1"],
  VAN: ["Vancouver Canucks", "BC", "#003e7e", "#008752"],
  VGK: ["Vegas Golden Knights", "NV", "#344043", "#b4975a"],
  WSH: ["Washington Capitals", "DC", "#d71830", "#0b1f41"],
  WPG: ["Winnipeg Jets", "MB", "#002d62", "#c41230"]
};
// Home states and provinces, for the license badge.
const PLATE_STATES = {
  AZ: "Arizona", CA: "California", CO: "Colorado", DC: "Washington D.C.", FL: "Florida", GA: "Georgia", IL: "Illinois", IN: "Indiana", LA: "Louisiana", MA: "Massachusetts", MD: "Maryland", MI: "Michigan", MN: "Minnesota", MO: "Missouri",
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", QC: "Quebec", NC: "North Carolina", NJ: "New Jersey", NV: "Nevada", NY: "New York", OH: "Ohio", OK: "Oklahoma", ON: "Ontario", OR: "Oregon", PA: "Pennsylvania", TN: "Tennessee", TX: "Texas", UT: "Utah", WA: "Washington", WI: "Wisconsin"
};
// Some helmet images carry transparent padding on their left (measured from the alpha channel, % of the image width), so the left edge is trimmed off (object-view-box)
// and every helmet starts at its own left edge.
const HELM_PAD = { Cardinals: 9.565, Rams: 9.565, Seahawks: 9.565, Lions: 1.887, Titans: .952, Buccaneers: .962, Chiefs: .962, Commanders: .971, Falcons: .962 };

// Colors: relative luminance, and the contrast between two colors (WCAG's ratio).
const lumOf = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * r + .7152 * g + .0722 * b; };
const contrast = (a, b) => { const [x, y] = [lumOf(a), lumOf(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
// ESPN's second color, when it's too close to the first to read on it, gives way to white or black, whichever reads better [C]. The NFL keeps the user's table as it is.
const readable = (bg, fg) => (contrast(bg, fg) >= 3 ? fg : contrast(bg, "#ffffff") >= contrast(bg, "#000000") ? "#ffffff" : "#000000");

// Every team of every league, by its key: { lg (its league), code, name, bg, fg, state, art }. art is its helmet or logo, or null.
const TEAM = {};
Object.entries(NFL_ROWS).forEach(([nk, [code, bg, fg, state]]) => { TEAM[nk] = { lg: "nfl", code, name: nk, bg, fg, state, art: HELMETS[nk] || null }; });
const espnTeams = (lg, rows, artOf) => Object.entries(rows).forEach(([code, [name, state, bg, fg]]) => {
  const nk = name.split(" ").pop();
  TEAM[Calc.RULES.leagues[lg].fullNames ? name : nk] = { lg, code, name, bg, fg: readable(bg, fg), state, art: artOf(code, nk) || null };
});
espnTeams("nba", NBA_ROWS, (code, nk) => NBA_LOGOS[nk]);
espnTeams("nhl", NHL_ROWS, code => NHL_LOGOS[code]);
// A team's code by key, as Arm's config and the slate documents want it, and the code for a name, or the name itself.
const ABBR = Object.fromEntries(Object.entries(TEAM).map(([k, t]) => [k, t.code]));
const abbr = n => ABBR[n] || n;
const teamOf = (g, side) => TEAM[Calc.nick(g, side)];
const teamName = (l, code) => (l === "nba" ? NBA_ROWS : NHL_ROWS)[code][0];   // a daily league's full name for a code
const leagueCodes = l => new Set(Object.values(TEAM).filter(t => t.lg === l).map(t => t.code));
const NFL_NICKS = Object.keys(NFL_ROWS);
// A game's slate document id: its slate, then the teams' codes, as the connector writes it.
const slateDocId = g => slatePrefix(g.week) + "-" + ABBR[Calc.nick(g, "away")] + "-" + ABBR[Calc.nick(g, "home")];
export { ABBR, DAILY, HELM_PAD, LEAGUES_LATER, LEAGUES_READY, LEAGUE_DEFS, LEAGUE_ORDER, NFL_NICKS, PLATE_STATES, TEAM, abbr, contrast, leagueCodes, leagueOfSlate, lumOf, metaDocId, slateDocId, slateOfDay, slateTitleOf, teamName, teamOf };
