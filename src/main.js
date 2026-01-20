/**
 * SwiftBeGone - Main Electron process
 * Handles tray/menu bar, polling, and automatic skipping
 */

const { app, Tray, Menu, shell, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const spotify = require('./spotify');
const appleMusic = require('./appleMusic');
const { isBlocked, sanitizeBlockedList, sanitizeBlockedTracks, normalize } = require('./blocklist');

const store = new Store();

console.log("SwiftBeGone starting…", process.platform);

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  blocked_artists: ['Taylor Swift'],
  blocked_tracks: []
};

// Initialize settings with defaults
if (!store.has('enabled')) {
  store.set('enabled', DEFAULT_SETTINGS.enabled);
}
if (!store.has('blocked_artists')) {
  store.set('blocked_artists', DEFAULT_SETTINGS.blocked_artists);
}
if (!store.has('blocked_tracks')) {
  store.set('blocked_tracks', DEFAULT_SETTINGS.blocked_tracks);
}

// Settings window management
let settingsWindow = null;

let tray = null;
let pollingInterval = null;
let lastSkipTime = 0;
const SKIP_COOLDOWN_MS = 2500; // 2.5 seconds
const POLL_INTERVAL_MS = 2000; // 2 seconds when music is playing
const IDLE_POLL_INTERVAL_MS = 5000; // 5 seconds when paused/idle
let isMusicPlaying = false;

let currentStatus = {
  source: 'idle',
  artist: null,
  track: null,
  error: null
};

/**
 * Gets the icon path based on platform
 */
function getIconPath() {
  if (process.platform === 'darwin') {
    // macOS - use icon.ico for menu bar
    const iconPath = path.join(__dirname, '../assets/icon.ico');
    return fs.existsSync(iconPath) ? iconPath : null;
  } else {
    // Windows - use .ico or fallback
    const iconPath = path.join(__dirname, '../assets/icon.ico');
    return fs.existsSync(iconPath) ? iconPath : null;
  }
}

/**
 * Formats the status line for the menu
 */
function formatStatusLine() {
  if (currentStatus.error) {
    return `Error: ${currentStatus.error}`;
  }
  
  if (currentStatus.source === 'idle') {
    return 'Idle';
  }
  
  if (currentStatus.source === 'spotify') {
    if (currentStatus.artist && currentStatus.track) {
      const artists = Array.isArray(currentStatus.artist) 
        ? currentStatus.artist.join(', ') 
        : currentStatus.artist;
      return `Spotify: ${artists} — ${currentStatus.track}`;
    }
    return 'Spotify: Connected';
  }
  
  if (currentStatus.source === 'apple-music') {
    if (currentStatus.artist && currentStatus.track) {
      return `Apple Music: ${currentStatus.artist} — ${currentStatus.track}`;
    }
    return 'Apple Music: Playing';
  }
  
  return 'Idle';
}

/**
 * Creates the context menu for the tray
 */
