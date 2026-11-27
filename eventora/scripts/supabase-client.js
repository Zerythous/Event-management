/* ==========================================================================
   EVENTORA SUPABASE CLIENT & STORAGE PREPARATION MODULE
   - Uses @supabase/supabase-js v2 UMD bundle (window.supabase)
   - Reads local credentials from untracked scripts/supabase-config.local.js
   - Enforces public-key-only validation (blocks secret/service_role keys)
   - Prepares scoped eventora-media Storage paths for a future Storage RLS phase
   ========================================================================== */

window.EventoraSupabase = (function () {
  const DEFAULT_BUCKET = 'eventora-media';
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const ALLOWED_IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

  let clientInstance = null;
  let initPromise = null;
  let lastState = {
    initialized: false,
    sdkLoaded: false,
    configured: false,
    reason: 'initializing',
    errorMessage: '',
    projectUrl: '',
    storageBucket: DEFAULT_BUCKET
  };

  function isPlaceholder(val) {
    const s = String(val || '').trim();
    if (!s) return true;
    return /YOUR_SUPABASE|your-project-ref|sb_publishable_xxx|example\.supabase\.co|<[^>]+>/i.test(s);
  }

  function decodeJwtPayload(token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = base64.length % 4 ? '='.repeat(4 - (base64.length % 4)) : '';
      const json = atob(base64 + pad);
      return JSON.parse(json);
    } catch (_) {
      return null;
    }
  }

  function validateConfig(raw) {
    if (!raw || typeof raw !== 'object') {
      return {
        valid: false,
        reason: 'missing_config',
        message: 'Local Supabase configuration file (eventora/scripts/supabase-config.local.js) is not configured yet.'
      };
    }

    const urlRaw = String(raw.url || raw.projectUrl || '').trim();
    const keyRaw = String(raw.publishableKey || raw.anonKey || '').trim();
    const bucket = String(raw.storageBucket || DEFAULT_BUCKET).trim() || DEFAULT_BUCKET;

    if (isPlaceholder(urlRaw) || isPlaceholder(keyRaw)) {
      return {
        valid: false,
        reason: 'placeholder_config',
        message: 'Local Supabase config still contains placeholders. Copy scripts/supabase-config.example.js to scripts/supabase-config.local.js and add your Project URL and Publishable key.',
        storageBucket: bucket
      };
    }

    if (/^sb_secret_/i.test(keyRaw)) {
      return {
        valid: false,
        reason: 'secret_key_blocked',
        message: 'Security policy violation: Supabase secret keys (sb_secret_...) must never be used in frontend code. Use only the public Publishable key.',
        storageBucket: bucket
      };
    }

    const jwtPayload = decodeJwtPayload(keyRaw);
    if (jwtPayload && String(jwtPayload.role || '').toLowerCase() === 'service_role') {
      return {
        valid: false,
        reason: 'service_role_blocked',
        message: 'Security policy violation: service_role keys must never be exposed in frontend code. Use only the public Publishable or anon key.',
        storageBucket: bucket
      };
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(urlRaw);
    } catch (_) {
      return {
        valid: false,
        reason: 'invalid_url',
        message: 'Configured Supabase Project URL is invalid. Expected https://<project-ref>.supabase.co.',
        storageBucket: bucket
      };
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const isLocalHttp = parsedUrl.protocol === 'http:' && (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1');
    if (!isHttps && !isLocalHttp) {
      return {
        valid: false,
        reason: 'insecure_url',
        message: 'Supabase Project URL must use HTTPS (or http://localhost for local Supabase CLI).',
        storageBucket: bucket
      };
    }

    return {
      valid: true,
      url: parsedUrl.origin,
      publishableKey: keyRaw,
      storageBucket: bucket
    };
  }

  async function loadLocalConfigScript() {
    if (window.EVENTORA_SUPABASE_CONFIG && !isPlaceholder(window.EVENTORA_SUPABASE_CONFIG.url)) {
      return window.EVENTORA_SUPABASE_CONFIG;
    }

    const proto = window.location && window.location.protocol;
    if (proto !== 'http:' && proto !== 'https:') {
      return window.EVENTORA_SUPABASE_CONFIG || null;
    }

    // Probe first with fetch so server.js HTML fallback for missing files
    // never triggers a browser <script> SyntaxError: Unexpected token '<'.
    try {
      const response = await fetch('scripts/supabase-config.local.js', { cache: 'no-store' });
      if (!response.ok) return window.EVENTORA_SUPABASE_CONFIG || null;
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('javascript')) {
        return window.EVENTORA_SUPABASE_CONFIG || null;
      }
      const bodyText = await response.text();
      if (!bodyText || /^\s*</.test(bodyText)) {
        return window.EVENTORA_SUPABASE_CONFIG || null;
      }

      await new Promise((resolve) => {
        const scriptEl = document.createElement('script');
        scriptEl.src = 'scripts/supabase-config.local.js';
        scriptEl.async = false;
        scriptEl.dataset.eventoraLocalConfig = 'true';
        scriptEl.onload = () => resolve();
        scriptEl.onerror = () => resolve();
        document.head.appendChild(scriptEl);
      });
    } catch (_) {
      return window.EVENTORA_SUPABASE_CONFIG || null;
    }

    return window.EVENTORA_SUPABASE_CONFIG || null;
  }

  async function initClient() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const sdkLoaded = Boolean(window.supabase && typeof window.supabase.createClient === 'function');
      const localCfg = await loadLocalConfigScript();
      const validation = validateConfig(localCfg);

      if (!validation.valid) {
        lastState = {
          initialized: true,
          sdkLoaded,
          configured: false,
          reason: validation.reason,
          errorMessage: validation.message,
          projectUrl: '',
          storageBucket: validation.storageBucket || DEFAULT_BUCKET
        };
        return { client: null, state: { ...lastState } };
      }

      if (!sdkLoaded) {
        lastState = {
          initialized: true,
          sdkLoaded: false,
          configured: false,
          reason: 'sdk_unavailable',
          errorMessage: 'Supabase JavaScript SDK v2 failed to load in this browser context. Check network connectivity or CDN access.',
          projectUrl: validation.url,
          storageBucket: validation.storageBucket
        };
        return { client: null, state: { ...lastState } };
      }

      if (!clientInstance) {
        clientInstance = window.supabase.createClient(validation.url, validation.publishableKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            flowType: 'pkce'
          }
        });
      }

      lastState = {
        initialized: true,
        sdkLoaded: true,
        configured: true,
        reason: 'ready',
        errorMessage: '',
        projectUrl: validation.url,
        storageBucket: validation.storageBucket
      };

      return { client: clientInstance, state: { ...lastState } };
    })();

    return initPromise;
  }

  function getClient() {
    return clientInstance;
  }

  function getState() {
    return { ...lastState };
  }

  const MAX_CONTENT_BYTES = 25 * 1024 * 1024;
  const ALLOWED_MEDIA_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml',
    'application/zip',
    'application/x-zip-compressed',
    'text/csv',
    'text/plain',
    'application/json'
  ]);
  const ALLOWED_MEDIA_EXT = /\.(pdf|jpe?g|png|webp|svg|zip|csv|txt|json)$/i;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let dbProbeState = {
    probed: false,
    ready: false,
    status: 'unknown', // not_configured | offline | migrations_pending | ready | error
    errorMessage: '',
    serverClockOffsetMs: 0,
    lastCheckedAt: ''
  };

  function isUuid(val) {
    return UUID_RE.test(String(val || '').trim());
  }

  function formatDbError(error, fallback) {
    if (!error) return fallback || 'Unexpected database error.';
    if (typeof error === 'string') return error;
    const code = String(error.code || '').toUpperCase();
    const msg = String(error.message || error.details || error.hint || fallback || 'Database request failed.').trim();
    const lower = msg.toLowerCase();

    if (code === '42P01' || code === 'PGRST205' || (lower.includes('relation') && lower.includes('does not exist'))) {
      return 'Database migrations pending: run eventora/supabase/migrations/001..018 in your Supabase SQL Editor first.';
    }
    if (code === '23505' || lower.includes('duplicate key')) {
      return 'Duplicate record prevented by database constraint (you may already be registered or the identifier is in use).';
    }
    if (code === '42501' || error.status === 403 || lower.includes('row-level security') || lower.includes('permission denied')) {
      return 'Permission denied by Row Level Security (RLS) policy.';
    }
    if (code === '23503') {
      return 'Referenced event, round, or team record does not exist.';
    }
    if (code === 'PGRST301' || error.status === 401 || lower.includes('jwt expired')) {
      return 'Your Supabase session has expired. Please sign in again.';
    }
    if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
      return 'Network failure: unable to reach Supabase backend. Check your connection and retry.';
    }
    return msg;
  }

  function emitDbStatus(patch) {
    dbProbeState = { ...dbProbeState, ...patch, lastCheckedAt: new Date().toISOString() };
    try {
      if (window && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('eventora:dbstatus', { detail: { ...dbProbeState } }));
      }
    } catch (_) {}
  }

  async function runDbQuery(executor, fallbackMsg) {
    const { client, state } = await initClient();
    if (!client || !state.configured) {
      return {
        ok: false,
        offline: true,
        schemaMissing: false,
        status: 'not_configured',
        error: state.errorMessage || 'Supabase client is not configured.',
        data: null
      };
    }

    try {
      const result = await executor(client);
      if (result && result.error) {
        const code = String(result.error.code || '').toUpperCase();
        const schemaMissing = code === '42P01' || code === 'PGRST205';
        const formatted = formatDbError(result.error, fallbackMsg);
        if (schemaMissing) {
          emitDbStatus({ probed: true, ready: false, status: 'migrations_pending', errorMessage: formatted });
        }
        return {
          ok: false,
          offline: /network|failed to fetch/i.test(formatted),
          schemaMissing,
          status: schemaMissing ? 'migrations_pending' : 'error',
          error: formatted,
          rawError: result.error,
          data: null
        };
      }
      if (!dbProbeState.ready) {
        emitDbStatus({ probed: true, ready: true, status: 'ready', errorMessage: '' });
      }
      return {
        ok: true,
        offline: false,
        schemaMissing: false,
        status: 'ready',
        error: '',
        data: result ? result.data : null
      };
    } catch (err) {
      const formatted = formatDbError(err, fallbackMsg);
      const isNet = /network|failed to fetch|offline/i.test(formatted);
      emitDbStatus({
        probed: true,
        ready: false,
        status: isNet ? 'offline' : 'error',
        errorMessage: formatted
      });
      return {
        ok: false,
        offline: isNet,
        schemaMissing: false,
        status: isNet ? 'offline' : 'error',
        error: formatted,
        rawError: err,
        data: null
      };
    }
  }

  async function syncServerClock() {
    const client = getClient();
    if (!client) return 0;
    try {
      const t0 = Date.now();
      const { data, error } = await client.rpc('get_server_clock');
      const t1 = Date.now();
      if (!error && data && data.server_epoch_ms) {
        const midpoint = Math.round((t0 + t1) / 2);
        const offset = Number(data.server_epoch_ms) - midpoint;
        if (Number.isFinite(offset)) {
          dbProbeState.serverClockOffsetMs = offset;
          return offset;
        }
      }
    } catch (_) {}
    return dbProbeState.serverClockOffsetMs || 0;
  }

  async function probeDatabase(force) {
    if (dbProbeState.probed && !force && dbProbeState.status !== 'unknown') {
      return { ...dbProbeState };
    }
    const { client, state } = await initClient();
    if (!client || !state.configured) {
      emitDbStatus({
        probed: true,
        ready: false,
        status: 'not_configured',
        errorMessage: state.errorMessage || 'Supabase client is not configured.'
      });
      return { ...dbProbeState };
    }

    const res = await runDbQuery(
      (sb) => sb.from('events').select('id', { count: 'exact', head: true }).limit(1),
      'Failed to verify Supabase database schema.'
    );
    if (res.ok) {
      await syncServerClock();
      emitDbStatus({ probed: true, ready: true, status: 'ready', errorMessage: '' });
    }
    return { ...dbProbeState };
  }

  function getServerNowMs() {
    return Date.now() + (Number(dbProbeState.serverClockOffsetMs) || 0);
  }

  /* ------------------------------------------------------------------------
     Storage Architecture (`eventora-media` private bucket + Storage RLS)
     ------------------------------------------------------------------------ */
  function sanitizeSegment(value, fallback) {
    const clean = String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return clean || (fallback || 'item');
  }

  function validateImageFile(file) {
    if (!file) return { valid: false, error: 'No image file selected.' };
    const typeOk = ALLOWED_IMAGE_TYPES.includes(file.type) || ALLOWED_IMAGE_EXT.test(file.name || '');
    if (!typeOk) {
      return { valid: false, error: 'Unsupported format. Allowed image formats: JPEG, PNG, WebP.' };
    }
    if (typeof file.size !== 'number' || file.size <= 0) {
      return { valid: false, error: 'Selected image file is empty.' };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { valid: false, error: 'Image exceeds the 5 MB upload limit.' };
    }
    return { valid: true, error: '' };
  }

  function validateMediaFile(file, category) {
    if (!file) return { valid: false, error: 'No file selected.' };
    if (category === 'avatar' || category === 'poster' || category === 'cover') {
      return validateImageFile(file);
    }
    if (category === 'content') {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
      if (!isPdf) return { valid: false, error: 'Only PDF documents (.pdf) are allowed for question papers.' };
    } else {
      const okType = ALLOWED_MEDIA_TYPES.has(file.type) || ALLOWED_MEDIA_EXT.test(file.name || '');
      if (!okType) {
        return { valid: false, error: 'Unsupported file type. Allowed: PDF, PNG, JPG, WebP, SVG, ZIP, CSV, TXT, JSON.' };
      }
    }
    if (typeof file.size !== 'number' || file.size <= 0) {
      return { valid: false, error: 'Selected file is empty.' };
    }
    if (file.size > MAX_CONTENT_BYTES) {
      return { valid: false, error: 'File exceeds the 25 MB Supabase Storage limit.' };
    }
    return { valid: true, error: '' };
  }

  function buildStorageObjectPath({ category, userId, eventId, eventSlug, roundId, fileName }) {
    const safeName = sanitizeSegment(fileName, 'asset.bin');
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 7);
    const evKey = sanitizeSegment(eventId || eventSlug, '');

    if (category === 'avatar') {
      const uid = sanitizeSegment(userId, '');
      if (!uid) throw new Error('Authenticated userId is required to scope avatar storage paths.');
      return `avatars/${uid}/${stamp}-${safeName}`;
    }
    if (category === 'poster' || category === 'cover') {
      if (!evKey) throw new Error('eventId is required to scope event media paths.');
      const folder = category === 'poster' ? 'posters' : 'covers';
      return `events/${evKey}/${folder}/${stamp}-${rand}-${safeName}`;
    }
    if (category === 'content' || category === 'attachments') {
      const rndKey = sanitizeSegment(roundId, 'general');
      if (!evKey) throw new Error('eventId is required to scope round media paths.');
      return `events/${evKey}/rounds/${rndKey}/${category}/${stamp}-${rand}-${safeName}`;
    }
    if (category === 'submissions') {
      const rndKey = sanitizeSegment(roundId, 'general');
      const uid = sanitizeSegment(userId, '');
      if (!evKey || !uid) throw new Error('eventId and userId is required to scope submission storage paths.');
      return `events/${evKey}/rounds/${rndKey}/submissions/${uid}/${stamp}-${rand}-${safeName}`;
    }
    throw new Error(`Unsupported Eventora media category: ${category}`);
  }

  async function prepareAuthenticatedMediaUpload({ category, eventId, eventSlug, roundId, file }) {
    const { client, state } = await initClient();
    if (!client || !state.configured) {
      return { ready: false, error: state.errorMessage || 'Supabase client is not configured.' };
    }
    const fileCheck = validateMediaFile(file, category);
    if (!fileCheck.valid) {
      return { ready: false, error: fileCheck.error };
    }
    const { data, error } = await client.auth.getUser();
    if (error || !data || !data.user) {
      return { ready: false, error: 'Authentication required before accessing eventora-media Storage.' };
    }
    const path = buildStorageObjectPath({
      category,
      userId: data.user.id,
      eventId,
      eventSlug,
      roundId,
      fileName: file.name
    });
    return {
      ready: true,
      userId: data.user.id,
      bucket: state.storageBucket || DEFAULT_BUCKET,
      path,
      contentType: file.type || 'application/octet-stream',
      upsert: false,
      policyStatus: 'enforced_via_storage_rls'
    };
  }

  async function uploadMedia({ category, eventId, eventSlug, roundId, file, onProgress }) {
    if (typeof onProgress === 'function') onProgress(10);
    const prep = await prepareAuthenticatedMediaUpload({ category, eventId, eventSlug, roundId, file });
    if (!prep.ready) {
      return { ok: false, error: prep.error };
    }
    if (typeof onProgress === 'function') onProgress(35);

    const client = getClient();
    try {
      const { data, error } = await client.storage
        .from(prep.bucket)
        .upload(prep.path, file, {
          contentType: prep.contentType,
          cacheControl: '3600',
          upsert: false
        });
      if (error) {
        return { ok: false, error: formatDbError(error, 'Failed to upload file to Supabase Storage.') };
      }
      if (typeof onProgress === 'function') onProgress(100);
      return {
        ok: true,
        bucket: prep.bucket,
        path: (data && data.path) || prep.path,
        fileName: file.name,
        mimeType: prep.contentType,
        sizeBytes: Number(file.size) || 0
      };
    } catch (err) {
      return { ok: false, error: formatDbError(err, 'Storage upload interrupted.') };
    }
  }

  async function createSignedUrl(path, expiresSeconds = 900) {
    if (!path) return { ok: false, url: '', error: 'Missing storage file path.' };
    const { client, state } = await initClient();
    if (!client || !state.configured) {
      return { ok: false, url: '', error: 'Supabase client unavailable.' };
    }
    try {
      const bucket = state.storageBucket || DEFAULT_BUCKET;
      const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresSeconds);
      if (error || !data || !data.signedUrl) {
        return { ok: false, url: '', error: formatDbError(error, 'Unable to generate signed media URL.') };
      }
      return { ok: true, url: data.signedUrl, expiresAt: Date.now() + expiresSeconds * 1000 };
    } catch (err) {
      return { ok: false, url: '', error: formatDbError(err, 'Unable to generate signed URL.') };
    }
  }

  async function downloadMediaBlob(path) {
    if (!path) return { ok: false, blob: null, error: 'Missing storage file path.' };
    const { client, state } = await initClient();
    if (!client || !state.configured) return { ok: false, blob: null, error: 'Supabase client unavailable.' };
    try {
      const bucket = state.storageBucket || DEFAULT_BUCKET;
      const { data, error } = await client.storage.from(bucket).download(path);
      if (error || !data) {
        return { ok: false, blob: null, error: formatDbError(error, 'Unable to download private file.') };
      }
      return { ok: true, blob: data };
    } catch (err) {
      return { ok: false, blob: null, error: formatDbError(err, 'Download failed.') };
    }
  }

  async function removeMedia(paths) {
    const list = (Array.isArray(paths) ? paths : [paths]).filter(Boolean);
    if (!list.length) return { ok: true };
    const { client, state } = await initClient();
    if (!client || !state.configured) return { ok: false, error: 'Supabase client unavailable.' };
    try {
      const bucket = state.storageBucket || DEFAULT_BUCKET;
      const { error } = await client.storage.from(bucket).remove(list);
      if (error) return { ok: false, error: formatDbError(error, 'Failed to remove file from Storage.') };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: formatDbError(err, 'Storage deletion error.') };
    }
  }

  async function replaceMedia({ oldPath, ...uploadOpts }) {
    const up = await uploadMedia(uploadOpts);
    if (!up.ok) return up;
    if (oldPath && oldPath !== up.path) {
      await removeMedia([oldPath]);
    }
    return up;
  }

  return {
    init: initClient,
    getClient,
    getState,
    validateConfig,
    db: {
      isUuid,
      formatError: formatDbError,
      runQuery: runDbQuery,
      probeDatabase,
      getStatus: () => ({ ...dbProbeState }),
      syncServerClock,
      getServerNowMs
    },
    storage: {
      BUCKET_NAME: DEFAULT_BUCKET,
      MAX_IMAGE_BYTES,
      MAX_CONTENT_BYTES,
      ALLOWED_IMAGE_TYPES,
      validateImageFile,
      validateMediaFile,
      buildStorageObjectPath,
      prepareAuthenticatedMediaUpload,
      uploadMedia,
      createSignedUrl,
      downloadMediaBlob,
      removeMedia,
      replaceMedia
    }
  };
})();
