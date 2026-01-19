/**
 * Apple Music integration for macOS
 * Uses AppleScript to control the Music app
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Checks if the Music app is running on macOS
 * @returns {Promise<boolean>}
 */
async function isMusicAppRunning() {
  try {
    const { stdout } = await execAsync('pgrep -x Music');
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Gets the currently playing track from Apple Music
 * @returns {Promise<Object|null>} - Track info or null if not playing
 */
async function getCurrentlyPlaying() {
  if (process.platform !== 'darwin') {
    return null;
  }

  try {
    const isRunning = await isMusicAppRunning();
    if (!isRunning) {
      return null;
    }

    // Check if player is playing
    const playerStateScript = `
      tell application "Music"
        if player state is playing then
          return "playing"
        else
          return "not playing"
        end if
      end tell
    `;

    const { stdout: stateOutput } = await execAsync(`osascript -e '${playerStateScript}'`);
    if (!stateOutput.trim().includes('playing')) {
      return null;
    }

    // Get current track info
    const trackInfoScript = `
      tell application "Music"
        set currentTrack to current track
        set trackArtist to artist of currentTrack
        set trackName to name of currentTrack
        return trackArtist & "|" & trackName
      end tell
    `;

    const { stdout: trackOutput } = await execAsync(`osascript -e '${trackInfoScript}'`);
    const parts = trackOutput.trim().split('|');
    
    if (parts.length === 2) {
      const trackInfo = {
        artist: parts[0].trim(),
        track: parts[1].trim(),
        isPlaying: true
      };
      console.log(`Apple Music playing: ${trackInfo.artist} — ${trackInfo.track}`);
      return trackInfo;
    }

    return null;
  } catch (error) {
    // Handle permission errors gracefully
    if (error.message.includes('not allowed') || error.message.includes('permission')) {
      return null; // Treat as not playing if we don't have permission
    }
    // Other errors might mean Music app is not running or no track
    return null;
  }
}

/**
 * Skips to the next track in Apple Music
 * @returns {Promise<void>}
 */
async function skipToNext() {
  if (process.platform !== 'darwin') {
    throw new Error('Apple Music is only supported on macOS');
  }

  console.log("Skipping to next track on Apple Music…");
  try {
    const skipScript = 'tell application "Music" to next track';
    await execAsync(`osascript -e '${skipScript}'`);
    console.log("Apple Music track skipped.");
  } catch (error) {
    if (error.message.includes('not allowed') || error.message.includes('permission')) {
      throw new Error('SwiftBeGone needs permission to control the Music app. Please grant permission in System Settings > Privacy & Security > Automation.');
    }
    throw error;
  }
}

module.exports = {
  getCurrentlyPlaying,
  skipToNext,
  isMusicAppRunning
};
