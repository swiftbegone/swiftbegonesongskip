SwiftBeGone

The tiny cross-platform app that automatically skips artists you never want to hear again.

SwiftBeGone is a lightweight tray/menu-bar utility for macOS and Windows that detects the currently playing song and automatically skips tracks by blocked artists — with Taylor Swift blocked by default (you can add more in future versions).

It works across major players and browser services (via an upcoming extension), while staying private, local, and easy for anyone to use.

⸻

✨ Features
	•	🎵 Automatically skip blocked artists
Default blocklist: ["Taylor Swift"] — customizable in future versions.
	•	🟢 Spotify support (macOS + Windows)
Uses the official Spotify Web API to read now-playing metadata and send “Next Track”.
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

🔧 Platform Support

Feature	macOS	Windows
Spotify skip	✅	✅
Apple Music skip	✅	❌
System-wide now-playing	⚠️ (future)	⚠️ (future GSMTC)
Browser players (YouTube/Spotify Web/Amazon)	🔜 extension	🔜 extension


⸻

🔑 Setup Instructions

1. Spotify (Recommended)

SwiftBeGone uses the Spotify Web API to detect and skip blocked tracks.

Steps (first run):
	1.	Open SwiftBeGone from your tray/menu bar
	2.	Click Connect Spotify…
	3.	Approve the requested permissions:
	•	user-read-playback-state
	•	user-modify-playback-state

After that, SwiftBeGone skips blocked artists automatically.

⸻

2. Apple Music (macOS)

No setup needed.

macOS will request permission the first time SwiftBeGone tries to control Apple Music:

“SwiftBeGone would like to control the Music app.”

Click Allow.

⸻

🧩 How It Works

SwiftBeGone uses a set of “providers” to detect what you’re listening to:
	1.	SpotifyProvider → Spotify Web API
	2.	AppleMusicProvider → AppleScript (osascript)
	3.	(Planned) BrowserExtensionProvider → Chrome/Edge extension
	4.	(Planned) WindowsMediaProvider → Windows GSMTC API

Whichever provider is actively playing gets priority.
If the detected artist is in your blocklist, SwiftBeGone sends a “skip” command.

⸻

📡 Blocklist Behavior

Default blocklist (stored locally via electron-store):

["Taylor Swift"]

Matching is:
	•	case-insensitive
	•	trimmed
	•	exact match against artist name

Future versions will allow:
	•	editing the blocklist
	•	wildcard matching
	•	multiple profiles

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