function createMenu() {
  const enabled = store.get('enabled', true);
  const isConnected = spotify.isSpotifyConnected();
  const statusLine = formatStatusLine();
  
  const template = [
    {
      label: `SwiftBeGone — ${enabled ? 'ON' : 'OFF'}`,
      enabled: false
    },
    {
      label: statusLine,
      enabled: false
    },
    { type: 'separator' },
    {
      label: enabled ? 'Disable' : 'Enable',
      click: () => {
        store.set('enabled', !enabled);
        updateMenu();
      }
    },
    {
      label: 'Edit Blocklist…',
      click: () => {
        openSettingsWindow();
      }
    },
    { type: 'separator' },
    {
      label: isConnected ? 'Spotify: Connected' : 'Spotify: Temporarily Unavailable',
      enabled: false,
      tooltip: isConnected ? '' : 'Spotify has temporarily halted new app registrations. Apple Music support is still available on macOS.'
    },
    { type: 'separator' },
    {
      label: 'Help / Setup…',
      click: () => {
        shell.openExternal('https://swiftbegone.xyz');
      }
    },
    {
      label: 'Install Browser Extension…',
      click: () => {
        shell.openExternal('https://swiftbegone.xyz/#extension');
      }
    },
    {
      label: 'Donate…',
      click: () => {
        shell.openExternal('https://buymeacoffee.com/swiftbegone?new=1');
      }
    },
    {
      label: 'GitHub…',
      click: () => {
        shell.openExternal('https://github.com/swiftbegone/swiftbegonesongskip');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ];
  
  return Menu.buildFromTemplate(template);
}

/**
 * Updates the tray menu
 */
function updateMenu() {
  if (tray) {
    tray.setContextMenu(createMenu());
  }
}

/**
 * Opens the settings window (or focuses if already open)
 */
function openSettingsWindow() {
  if (settingsWindow) {
    if (settingsWindow.isMinimized()) {
      settingsWindow.restore();
    }
    settingsWindow.focus();
    return;
  }
  
  settingsWindow = new BrowserWindow({
    width: 420,
    height: 520,
    resizable: true,
    minWidth: 400,
    minHeight: 400,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'settingsPreload.js')
    },
    title: 'SwiftBeGone - Blocklist Settings',
    show: false
  });
  
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  
  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });
  
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

/**
 * Handles skipping a track based on the current source
 */
async function handleSkip(source) {
  const now = Date.now();
  if (now - lastSkipTime < SKIP_COOLDOWN_MS) {
    console.log(`Skip cooldown active (${now - lastSkipTime}ms < ${SKIP_COOLDOWN_MS}ms)`);
    return; // Still in cooldown
  }
  
  console.log(`Skipping track on ${source}…`);
  try {
    if (source === 'spotify') {
      await spotify.skipToNext();
    } else if (source === 'apple-music') {
      await appleMusic.skipToNext();
    }
    lastSkipTime = now;
    console.log(`Track skipped on ${source}.`);
  } catch (error) {
    console.error(`Error skipping track: ${error.message}`);
    currentStatus.error = error.message;
    updateMenu();
    setTimeout(() => {
      currentStatus.error = null;
      updateMenu();
    }, 5000);
  }
}

/**
 * Main polling function - checks what's playing and skips if needed
 */
