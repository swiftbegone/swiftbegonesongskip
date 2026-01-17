/**
 * Local OAuth callback server for Spotify authentication
 * Listens on http://127.0.0.1:24863/callback
 */

const express = require('express');
const http = require('http');

let server = null;
let resolveCallback = null;

/**
 * Starts the OAuth callback server
 * @param {Function} callback - Function to call with the authorization code
 * @returns {Promise<string>} - Promise that resolves with the authorization code
 */
function startOAuthServer(callback) {
  return new Promise((resolve, reject) => {
    if (server) {
      reject(new Error('OAuth server is already running'));
      return;
    }

    resolveCallback = resolve;
    const app = express();

    app.get('/callback', (req, res) => {
      const code = req.query.code;
      const error = req.query.error;

      if (error) {
        res.send(`
          <html>
            <head><title>SwiftBeGone - Authorization Failed</title></head>
            <body>
              <h1>Authorization Failed</h1>
              <p>Error: ${error}</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
        reject(new Error(`OAuth error: ${error}`));
        stopOAuthServer();
        return;
      }

      if (code) {
        res.send(`
          <html>
            <head><title>SwiftBeGone - Authorization Successful</title></head>
            <body>
              <h1>Authorization Successful!</h1>
              <p>You can close this window and return to SwiftBeGone.</p>
            </body>
          </html>
        `);
        resolve(code);
        stopOAuthServer();
      } else {
        res.send(`
          <html>
            <head><title>SwiftBeGone - Authorization</title></head>
            <body>
              <h1>No authorization code received</h1>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
        reject(new Error('No authorization code received'));
        stopOAuthServer();
      }
    });

    server = http.createServer(app);
    server.listen(24863, '127.0.0.1', () => {
      console.log('OAuth callback server listening on http://127.0.0.1:24863');
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error('Port 24863 is already in use'));
      } else {
        reject(err);
      }
      stopOAuthServer();
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      if (server) {
        reject(new Error('OAuth server timeout'));
        stopOAuthServer();
      }
    }, 5 * 60 * 1000);
  });
}

/**
 * Stops the OAuth callback server
 */
function stopOAuthServer() {
  if (server) {
    server.close();
    server = null;
    resolveCallback = null;
  }
}

module.exports = {
  startOAuthServer,
  stopOAuthServer
};
