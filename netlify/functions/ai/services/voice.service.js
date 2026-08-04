'use strict';

const crypto = require('crypto');
const {
  requireElevenLabsConfig,
  requireLiveKitConfig,
  config,
} = require('../config');
const { requireString } = require('../utils/validate');
const { withTimeout, withRetry } = require('../utils/async');
const { ProviderError, ConfigError } = require('../errors/AppError');
const logger = require('../utils/logger');

/**
 * MKJ AI Core - Voice Service
 * -----------------------------------------------------------------------
 * Two independent capabilities, both backend-only (no frontend code, no
 * audio playback UI - that stays out of scope for this architecture):
 *
 *   1. ElevenLabs text-to-speech synthesis -> returns base64 audio.
 *   2. LiveKit access token minting -> lets the (existing) frontend
 *      connect to a LiveKit room for realtime voice, without this
 *      service ever touching LiveKit's realtime media path itself.
 *
 * Neither function is wired into chat.service or any auto-trigger -
 * both are explicit, opt-in actions dispatched via the router.
 */

/**
 * Synthesize speech from text using ElevenLabs.
 * @param {object} params
 * @param {string} params.text
 * @param {string} [params.voiceId]
 * @param {string} [params.modelId]
 * @returns {Promise<import('../types').VoiceSynthesisResult>}
 */
async function synthesizeSpeech(params = {}) {
  const text = requireString(params.text, 'text');
  const elevenConfig = requireElevenLabsConfig();
  const voiceId = params.voiceId || elevenConfig.defaultVoiceId;
  const modelId = params.modelId || elevenConfig.defaultModel;

  const requestFn = async () => {
    const res = await fetch(`${elevenConfig.baseUrl}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
        'xi-api-key': elevenConfig.apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new ProviderError(`ElevenLabs API error (${res.status})`, {
        status: res.status,
        body: errText,
      });
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  };

  let audioBuffer;
  try {
    audioBuffer = await withRetry(
      () => withTimeout(requestFn(), config.defaults.requestTimeoutMs, 'ElevenLabs synthesize'),
      {
        retries: 1,
        shouldRetry: (err) => !(err instanceof ProviderError) || err.details?.status >= 500,
      }
    );
  } catch (err) {
    logger.error('Voice synthesis request failed', { err, voiceId });
    if (err instanceof ProviderError) throw err;
    throw new ProviderError('Failed to reach ElevenLabs API', null, err);
  }

  return {
    contentType: 'audio/mpeg',
    audioBase64: audioBuffer.toString('base64'),
    voiceId,
    model: modelId,
  };
}

/**
 * Base64url-encode a JSON object (no padding), per JWT spec.
 * @param {object} obj
 */
function base64UrlEncode(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Mint a LiveKit access token (JWT) for a user to join a room.
 * Implemented with Node's built-in `crypto` (HMAC-SHA256) so no extra
 * dependency on the LiveKit server SDK is required - keeps this module
 * lightweight and fully self-contained.
 *
 * @param {object} params
 * @param {string} params.roomName
 * @param {string} params.identity - Typically the user's uid.
 * @param {number} [params.ttlSeconds]
 * @param {object} [params.grants] - Extra LiveKit video grants to merge in.
 * @returns {Promise<import('../types').LiveKitTokenResult>}
 */
async function createLiveKitToken(params = {}) {
  const roomName = requireString(params.roomName, 'roomName');
  const identity = requireString(params.identity, 'identity');
  const liveKitConfig = requireLiveKitConfig();

  if (!liveKitConfig.wsUrl) {
    logger.warn('LIVEKIT_WS_URL is not set; returning token without a connection URL.');
  }

  const ttlSeconds = params.ttlSeconds || liveKitConfig.defaultTtlSeconds;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ttlSeconds;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: liveKitConfig.apiKey,
    sub: identity,
    iat: now,
    nbf: now,
    exp: expiresAt,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      ...(params.grants || {}),
    },
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(payload);
  const signature = crypto
    .createHmac('sha256', liveKitConfig.apiSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const token = `${encodedHeader}.${encodedPayload}.${signature}`;

  return {
    token,
    url: liveKitConfig.wsUrl || '',
    roomName,
    identity,
    expiresAt,
  };
}

module.exports = {
  synthesizeSpeech,
  createLiveKitToken,
};
