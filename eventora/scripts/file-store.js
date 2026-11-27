/* ==========================================================================
   EVENTORA PHASE 8: INDEXEDDB FILE & ASSET STORE
   Stores larger uploaded files (PDF question papers, problem PDFs, reference
   images, starter ZIPs, and participant submission attachments) in IndexedDB
   so multi-megabyte binary files do not bloat sessionStorage/localStorage.
   Includes safe in-memory fallback when IndexedDB is unavailable in sandboxed tests.
   ========================================================================== */

window.EventoraFiles = (function () {
  const DB_NAME = 'eventora_round_files_v1';
  const STORE_NAME = 'files';
  const DB_VERSION = 1;
  const memoryFallback = new Map();
  let dbPromise = null;

  function hasIndexedDb() {
    try {
      return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch (_) {
      return false;
    }
  }

  function openDb() {
    if (!hasIndexedDb()) return Promise.resolve(null);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (evt) => {
          const db = evt.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('eventSlug', 'eventSlug', { unique: false });
            store.createIndex('roundId', 'roundId', { unique: false });
          }
        };
        req.onsuccess = (evt) => resolve(evt.target.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });

    return dbPromise;
  }

  function createFileId(prefix) {
    return `${prefix || 'file'}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  async function saveFile(meta) {
    const m = meta && typeof meta === 'object' ? meta : {};
    const id = String(m.id || createFileId('evf'));
    const record = {
      id,
      eventSlug: String(m.eventSlug || ''),
      roundId: String(m.roundId || ''),
      fileName: String(m.fileName || (m.blob && m.blob.name) || 'attachment'),
      mimeType: String(m.mimeType || (m.blob && m.blob.type) || 'application/octet-stream'),
      sizeBytes: Number(m.sizeBytes != null ? m.sizeBytes : (m.blob && m.blob.size) || 0),
      blob: m.blob || null,
      dataUrl: typeof m.dataUrl === 'string' ? m.dataUrl : '',
      uploadedAt: String(m.uploadedAt || new Date().toISOString())
    };

    memoryFallback.set(id, record);
    const db = await openDb();
    if (!db) {
      return { ok: true, id, backend: 'memory', record };
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(record);
        tx.oncomplete = () => resolve({ ok: true, id, backend: 'indexeddb', record });
        tx.onerror = () => resolve({ ok: true, id, backend: 'memory', record });
      } catch (_) {
        resolve({ ok: true, id, backend: 'memory', record });
      }
    });
  }

  async function getFile(id) {
    if (!id) return null;
    if (memoryFallback.has(id)) {
      return memoryFallback.get(id);
    }
    const db = await openDb();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => {
          const res = req.result || null;
          if (res) memoryFallback.set(id, res);
          resolve(res);
        };
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  }

  async function deleteFile(id) {
    if (!id) return false;
    memoryFallback.delete(id);
    const db = await openDb();
    if (!db) return true;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  }

  async function resolveBlobUrl(fileId, inlineFallbackDataUrl) {
    const rec = await getFile(fileId);
    if (rec && rec.blob && typeof Blob !== 'undefined' && rec.blob instanceof Blob && window.URL && window.URL.createObjectURL) {
      return {
        url: window.URL.createObjectURL(rec.blob),
        isBlobUrl: true,
        fileName: rec.fileName,
        mimeType: rec.mimeType
      };
    }
    const dUrl = (rec && rec.dataUrl) || inlineFallbackDataUrl || '';
    if (dUrl && dUrl.includes(',') && window.URL && window.URL.createObjectURL) {
      try {
        const parts = dUrl.split(',');
        const meta = parts[0] || '';
        const mimeMatch = meta.match(/data:([^;]+);/i);
        const mime = mimeMatch ? mimeMatch[1] : ((rec && rec.mimeType) || 'application/pdf');
        const raw = window.atob(parts[1]);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
        return {
          url: window.URL.createObjectURL(new Blob([bytes], { type: mime })),
          isBlobUrl: true,
          fileName: (rec && rec.fileName) || 'document.pdf',
          mimeType: mime
        };
      } catch (_) {}
    }
    return { url: dUrl, isBlobUrl: false, fileName: (rec && rec.fileName) || 'document', mimeType: '' };
  }

  async function cloneEventFiles(srcSlug, destSlug, idPairs) {
    if (!Array.isArray(idPairs) || !idPairs.length) return {};
    const mapped = {};
    for (const pair of idPairs) {
      if (!pair || !pair.oldFileId) continue;
      const srcRec = await getFile(pair.oldFileId);
      if (srcRec) {
        const saved = await saveFile({
          id: pair.newFileId || createFileId('evf'),
          eventSlug: destSlug,
          roundId: pair.newRoundId || srcRec.roundId,
          fileName: srcRec.fileName,
          mimeType: srcRec.mimeType,
          sizeBytes: srcRec.sizeBytes,
          blob: srcRec.blob,
          dataUrl: srcRec.dataUrl
        });
        if (saved.ok) mapped[pair.oldFileId] = saved.id;
      }
    }
    return mapped;
  }

  async function listFiles(eventSlug) {
    const filterSlug = String(eventSlug || '').trim();
    const byId = new Map();
    memoryFallback.forEach((rec) => {
      if (!filterSlug || rec.eventSlug === filterSlug) byId.set(rec.id, rec);
    });
    const db = await openDb();
    if (!db) {
      return Array.from(byId.values());
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          (req.result || []).forEach((rec) => {
            if (rec && rec.id && (!filterSlug || rec.eventSlug === filterSlug)) {
              byId.set(rec.id, rec);
            }
          });
          resolve(Array.from(byId.values()));
        };
        req.onerror = () => resolve(Array.from(byId.values()));
      } catch (_) {
        resolve(Array.from(byId.values()));
      }
    });
  }

  async function uploadFile(eventId, roundId, file, opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const category = o.category || (roundId ? 'content' : 'poster');
    const eventSlug = String(o.eventSlug || '');
    if (!file) {
      return { ok: false, error: 'No file selected for upload.' };
    }

    const sbMod = window.EventoraSupabase;
    const useSupabase = window.EventoraStore
      && typeof window.EventoraStore.getBackendMode === 'function'
      && window.EventoraStore.getBackendMode() === 'supabase'
      && sbMod && sbMod.db && sbMod.storage
      && (category === 'avatar' || sbMod.db.isUuid(eventId));

    if (useSupabase) {
      const check = sbMod.storage.validateMediaFile(file, category);
      if (!check.valid) return { ok: false, error: check.error };
      const up = await sbMod.storage.uploadMedia({
        category,
        eventId,
        eventSlug,
        roundId: sbMod.db.isUuid(roundId) ? roundId : undefined,
        file,
        onProgress: o.onProgress
      });
      if (!up.ok) return up;
      const signed = category === 'poster' || category === 'cover' || category === 'avatar'
        ? await sbMod.storage.createSignedUrl(up.path, 3600)
        : { ok: false, url: '' };
      return {
        ok: true,
        backend: 'supabase_storage',
        bucket: up.bucket,
        storagePath: up.path,
        path: up.path,
        signedUrl: signed.ok ? signed.url : '',
        fileId: '',
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: Number(file.size) || 0
      };
    }

    if (typeof o.onProgress === 'function') o.onProgress(40);
    let dataUrl = '';
    if (file.size <= 180000) {
      dataUrl = await new Promise((resolve) => {
        try {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result || ''));
          r.onerror = () => resolve('');
          r.readAsDataURL(file);
        } catch (_) {
          resolve('');
        }
      });
    }
    const saved = await saveFile({
      eventSlug: eventSlug || String(eventId || ''),
      roundId: String(roundId || ''),
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: Number(file.size) || 0,
      blob: file,
      dataUrl
    });
    if (typeof o.onProgress === 'function') o.onProgress(100);
    return {
      ok: Boolean(saved && saved.ok),
      backend: saved ? saved.backend : 'memory',
      bucket: '',
      storagePath: '',
      path: '',
      signedUrl: dataUrl,
      fileId: saved ? saved.id : '',
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: Number(file.size) || 0,
      dataUrl
    };
  }

  async function removeFile(ref) {
    const r = ref && typeof ref === 'object' ? ref : { fileId: ref };
    let ok = true;
    if (r.fileId) {
      await deleteFile(r.fileId);
    }
    if (r.storagePath && window.EventoraSupabase && window.EventoraSupabase.storage) {
      const rem = await window.EventoraSupabase.storage.removeMedia([r.storagePath]);
      if (!rem.ok) ok = false;
    }
    return { ok };
  }

  async function replaceFile(oldRef, eventId, roundId, newFile, opts) {
    const up = await uploadFile(eventId, roundId, newFile, opts);
    if (!up.ok) return up;
    if (oldRef) {
      await removeFile(oldRef);
    }
    return up;
  }

  async function getAccessUrl({ fileId, storagePath, fallbackDataUrl, expiresSeconds = 900 }) {
    if (storagePath && window.EventoraSupabase && window.EventoraSupabase.storage) {
      const res = await window.EventoraSupabase.storage.createSignedUrl(storagePath, expiresSeconds);
      if (res.ok && res.url) {
        return { ok: true, url: res.url, isBlobUrl: false, storagePath };
      }
      return { ok: false, url: '', isBlobUrl: false, error: res.error || 'Permission denied or missing private file.' };
    }
    const local = await resolveBlobUrl(fileId, fallbackDataUrl);
    return { ok: Boolean(local.url), ...local };
  }

  return {
    createFileId,
    saveFile,
    getFile,
    deleteFile,
    listFiles,
    resolveBlobUrl,
    cloneEventFiles,
    hasIndexedDb,
    uploadFile,
    replaceFile,
    removeFile,
    getAccessUrl
  };
})();
window.EventoraFileStore = window.EventoraFiles;
