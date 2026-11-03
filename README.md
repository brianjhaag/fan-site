# Fan

The page's source files, in `src/`, in plain words. The pictures and fonts the page uses are packed into `src/data` and `src/fonts`.

- **fan.html**: the frame of the page: the strips, the tabs and the empty boxes the code fills in.
- **fan.css**: every color, size and position on the page.
- **start.js**: runs last, opens the page on the current week and connects everything.
- **base.js**: the core: the game cards, the tabs, the leagues, the telecast buttons, and the settings everything else reads.
- **calc.js**: the money math: wagers, risk, P/L, the models, Kalshi's fees. Every number you trade on comes from here, and each rule has a test.
- **risk.js**: the risk detail and the totals card.
- **panels.js**: Playbook, Season stats, Graphs and the game previews.
- **tracker.js**: the wager ticket, saved tickets and Ledger.
- **trade.js**: Place: sending an order to Kalshi through your connector.
- **settings.js**: the settings window and its tabs: Application, Leagues, Telecasts, Sportsbooks, Look/feel.
- **wall.js**: the wall at the top of the Telecasts tab: every computer's screens, the day's games, sound and Snap back.
- **qr.js**: draws a QR code for the iPad to scan, made by the page itself.
- **code.js**: the Code section: your algos, the editor and the console.
- **hosts.js**: how the page talks to your connector (records, prices, orders, telecasts), or to the browser when there's no connector.
- **espn.js**: the page's own pull from ESPN: schedules, scores, team stats and injuries.
- **leagues.js**: every team in every league: codes, colors, logos.
- **shared.js**: the list of leagues and their settings, read by both the page and the connector.
- **lines.js**: how the connector pulls prices from Kalshi and Polymarket US and turns them into lines. It lives here so a page release can change it without a new program.
- **auto.js**: the small job the connector runs with no page open: fresh prices into the saved lines.
