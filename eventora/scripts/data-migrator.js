/* ==========================================================================
   EVENTORA PHASE 10: LOCAL PROTOTYPE TO POSTGRESQL DATA MIGRATOR
   Safely scans browser-local events (localStorage/sessionStorage) and binary
   files (IndexedDB), lets organizers review & check duplicates before import,
   uploads assets to `eventora-media`, and imports without silently deleting
   or overwriting remote PostgreSQL records.
   ========================================================================== */

window.EventoraMigrator = (function () {
  function esc(str) {
    return window.EventoraUI && window.EventoraUI.escapeHTML
      ? window.EventoraUI.escapeHTML(String(str == null ? '' : str))
      : String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function detectLocalPrototypeData() {
    if (!window.EventoraStore || typeof window.EventoraStore.getLocalPrototypeSnapshot !== 'function') {
      return { events: [], filesCount: 0 };
    }
    const snap = window.EventoraStore.getLocalPrototypeSnapshot();
    const files = window.EventoraFiles && typeof window.EventoraFiles.listFiles === 'function'
      ? await window.EventoraFiles.listFiles()
      : [];

    // Probe remote slugs to guard against accidental duplicate creation or overwrite
    const existingSlugs = new Set();
    if (window.EventoraSupabase && window.EventoraSupabase.db && window.EventoraSupabase.db.getStatus().ready) {
      const sb = window.EventoraSupabase.getClient();
      if (sb) {
        const res = await sb.from('events').select('slug');
        if (!res.error && Array.isArray(res.data)) {
          res.data.forEach((r) => existingSlugs.add(r.slug));
        }
      }
    }

    const enriched = snap.events.map((ev) => {
      const evFiles = files.filter((f) => f.eventSlug === ev.slug);
      let pdfCount = 0;
      let qCount = 0;
      let pCount = 0;
      Object.values(ev.roundContentById || {}).forEach((pkg) => {
        pdfCount += (pkg.pdfs || []).length;
        qCount += (pkg.questions || []).length;
        pCount += (pkg.codingProblems || []).length;
      });
      return {
        slug: ev.slug,
        name: ev.name,
        eventStatus: ev.eventStatus,
        isCreatedEvent: Boolean(ev.isCreatedEvent),
        roundsCount: (ev.rounds || []).length,
        teamsCount: (ev.teams || []).length,
        participantsCount: (ev.participants || []).length,
        pdfCount,
        questionCount: qCount,
        problemCount: pCount,
        indexedFilesCount: evFiles.length,
        alreadyExistsInDb: existingSlugs.has(ev.slug),
        rawEvent: ev,
        files: evFiles
      };
    });

    return {
      events: enriched,
      filesCount: files.length
    };
  }

  async function dataUrlToFile(dataUrl, fileName, mimeType) {
    try {
      const parts = String(dataUrl || '').split(',');
      if (parts.length < 2) return null;
      const bytesStr = atob(parts[1]);
      const arr = new Uint8Array(bytesStr.length);
      for (let i = 0; i < bytesStr.length; i += 1) arr[i] = bytesStr.charCodeAt(i);
      return new File([arr], fileName || 'document.pdf', { type: mimeType || 'application/pdf' });
    } catch (_) {
      return null;
    }
  }

  async function importSelectedEvents(selectedSlugs, onLog) {
    const log = typeof onLog === 'function' ? onLog : () => {};
    if (!window.EventoraSupabase || !window.EventoraSupabase.db || !window.EventoraSupabase.db.getStatus().ready) {
      return { ok: false, imported: 0, skipped: 0, errors: ['Supabase database migrations must be applied before importing.'] };
    }

    const scan = await detectLocalPrototypeData();
    const targetSet = new Set(selectedSlugs || []);
    const candidates = scan.events.filter((item) => targetSet.has(item.slug));
    if (!candidates.length) {
      return { ok: false, imported: 0, skipped: 0, errors: ['Select at least one local prototype event to import.'] };
    }

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (const item of candidates) {
      if (item.alreadyExistsInDb) {
        skipped += 1;
        log(`Skipped "${item.name}" (${item.slug}) — already exists in PostgreSQL (protected against overwrite).`);
        continue;
      }

      try {
        log(`Importing event "${item.name}"...`);
        const evPayload = { ...item.rawEvent, statusKey: item.rawEvent.statusKey === 'draft' ? 'draft' : 'published' };
        const created = await window.EventoraEventsApi.createEvent(evPayload);
        if (!created.ok || !created.data) {
          errors.push(`${item.name}: ${created.error || 'Failed to create event record.'}`);
          continue;
        }
        const dbEventId = created.data.dbId;

        // 1. Migrate Rounds
        const roundDbByClientId = new Map();
        if (item.rawEvent.rounds && item.rawEvent.rounds.length > 0) {
          const rSync = await window.EventoraRoundsApi.syncEventRoundsList(dbEventId, item.rawEvent.rounds);
          if (!rSync.ok) {
            errors.push(`${item.name} rounds: ${rSync.error}`);
          } else {
            (rSync.data || []).forEach((r) => roundDbByClientId.set(r.id, r.dbId));
          }
        }

        // 2. Migrate Round Contents, Storage Files & Questions
        const fileMapById = new Map(item.files.map((f) => [f.id, f]));
        for (const [clientRndId, pkg] of Object.entries(item.rawEvent.roundContentById || {})) {
          const dbRoundId = roundDbByClientId.get(clientRndId);
          if (!dbRoundId) continue;

          // Package Meta
          if (pkg.contentStatus && pkg.contentStatus !== 'No Content') {
            await window.EventoraRoundContentApi.saveRoundContentItem(dbEventId, dbRoundId, {
              contentType: 'package_meta',
              title: pkg.paperTitle || 'Round Package',
              description: pkg.description || '',
              releaseStatus: pkg.contentStatus === 'Published' ? 'Published' : 'Draft',
              contentData: {
                instructions: pkg.instructions || '',
                totalMarks: pkg.totalMarks,
                durationLabel: pkg.durationLabel,
                availability: pkg.availability,
                challengeSpec: pkg.challengeSpec
              }
            });
          }

          // PDFs
          for (const pdf of (pkg.pdfs || [])) {
            let filePath = '';
            const rec = pdf.fileId ? fileMapById.get(pdf.fileId) : null;
            let uploadFile = rec && rec.blob ? new File([rec.blob], pdf.fileName, { type: pdf.mimeType || 'application/pdf' }) : null;
            if (!uploadFile && (pdf.dataUrl || (rec && rec.dataUrl))) {
              uploadFile = await dataUrlToFile(pdf.dataUrl || rec.dataUrl, pdf.fileName, pdf.mimeType);
            }
            if (uploadFile) {
              const up = await window.EventoraRoundContentApi.uploadRoundFile({
                category: 'content',
                eventId: dbEventId,
                roundId: dbRoundId,
                file: uploadFile
              });
              if (up.ok) filePath = up.path;
              else log(`  Warning: PDF "${pdf.fileName}" binary skipped (${up.error}); metadata saved.`);
            }
            await window.EventoraRoundContentApi.saveRoundContentItem(dbEventId, dbRoundId, {
              contentType: 'pdf_document',
              title: pdf.title || pdf.fileName,
              description: pdf.description || '',
              filePath,
              releaseStatus: pkg.contentStatus === 'Published' ? 'Published' : 'Draft',
              contentData: {
                clientId: pdf.id,
                fileName: pdf.fileName,
                mimeType: pdf.mimeType,
                sizeBytes: pdf.sizeBytes,
                category: pdf.category,
                instructions: pdf.instructions,
                totalMarks: pdf.totalMarks,
                duration: pdf.duration,
                questionCount: pdf.questionCount
              }
            });
          }

          // Questions
          if (pkg.questions && pkg.questions.length > 0) {
            const qRes = await window.EventoraRoundContentApi.syncRoundQuestions(dbEventId, dbRoundId, pkg.questions);
            if (!qRes.ok) errors.push(`${item.name} questions: ${qRes.error}`);
          }

          // Coding Problems
          for (const prob of (pkg.codingProblems || [])) {
            await window.EventoraRoundContentApi.saveRoundContentItem(dbEventId, dbRoundId, {
              contentType: 'coding_problem',
              title: prob.problemTitle,
              description: prob.statement,
              releaseStatus: pkg.contentStatus === 'Published' ? 'Published' : 'Draft',
              contentData: prob
            });
          }
        }

        if (item.participantsCount > 0) {
          log(`  Note: ${item.participantsCount} local prototype participant stub(s) kept safely in local browser storage (real participant accounts register with authenticated Supabase UIDs).`);
        }
        imported += 1;
        log(`Completed "${item.name}" -> PostgreSQL Event ID ${dbEventId}.`);
      } catch (err) {
        errors.push(`${item.name}: ${(err && err.message) || 'Unexpected import failure.'}`);
      }
    }

    return { ok: errors.length === 0, imported, skipped, errors };
  }

  async function openMigrationModal(options) {
    const opts = options || {};
    const onComplete = typeof opts.onComplete === 'function' ? opts.onComplete : null;
    let host = document.getElementById('evMigratorModalMount');
    if (!host) {
      host = document.createElement('div');
      host.id = 'evMigratorModalMount';
      document.body.appendChild(host);
    }

    host.innerHTML = `<div class="ev-rc-modal-backdrop"><div class="ev-rc-modal"><p style="margin:0;color:var(--ev-muted);">Scanning local prototype storage & IndexedDB...</p></div></div>`;
    const scan = await detectLocalPrototypeData();

    function renderModal() {
      const dbStat = window.EventoraSupabase && window.EventoraSupabase.db ? window.EventoraSupabase.db.getStatus() : {};
      host.innerHTML = `
        <div class="ev-rc-modal-backdrop" id="evMigBackdrop">
          <div class="ev-rc-modal ev-rc-modal-lg" role="dialog" aria-modal="true" aria-label="Migrate Local Prototype Data">
            <div class="ev-ws-card-head" style="margin-bottom:0.85rem;">
              <div>
                <span class="ev-badge ev-badge-open" style="margin-bottom:0.35rem;">Safe Migration Tool</span>
                <h2 class="ev-display" style="font-size:1.35rem;font-weight:600;">Migrate Local Prototype Data to PostgreSQL</h2>
              </div>
              <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evMigCloseBtn">Close</button>
            </div>

            ${!dbStat.ready ? `
              <div class="ev-auth-status is-error" style="margin-bottom:0.85rem;">
                <span><strong>Database Not Ready:</strong> ${esc(dbStat.errorMessage || 'Apply SQL migrations 001..018 before importing.')}</span>
              </div>
            ` : `
              <div class="ev-auth-status is-info" style="margin-bottom:0.85rem;">
                <span>Local prototype data is never deleted automatically, and events already present in PostgreSQL are skipped to prevent overwriting remote records.</span>
              </div>
            `}

            ${scan.events.length === 0 ? `
              <div class="ev-rc-subpanel">No local prototype events found in browser storage.</div>
            ` : `
              <div class="ev-rc-items-list" style="max-height:46vh;overflow-y:auto;">
                ${scan.events.map((ev) => `
                  <label class="ev-rc-item-card" style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;cursor:pointer;">
                    <div style="display:flex;align-items:flex-start;gap:0.65rem;">
                      <input type="checkbox" class="ev-mig-cb" value="${esc(ev.slug)}" ${ev.isCreatedEvent && !ev.alreadyExistsInDb ? 'checked' : ''} ${ev.alreadyExistsInDb ? 'disabled' : ''} style="margin-top:0.25rem;">
                      <div>
                        <strong style="font-size:0.92rem;color:var(--ev-charcoal);">${esc(ev.name)}</strong>
                        <div style="font-size:0.76rem;color:var(--ev-muted);">${esc(ev.slug)} &bull; ${ev.roundsCount} round(s) &bull; ${ev.pdfCount} PDF(s) &bull; ${ev.questionCount} MCQ(s) &bull; ${ev.problemCount} problem(s)</div>
                      </div>
                    </div>
                    <span class="ev-badge ${ev.alreadyExistsInDb ? 'ev-badge-sample' : 'ev-badge-open'}">
                      ${ev.alreadyExistsInDb ? 'Exists in DB (Protected)' : (ev.isCreatedEvent ? 'Created Draft' : 'Modified Sample')}
                    </span>
                  </label>
                `).join('')}
              </div>
            `}

            <pre id="evMigLogBox" class="ev-rc-code" style="display:none;max-height:160px;overflow-y:auto;margin-top:0.75rem;"></pre>

            <div style="display:flex;justify-content:flex-end;gap:0.55rem;margin-top:1rem;flex-wrap:wrap;">
              <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evMigCancelBtn">Cancel</button>
              <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evMigRunBtn" ${!dbStat.ready || scan.events.length === 0 ? 'disabled' : ''}>
                Import Selected to PostgreSQL
              </button>
            </div>
          </div>
        </div>
      `;

      const close = () => { host.innerHTML = ''; };
      document.getElementById('evMigCloseBtn')?.addEventListener('click', close);
      document.getElementById('evMigCancelBtn')?.addEventListener('click', close);
      document.getElementById('evMigRunBtn')?.addEventListener('click', async () => {
        const chosen = Array.from(host.querySelectorAll('.ev-mig-cb:checked')).map((c) => c.value);
        const logEl = document.getElementById('evMigLogBox');
        const runBtn = document.getElementById('evMigRunBtn');
        if (logEl) { logEl.style.display = 'block'; logEl.textContent = ''; }
        if (runBtn) { runBtn.disabled = true; runBtn.textContent = 'Importing...'; }
        const res = await importSelectedEvents(chosen, (line) => {
          if (logEl) logEl.textContent += line + '\n';
        });
        if (logEl) {
          logEl.textContent += `\nDone: ${res.imported} imported, ${res.skipped} skipped, ${res.errors.length} error(s).`;
          if (res.errors.length) logEl.textContent += '\nErrors:\n' + res.errors.join('\n');
        }
        if (runBtn) { runBtn.disabled = false; runBtn.textContent = 'Import Selected to PostgreSQL'; }
        if (res.imported > 0 && onComplete) onComplete(res);
      });
    }

    renderModal();
  }

  return {
    detectLocalPrototypeData,
    importSelectedEvents,
    openMigrationModal
  };
})();
