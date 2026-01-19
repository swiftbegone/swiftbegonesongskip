/**
 * Spotify OAuth and API integration
 * Handles authentication, token refresh, and playback control
 */

const https = require('https');
const { URL } = require('url');
const { startOAuthServer, stopOAuthServer } = require('./oauthServer');
const Store = require('electron-store');

const store = new Store();

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const REDIRECT_URI = 'http://127.0.0.1:24863/callback';
const SCOPES = 'user-read-playback-state user-modify-playback-state';

/**
 * Makes an HTTPS request
 * @param {string} url - The URL to request
 * @param {Object} options - Request options
 * @param {string} data - Optional POST data
 * @returns {Promise<Object>} - Response data
 */
function httpsRequest(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(requestOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data: jsonBody });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${jsonBody.error?.message || body}`));
          }
        } catch (e) {
          if (res.statusCode === 204 || body === '') {
            resolve({ statusCode: res.statusCode, data: null });
          } else {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

/**
 * Gets the Spotify client ID and secret from store or environment
 * @returns {Object} - { clientId, clientSecret }
 */
function getSpotifyCredentials() {
  const clientId = store.get('spotify_client_id') || process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = store.get('spotify_client_secret') || process.env.SPOTIFY_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Spotify client ID and secret must be configured. See README for setup instructions.');
  }
  
  return { clientId, clientSecret };
}

/**
 * Initiates the Spotify OAuth flow
 * Opens browser and waits for callback
 * @returns {Promise<string>} - Authorization code
 */
async function initiateOAuth() {
  const { clientId } = getSpotifyCredentials();
  
  const authUrl = new URL(SPOTIFY_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('show_dialog', 'false');

  const { shell } = require('electron');
  shell.openExternal(authUrl.toString());

  return startOAuthServer();
}

/**
 * Exchanges authorization code for access and refresh tokens
 * @param {string} code - Authorization code from OAuth callback
 * @returns {Promise<Object>} - Token data
 */
async function exchangeCodeForTokens(code) {
  const { clientId, clientSecret } = getSpotifyCredentials();
  
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const data = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: REDIRECT_URI
  }).toString();

  const response = await httpsRequest(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }, data);

  const { access_token, refresh_token, expires_in } = response.data;
  
  // Store tokens
  store.set('spotify_access_token', access_token);
  store.set('spotify_refresh_token', refresh_token);
  store.set('spotify_token_expires_at', Date.now() + (expires_in * 1000));

  return { access_token, refresh_token, expires_in };
}

/**
 * Refreshes the access token using the refresh token
 * @returns {Promise<string>} - New access token
 */
async function refreshAccessToken() {
  console.log("Refreshing Spotify access token…");
  const refreshToken = store.get('spotify_refresh_token');
  if (!refreshToken) {
    throw new Error('No refresh token available. Please reconnect Spotify.');
  }

  const { clientId, clientSecret } = getSpotifyCredentials();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const data = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  }).toString();

  try {
    const response = await httpsRequest(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }, data);

    const { access_token, expires_in } = response.data;
    
    store.set('spotify_access_token', access_token);
    store.set('spotify_token_expires_at', Date.now() + (expires_in * 1000));

    console.log("Spotify access token refreshed.");
    return access_token;
  } catch (error) {
    console.error("Spotify token refresh failed:", error.message);
    // If refresh fails, clear tokens
    store.delete('spotify_access_token');
    store.delete('spotify_refresh_token');
    store.delete('spotify_token_expires_at');
    throw error;
  }
}

/**
 * Gets a valid access token, refreshing if necessary
 * @returns {Promise<string>} - Valid access token
 */
async function getValidAccessToken() {
  let accessToken = store.get('spotify_access_token');
  const expiresAt = store.get('spotify_token_expires_at', 0);
  
  // Refresh if token expires in less than 60 seconds
  if (!accessToken || Date.now() >= (expiresAt - 60000)) {
    accessToken = await refreshAccessToken();
  }
  
  return accessToken;
}

/**
 * Checks if Spotify is connected (has valid tokens)
 * @returns {boolean}
 */
function isSpotifyConnected() {
  return !!store.get('spotify_refresh_token');
}

/**
 * Connects to Spotify (full OAuth flow)
 * @returns {Promise<void>}
 */
async function connectSpotify() {
  console.log("Connecting to Spotify…");
  try {
    const code = await initiateOAuth();
    console.log("OAuth code received, exchanging for tokens…");
    await exchangeCodeForTokens(code);
    console.log("Spotify connected successfully.");
  } catch (error) {
    console.error("Spotify connection failed:", error.message);
    stopOAuthServer();
    throw error;
  }
}

/**
 * Gets the currently playing track from Spotify
 * @returns {Promise<Object|null>} - Track info or null if not playing
 */
async function getCurrentlyPlaying() {
  if (!isSpotifyConnected()) {
    return null;
  }

  try {
    const accessToken = await getValidAccessToken();
    const response = await httpsRequest(
      `${SPOTIFY_API_BASE}/me/player/currently-playing`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    // 204 means nothing is playing
    if (response.statusCode === 204 || !response.data || !response.data.item) {
      return null;
    }

    const { item } = response.data;
    const artists = item.artists.map(artist => artist.name);
    const trackName = item.name;

    const trackInfo = {
      artists,
      track: trackName,
      isPlaying: response.data.is_playing === true
    };
    console.log(`Spotify playing: ${artists.join(', ')} — ${trackName}`);
    return trackInfo;
  } catch (error) {
    // If token refresh failed, return null
    if (error.message.includes('refresh') || error.message.includes('401')) {
      return null;
    }
    throw error;
  }
}

/**
 * Skips to the next track on Spotify
 * @returns {Promise<void>}
 */
async function skipToNext() {
  if (!isSpotifyConnected()) {
    throw new Error('Spotify is not connected');
  }

  console.log("Skipping to next track on Spotify…");
  try {
    const accessToken = await getValidAccessToken();
    await httpsRequest(
      `${SPOTIFY_API_BASE}/me/player/next`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    console.log("Spotify track skipped.");
  } catch (error) {
    // If token refresh failed, rethrow
    if (error.message.includes('refresh') || error.message.includes('401')) {
      throw new Error('Spotify authentication expired. Please reconnect.');
    }
    throw error;
  }
}

module.exports = {
  connectSpotify,
  isSpotifyConnected,
  getCurrentlyPlaying,
  skipToNext,
  getSpotifyCredentials
};