async function pollNowPlaying() {
  const enabled = store.get('enabled', true);
  if (!enabled) {
    // Still update status, but don't skip
    const wasPlaying = isMusicPlaying;
    isMusicPlaying = false;
    if (wasPlaying) {
      updatePollingInterval(); // Switch to slower polling when disabled
    }
    currentStatus.source = 'idle';
    currentStatus.artist = null;
    currentStatus.track = null;
    updateMenu();
    return;
  }

  console.log("Polling for currently playing track…");
  try {
    // Priority 1: Spotify (if connected)
    if (spotify.isSpotifyConnected()) {
      try {
        const spotifyTrack = await spotify.getCurrentlyPlaying();
        if (spotifyTrack && spotifyTrack.isPlaying) {
          const wasPlaying = isMusicPlaying;
          isMusicPlaying = true;
          if (!wasPlaying) {
            updatePollingInterval(); // Switch to faster polling
          }
          
          currentStatus.source = 'spotify';
          currentStatus.artist = spotifyTrack.artists;
          currentStatus.track = spotifyTrack.track;
          currentStatus.error = null;
          
          // Check if track or artist is blocked
          const blockedArtists = sanitizeBlockedList(store.get('blocked_artists', []));
          const blockedTracks = sanitizeBlockedTracks(store.get('blocked_tracks', []));
          const blocked = isBlocked(spotifyTrack.artists, spotifyTrack.track, blockedArtists, blockedTracks);
          
          if (blocked.blocked) {
            console.log(`Blocked ${blocked.reason === 'track' ? 'track' : 'artist'}: ${spotifyTrack.track}`);
            await handleSkip('spotify');
          }
          
          updateMenu();
          return;
        }
      } catch (error) {
        // If Spotify API fails, try other sources
        console.error('Spotify polling error:', error.message);
      }
    }

    // Priority 2: Apple Music (macOS only)
    if (process.platform === 'darwin') {
      try {
        const appleTrack = await appleMusic.getCurrentlyPlaying();
        if (appleTrack && appleTrack.isPlaying) {
          const wasPlaying = isMusicPlaying;
          isMusicPlaying = true;
          if (!wasPlaying) {
            updatePollingInterval(); // Switch to faster polling
          }
          
          currentStatus.source = 'apple-music';
          currentStatus.artist = appleTrack.artist;
          currentStatus.track = appleTrack.track;
          currentStatus.error = null;
          
          // Check if track or artist is blocked
          const blockedArtists = sanitizeBlockedList(store.get('blocked_artists', []));
          const blockedTracks = sanitizeBlockedTracks(store.get('blocked_tracks', []));
          const blocked = isBlocked([appleTrack.artist], appleTrack.track, blockedArtists, blockedTracks);
          
          if (blocked.blocked) {
            console.log(`Blocked ${blocked.reason === 'track' ? 'track' : 'artist'}: ${appleTrack.track}`);
            await handleSkip('apple-music');
          }
          
          updateMenu();
          return;
        }
      } catch (error) {
        // If Apple Music fails, continue to idle
        console.error('Apple Music polling error:', error.message);
      }
    }

    // No active source - music is paused or not playing
    const wasPlaying = isMusicPlaying;
    isMusicPlaying = false;
    if (wasPlaying) {
      updatePollingInterval(); // Switch to slower polling when paused
    }
    
    currentStatus.source = 'idle';
    currentStatus.artist = null;
    currentStatus.track = null;
    currentStatus.error = null;
    console.log("No active music source detected (paused or idle).");
    updateMenu();
  } catch (error) {
    console.error('Polling error:', error.message);
    currentStatus.error = error.message;
    updateMenu();
  }
}

/**
 * Initializes the tray icon and menu
 */
function createTray() {
  console.log("Creating tray…");
  const iconPath = getIconPath();
  
  tray = new Tray(iconPath || path.join(__dirname, '../assets/icon.ico'));
  
  tray.setToolTip('SwiftBeGone');
  tray.setContextMenu(createMenu());
  
  // On macOS, click should also show menu
  if (process.platform === 'darwin') {
    tray.on('click', () => {
      tray.popUpContextMenu();
    });
  }
  console.log("Tray created.");
}

/**
 * Starts or restarts the polling interval with appropriate frequency
 */
function startPolling() {
  console.log("Starting polling…");
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  // Poll immediately, then set interval based on current state
  pollNowPlaying();
  updatePollingInterval();
  console.log("Polling started.");
}

/**
 * Updates polling interval based on whether music is currently playing
 */
function updatePollingInterval() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  const interval = isMusicPlaying ? POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS;
  pollingInterval = setInterval(pollNowPlaying, interval);
  console.log(`Polling interval set to ${interval}ms (${isMusicPlaying ? 'active' : 'idle'})`);
}

/**
 * Stops the polling interval
 */
function stopPolling() {
  console.log("Stopping polling…");
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  console.log("Polling stopped.");
}

// IPC handlers for settings window
ipcMain.handle('blocklist:get', async () => {
  return {
    artists: store.get('blocked_artists', []),
    tracks: store.get('blocked_tracks', [])
  };
});

ipcMain.handle('blocklist:set-artists', async (event, artists) => {
  const sanitized = sanitizeBlockedList(artists);
  store.set('blocked_artists', sanitized);
  return;
});

ipcMain.handle('blocklist:set-tracks', async (event, tracks) => {
  const sanitized = sanitizeBlockedTracks(tracks);
  store.set('blocked_tracks', sanitized);
  return;
});

