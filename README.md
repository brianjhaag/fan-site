# Fan

The page's files, in plain words. In the `fan` repo they're in `src/`; on `fan-site`, the published page, they sit at the top, with `fan.html` as `index.html`. The pictures and fonts the page uses are packed into `data` and `fonts`.

- **fan.html**: the frame of the page: the strips, the tabs and the empty boxes the code fills in.
- **fan.css**: every color, size and position on the page.
- **start.js**: runs last, opens the page on the current week and connects everything.
- **base.js**: the core: the tabs, the leagues, and the settings everything else reads.
- **layout.js**: the strips of tabs and fitting the page to the window.
- **cards.js**: the game cards: each team's badge, the lines, the buttons down the side, and the cards in kickoff windows.
- **calc.js**: the money math: wagers, risk, P/L, the models, Kalshi's fees. Every number you trade on comes from here, and each rule has a test.
- **risk.js**: the risk detail and the totals card.
- **panels.js**: Playbook, Season stats, Graphs and the game previews.
- **tracker.js**: the wager ticket, saved tickets and Ledger.
- **trade.js**: Place: sending an order to Kalshi through your connector.
- **settings.js**: the settings window and its tabs: Application, Leagues, Telecasts, Sportsbooks, Look/feel.
- **telecasts.js**: telecasts and the wall: where each network comes from, what a game's telecast button does, the wall (every computer's screens, the day's games, sound and Snap back) and the rest of the Telecasts tab.
- **qr.js**: draws a QR code for the iPad to scan, made by the page itself.
- **code.js**: the Code section: your algos, the editor and the console.
- **hosts.js**: how the page talks to your connector (records, prices, orders, telecasts), or to the browser when there's no connector.
- **espn.js**: the page's own pull from ESPN: schedules, scores, team stats and injuries.
- **leagues.js**: every team in every league: codes, colors, logos.
- **shared.js**: the list of leagues and their settings, read by both the page and the connector.
- **lines.js**: how the connector pulls prices from Kalshi and Polymarket US and turns them into lines. It lives here so a page release can change it without a new program.
- **auto.js**: the small job the connector runs with no page open: fresh prices into the saved lines.
