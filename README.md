SwiftBeGone

The tiny cross-platform app that automatically skips artists you never want to hear again.

SwiftBeGone is a lightweight tray/menu-bar utility for macOS and Windows that detects the currently playing song and automatically skips tracks by blocked artists — with Taylor Swift blocked by default (you can add more in future versions).

It works across major players and browser services (via an upcoming extension), while staying private, local, and easy for anyone to use.

⸻

✨ Features
	•	🎵 Automatically skip blocked artists and songs
Default blocklist: ["Taylor Swift"] — fully customizable via settings.
	•	⚙️ Edit Blocklist… settings window
Add/remove blocked artists, individual songs, and patterns. Supports "Block Current Song" and "Block Current Artist" for quick additions (requires Apple Music playing on macOS).
	•	📊 Block counters and statistics
Track session and all-time statistics for blocked songs by reason (artist, track, pattern, reverse mode).
	•	📜 Song history (last 10 tracks)
View and block songs directly from your recent listening history.
	•	🎯 Pattern blocking
Block songs matching patterns like "*Live", "*Acoustic", "*Remix" (case-insensitive).
	•	👥 Collaboration blocking
Optionally block songs where blocked artists appear in collaborations (e.g., "Taylor Swift feat. Ed Sheeran").
	•	🔄 Reverse mode (whitelist-only)
Block everything except allowed artists — perfect for creating a curated playlist experience.
	•	💾 Export/Import blocklist
Backup and restore your blocklist settings as JSON files.
	•	🟢 Spotify support (macOS + Windows) — ⚠️ Temporarily Unavailable
Spotify has temporarily halted new app registrations in their developer portal. Support will be restored once registrations reopen. Existing connected accounts will continue to work.
	•	🍎 Apple Music support (macOS)
Detects and controls the Music app using safe AppleScript automation.
	•	🖥️ Tray-only UI
Runs quietly in the system tray (Windows) or menu bar (macOS). No big windows.
	•	🕒 Smart cooldown
Prevents rapid-fire skipping (only one skip every 2.5 seconds).
	•	🔌 Upcoming: Browser extension support
For YouTube Music, Amazon Music, Spotify Web, YouTube, and more.
	•	🔐 100% private
No audio recording, no cloud, no telemetry. Everything stays on your device.

⸻

🛠️ Installation

Download builds will appear here once the first release is published.

For now (developers):

git clone https://github.com/swiftbegone/swiftbegonesongskip
cd swiftbegonesongskip
npm install
npm run dev

Build installers:

npm run dist

⸻

🔑 Spotify Setup — ⚠️ Temporarily Unavailable

**Update:** Spotify has temporarily halted new app registrations in their developer portal. New users cannot set up Spotify integration at this time.

**For existing users with connected accounts:** Your Spotify integration will continue to work. The app will still detect and skip tracks from Spotify if you're already connected.

**When Spotify reopens registrations:** Follow these steps to set up Spotify support:

1. **Create a Spotify App:**
   - Go to https://developer.spotify.com/dashboard
   - Log in with your Spotify account
   - Click "Create app"
   - Fill in:
     - App name: `SwiftBeGone` (or any name)
     - App description: `Auto-skip blocked artists`
     - Redirect URI: `http://127.0.0.1:24863/callback`
     - Check "I understand and agree to Spotify's Developer Terms of Service"
   - Click "Save"
   - Click "View client secret" and copy both Client ID and Client Secret

2. **Configure Credentials:**
   
   **Option A: Environment Variables (Recommended for development)**
   ```bash
   export SPOTIFY_CLIENT_ID="your_client_id_here"
   export SPOTIFY_CLIENT_SECRET="your_client_secret_here"
   npm run dev
   ```
   
   **Option B: Store in electron-store (For built apps)**
   - The app will prompt you to enter credentials on first run, OR
   - You can manually set them in the app's config file (location varies by OS)
   - macOS: `~/Library/Application Support/swiftbegone/config.json`
   - Windows: `%APPDATA%\swiftbegone\config.json`

3. **Connect Spotify:**
   - Run the app: `npm run dev`
   - Right-click the tray/menu bar icon
   - Click "Connect Spotify…"
   - Approve the permissions in your browser
   - The app will now automatically skip blocked artists!

**Note:** The redirect URI must be exactly `http://127.0.0.1:24863/callback` in your Spotify app settings.


⸻

🔧 Platform Support

Feature	macOS	Windows
Spotify skip	⚠️ (temporarily unavailable)	⚠️ (temporarily unavailable)
Apple Music skip	✅	❌
System-wide now-playing	⚠️ (future)	⚠️ (future GSMTC)
Browser players (YouTube/Spotify Web/Amazon)	🔜 extension	🔜 extension


⸻

🔑 Setup Instructions