ipcMain.handle('blocklist:block-current-song', async () => {
  // Get currently playing track from Apple Music (Spotify ignored for now)
  if (process.platform !== 'darwin') {
    return { success: false, message: 'Apple Music is only available on macOS' };
  }
  
  try {
    const appleTrack = await appleMusic.getCurrentlyPlaying();
    if (!appleTrack || !appleTrack.isPlaying) {
      return { success: false, message: 'No music is currently playing' };
    }
    
    const blockedTracks = sanitizeBlockedTracks(store.get('blocked_tracks', []));
    
    // Normalize the track for comparison
    const normalized = {
      artist: normalize(appleTrack.artist),
      track: normalize(appleTrack.track)
    };
    
    // Check if already blocked (including tracks without artist)
    if (blockedTracks.some(t => {
      if (t.track !== normalized.track) return false;
      // Track matches - check artist
      // If blocked track has no artist, it matches any artist
      if (t.artist === undefined) return true;
      // If blocked track has an artist, it must match
      return t.artist === normalized.artist;
    })) {
      return { success: false, message: 'This song is already blocked' };
    }
    
    // Add the normalized track and sanitize the entire list
    blockedTracks.push(normalized);
    const sanitized = sanitizeBlockedTracks(blockedTracks);
    store.set('blocked_tracks', sanitized);
    
    return { 
      success: true, 
      message: `${appleTrack.artist} — ${appleTrack.track}` 
    };
  } catch (error) {
    console.error('Failed to block current song:', error);
    return { success: false, message: error.message || 'Failed to get current song' };
  }
});

ipcMain.handle('blocklist:block-current-artist', async () => {
  // Get currently playing track from Apple Music (Spotify ignored for now)
  if (process.platform !== 'darwin') {
    return { success: false, message: 'Apple Music is only available on macOS' };
  }
  
  try {
    const appleTrack = await appleMusic.getCurrentlyPlaying();
    if (!appleTrack || !appleTrack.isPlaying) {
      return { success: false, message: 'No music is currently playing' };
    }
    
    const blockedArtists = sanitizeBlockedList(store.get('blocked_artists', []));
    const artistName = appleTrack.artist;
    const normalizedArtist = normalize(artistName);
    
    // Check if already blocked (compare normalized)
    if (blockedArtists.some(a => normalize(a) === normalizedArtist)) {
      return { success: false, message: 'This artist is already blocked' };
    }
    
    // Add the original artist name and sanitize the entire list
    blockedArtists.push(artistName);
    store.set('blocked_artists', sanitizeBlockedList(blockedArtists));
    
    return { 
      success: true, 
      message: artistName 
    };
  } catch (error) {
    console.error('Failed to block current artist:', error);
    return { success: false, message: error.message || 'Failed to get current artist' };
  }
});

ipcMain.handle('blocklist:get-now-playing', async () => {
  // Try Apple Music first (Spotify ignored for now)
  if (process.platform === 'darwin') {
    try {
      const appleTrack = await appleMusic.getCurrentlyPlaying();
      if (appleTrack && appleTrack.isPlaying) {
        return {
          artist: appleTrack.artist,
          track: appleTrack.track,
          source: 'apple-music'
        };
      }
    } catch (error) {
      // Ignore errors, try other sources
    }
  }
  
  // Fall back to currentStatus if available
  if (currentStatus.artist && currentStatus.track) {
    return {
      artist: currentStatus.artist,
      track: currentStatus.track,
      source: currentStatus.source
    };
  }
  
  return null;
});

// App lifecycle
app.whenReady().then(() => {
  console.log("App ready, initializing…");
  createTray();
  startPolling();
  
  // Update menu periodically to refresh status
  setInterval(updateMenu, 2000);
  console.log("App initialized.");
});

app.on('window-all-closed', (e) => {
  // Prevent default behavior - keep app running
  e.preventDefault();
});

app.on('before-quit', () => {
  stopPolling();
});

// Handle app activation (macOS)
app.on('activate', () => {
  if (!tray) {
    createTray();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log("Another instance is already running, quitting…");
  app.quit();
} else {
  app.on('second-instance', () => {
    console.log("Second instance detected, showing menu…");
    // Focus existing instance
    if (tray) {
      tray.popUpContextMenu();
    }
  });
}
