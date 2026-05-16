# SwiftBeGone

SwiftBeGone is a lightweight menu-bar/tray app that automatically skips songs from artists, tracks, or patterns you choose to block.

It runs locally on your computer, does not record audio, and does not send listening data to a server.

## Current Status

SwiftBeGone is currently best supported on macOS with Apple Music.

Spotify support exists in the codebase, but new setup is paused for now because Spotify Web API access depends on account/API availability. The app is still being prepared for a public installer release.

## Features

- Automatically skips blocked artists.
- Blocks individual songs.
- Blocks song title patterns like `*Live`, `*Acoustic`, and `*Remix`.
- Supports reverse mode, where only allowed artists can play.
- Optionally blocks collaborations that include a blocked artist.
- Tracks session and all-time block counts.
- Keeps a local recent-song history.
- Supports blocklist export/import as JSON.
- Runs from the macOS menu bar or Windows system tray.
- Stores settings locally with `electron-store`.

## Installation

### For most users

Published installers will be available from the GitHub Releases page once the first release is packaged:

https://github.com/swiftbegone/swiftbegonesongskip/releases

Until a release is published, users need to run SwiftBeGone from source.

### Run from source

Requirements:

- Node.js 18 or newer
- npm
- macOS for Apple Music support

Install and run:

```bash
git clone https://github.com/swiftbegone/swiftbegonesongskip.git
cd swiftbegonesongskip
npm install
npm run dev
```

SwiftBeGone will appear in the macOS menu bar. It is intentionally hidden from the Dock while running. Open the menu-bar icon and choose `Dashboard...` to manage the blocklist.

### Build local installers

```bash
npm install
npm run dist
```

Build output is written to `dist/`.

Notes:

- macOS builds may require code signing and notarization before they are smooth to install on other Macs.
- Unsigned local builds may trigger macOS Gatekeeper warnings.
- Windows builds are configured through `electron-builder`, but Windows media-session support is not implemented yet.

## macOS Apple Music Setup

No account setup is required.

Start Apple Music and play a song. The first time SwiftBeGone tries to read or control Music, macOS may ask for Automation permission:

> SwiftBeGone would like to control the Music app.

Click `Allow`.

If permission was denied, enable it manually:

1. Open `System Settings`.
2. Go to `Privacy & Security`.
3. Open `Automation`.
4. Allow SwiftBeGone or Electron to control Music.

## Using the App

1. Launch SwiftBeGone with `npm run dev` or from a future installed app build.
2. Click the SwiftBeGone icon in the macOS menu bar.
3. Choose `Dashboard...`.
4. Add blocked artists, songs, or patterns.
5. Play music in Apple Music.
6. When a blocked match is detected, SwiftBeGone skips to the next track.

Default blocklist:

```json
{
  "artists": ["Taylor Swift"],
  "tracks": [],
  "patterns": [],
  "blockCollaborations": false,
  "reverseMode": false
}
```

## Blocklist Rules

Rules are evaluated in this order:

1. Reverse mode: if enabled, artists in the artist list are allowed and all other artists are blocked.
2. Track blocks: exact track match, optionally scoped to an artist.
3. Pattern blocks: simple title matching with `*word`, `word*`, or `*word*`.
4. Artist blocks: exact artist match.
5. Collaboration blocks: optional matching for artist strings that include a blocked artist.

Matching is case-insensitive and ignores extra whitespace.

## Development

Common commands:

```bash
npm run dev
npm run check
npm test
npm run dist
```

Project structure:

```text
swiftbegonesongskip/
  src/
    main.js             Electron main process, tray, polling, IPC
    appleMusic.js       macOS Apple Music integration
    spotify.js          Spotify OAuth/API integration
    oauthServer.js      Local OAuth callback server
    blocklist.js        Blocklist normalization and matching rules
    dashboard.html      Dashboard UI
    settings.js         Dashboard renderer code
    settingsPreload.js  Secure dashboard IPC bridge
  tests/
    blocklist.test.js   Core blocklist behavior tests
  assets/
    SwiftBeGone-tray-24.png
    icon.ico
    iconTemplate.icns
  package.json
```

## Platform Support

| Feature | macOS | Windows |
| --- | --- | --- |
| Apple Music skip | Supported | Not available |
| Menu bar / tray UI | Supported | Supported by Electron |
| Spotify skip | Paused | Paused |
| Browser players | Planned | Planned |
| System-wide now playing | Planned | Planned |

## Privacy

SwiftBeGone runs locally.

- No audio recording.
- No telemetry.
- No cloud sync.
- No external database.

Your blocklist and stats are stored on your machine.

## Helpful Links

- Website / setup: https://swiftbegone.xyz
- GitHub repo: https://github.com/swiftbegone/swiftbegonesongskip
- Releases: https://github.com/swiftbegone/swiftbegonesongskip/releases
- Donate: https://buymeacoffee.com/swiftbegone?new=1

## License

MIT License. See [LICENSE](LICENSE).

## Contributing

Issues, feature requests, and pull requests are welcome.