1. Apple Music (macOS) — ✅ Available Now

No setup needed.

macOS will request permission the first time SwiftBeGone tries to control Apple Music:

“SwiftBeGone would like to control the Music app.”

Click Allow.

⸻

2. Spotify — ⚠️ Temporarily Unavailable

Spotify has temporarily halted new app registrations in their developer portal. If you already have Spotify connected, it will continue to work. New users should use Apple Music on macOS until Spotify reopens registrations.

⸻

🧩 How It Works

SwiftBeGone uses a set of "providers" to detect what you're listening to:
	1.	SpotifyProvider → Spotify Web API (⚠️ temporarily unavailable for new users)
	2.	AppleMusicProvider → AppleScript (osascript) — ✅ Available on macOS
	3.	(Planned) BrowserExtensionProvider → Chrome/Edge extension
	4.	(Planned) WindowsMediaProvider → Windows GSMTC API

Whichever provider is actively playing gets priority.
If the detected artist is in your blocklist, SwiftBeGone sends a “skip” command.

⸻

📡 Blocklist Behavior

Default blocklist (stored locally via electron-store):

Artists: ["Taylor Swift"]
Songs: []
Patterns: []
Block Collaborations: false
Reverse Mode: false

Matching rules (priority order):
	1.	Reverse mode (whitelist-only): If enabled, only artists in the allowed list are permitted. All others are blocked.
	2.	Track-level blocks: Exact match against specific song (artist + track). Takes priority over artist-level blocks.
	3.	Pattern matching: Simple glob-like patterns (e.g., "*Live", "*Acoustic", "*Remix") match against track names (case-insensitive).
	4.	Artist-level blocks: Exact match against artist name.
	5.	Collaboration blocking: If enabled, blocks songs where any artist in the track contains a blocked artist (e.g., "Taylor Swift feat. Ed Sheeran").

Matching details:
	•	case-insensitive
	•	trimmed and normalized (collapsed whitespace)
	•	exact match for artists and tracks
	•	pattern matching supports: "*word", "word*", "*word*"

Editing the blocklist:
	•	Right-click the tray/menu bar icon
	•	Select "Edit Blocklist…"
	•	Add/remove blocked artists, songs, and patterns
	•	Use "Block Current Song" to quickly block what's playing (requires Apple Music on macOS)
	•	Use "Block Current Artist" to block the artist of the current song
	•	Block songs directly from the history list
	•	Toggle "Also block collaborations" to block songs with blocked artists in collaborations
	•	Toggle "Reverse mode" to enable whitelist-only mode

Statistics:
	•	View session and all-time block counts by reason (artist, track, pattern, reverse)
	•	Reset session stats or all-time stats independently
	•	Counters update in real-time in the tray menu

History:
	•	View last 10 played songs
	•	Block songs or artists directly from history
	•	See which songs were blocked and why
	•	Clear history at any time

Export/Import:
	•	Export your complete blocklist (artists, songs, patterns, settings) as JSON
	•	Import blocklist from JSON file (replaces current settings)
	•	Useful for backup, sharing, or migrating between devices

⸻

🧱 Project Structure (Simplified)

swiftbegone/
  ├── src/
  │   ├── main.js            # Electron main process
  │   ├── spotify.js         # Spotify OAuth + API
  │   ├── oauthServer.js     # Local OAuth callback server
  │   ├── appleMusic.js      # AppleScript integration
  │   ├── blocklist.js       # Blocklist helpers
  ├── assets/
  │   ├── icon.ico           # Windows tray icon
  │   ├── iconTemplate.png   # macOS template icon
  ├── package.json
  ├── README.md


⸻

🌐 Helpful Links
	•	Website / Setup: https://swiftbegone.xyz
	•	GitHub Repo: https://github.com/swiftbegone/swiftbegonesongskip
	•	Donate (Buy Me a Coffee): https://buymeacoffee.com/swiftbegone?new=1
	•	Browser Extension (coming soon): https://swiftbegone.xyz/#extension

⸻

❤️ Support the Project

If SwiftBeGone made your day quieter, consider supporting development:

👉 https://buymeacoffee.com/swiftbegone?new=1

Your donation helps with:
	•	Code signing certificates
	•	macOS app notarization
	•	Browser extension store fees
	•	Hosting and domain costs

⸻

📄 License

MIT License — see LICENSE￼ for details.

⸻

🤝 Contributing

Issues, feature requests, and pull requests are welcome.
If you want to help build the Windows media-session support or the browser extension, open an issue!

⸻

If you want, I can also generate:
	•	A LICENSE file (MIT)
	•	A polished SECURITY.md
	•	A sleek GitHub Pages index.html matching your branding (we started one)
	•	A “CONTRIBUTING.md” so it looks like a professional open-source project

Just tell me which you want.
