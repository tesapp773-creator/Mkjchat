// netlify/functions/livekit-token.js
//
// Purpose: generate a signed LiveKit access token (JWT) so a user's phone
// can join a call room, WITHOUT ever exposing the LiveKit API Secret to
// the browser. The secret lives only here, read from Netlify environment
// variables, never written into this file and never sent to the client.
//
// This has zero external dependencies (no livekit-server-sdk needed) —
// it builds the exact JWT structure LiveKit requires using Node's
// built-in crypto module only. That means there's no npm install step
// that can fail during deploy.

const crypto = require('crypto');

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlFromBuffer(buf) {
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createLiveKitToken({ apiKey, apiSecret, identity, name, room, canPublish, canSubscribe, ttlSeconds }) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: apiKey,
    sub: identity,
    nbf: now,
    exp: now + (ttlSeconds || 21600), // default 6 hour token life
    name: name || identity,
    video: {
      room: room,
      roomJoin: true,
      canPublish: canPublish !== false,   // default true unless explicitly false (listener mode)
      canSubscribe: canSubscribe !== false // default true
    }
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const toSign = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', apiSecret).update(toSign).digest();
  const encodedSignature = base64urlFromBuffer(signature);

  return `${toSign}.${encodedSignature}`;
}

exports.handler = async (event) => {
  const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Preflight support (browsers send this before the real POST)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Server missing LIVEKIT_API_KEY / LIVEKIT_API_SECRET environment variables' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { room, identity, name, canPublish, canSubscribe } = body;

  if (!room || !identity) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: '"room" and "identity" are both required' })
    };
  }

  try {
    const token = createLiveKitToken({
      apiKey,
      apiSecret,
      identity,
      name,
      room,
      canPublish,
      canSubscribe
    });

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
      
