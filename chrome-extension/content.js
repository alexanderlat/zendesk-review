(() => {
  'use strict';

  const REVIEW_HOST  = 'zendesk-review-production.up.railway.app';
  const DRAWER_ID    = 'latour-review-drawer';
  const STORAGE_KEY  = 'latour-review-position';

  // Posities: right | left | center
  function getPosition() {
    try { return localStorage.getItem(STORAGE_KEY) || 'right'; } catch(_) { return 'right'; }
  }
  function savePosition(pos) {
    try { localStorage.setItem(STORAGE_KEY, pos); } catch(_) {}
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('latour-review-styles')) return;
    const style = document.createElement('style');
    style.id = 'latour-review-styles';
    style.textContent = `
      #latour-review-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.35);
        z-index: 9998;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s;
      }
      #latour-review-overlay.lr-open {
        opacity: 1;
        pointer-events: auto;
      }

      /* ── Basis drawer ── */
      #${DRAWER_ID} {
        position: fixed;
        background: #fff;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
                    opacity  0.28s cubic-bezier(0.4, 0, 0.2, 1);
      }

      /* Rechts (default) */
      #${DRAWER_ID}.lr-pos-right {
        top: 0; right: 0;
        width: 540px; max-width: 100vw; height: 100vh;
        box-shadow: -8px 0 32px rgba(0,0,0,0.18);
        transform: translateX(100%);
        border-radius: 0;
      }
      #${DRAWER_ID}.lr-pos-right.lr-open { transform: translateX(0); }

      /* Links */
      #${DRAWER_ID}.lr-pos-left {
        top: 0; left: 0;
        width: 540px; max-width: 100vw; height: 100vh;
        box-shadow: 8px 0 32px rgba(0,0,0,0.18);
        transform: translateX(-100%);
        border-radius: 0;
      }
      #${DRAWER_ID}.lr-pos-left.lr-open { transform: translateX(0); }

      /* Midden */
      #${DRAWER_ID}.lr-pos-center {
        top: 50%; left: 50%;
        width: 620px; max-width: 96vw;
        height: 88vh; max-height: 800px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.28);
        border-radius: 12px;
        transform: translate(-50%, -46%);
        opacity: 0;
      }
      #${DRAWER_ID}.lr-pos-center.lr-open {
        transform: translate(-50%, -50%);
        opacity: 1;
      }

      /* Header */
      #latour-review-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        background: #1C3D2E;
        color: #fff;
        flex-shrink: 0;
        border-radius: inherit;
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
      }
      #latour-review-header-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      #latour-review-title {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.2;
      }
      #latour-review-subtitle {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 11px;
        opacity: 0.65;
        margin-top: 2px;
      }
      #latour-review-header-right {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      /* Positie-picker knop */
      #latour-pos-btn {
        width: 32px; height: 32px;
        border: none;
        background: rgba(255,255,255,0.15);
        border-radius: 6px;
        color: #fff;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.15s;
        position: relative;
        flex-shrink: 0;
      }
      #latour-pos-btn:hover { background: rgba(255,255,255,0.28); }

      /* Positie dropdown */
      #latour-pos-menu {
        display: none;
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.14);
        overflow: hidden;
        min-width: 170px;
        z-index: 10001;
      }
      #latour-pos-menu.lr-menu-open { display: block; }
      .latour-pos-option {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        color: #111827;
        cursor: pointer;
        transition: background 0.12s;
        white-space: nowrap;
        border: none;
        background: none;
        width: 100%;
        text-align: left;
      }
      .latour-pos-option:hover { background: #f3f4f6; }
      .latour-pos-option.lr-active { background: #E8F2EC; color: #1C3D2E; font-weight: 600; }
      .latour-pos-option svg { flex-shrink: 0; opacity: 0.7; }
      .latour-pos-option.lr-active svg { opacity: 1; }

      #latour-review-close {
        width: 32px; height: 32px;
        border: none;
        background: rgba(255,255,255,0.15);
        border-radius: 6px;
        color: #fff;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        transition: background 0.15s;
      }
      #latour-review-close:hover { background: rgba(255,255,255,0.28); }

      #latour-review-iframe {
        flex: 1;
        border: none;
        display: block;
        width: 100%;
        border-radius: 0 0 inherit inherit;
      }

      /* Openknop in Zendesk noot */
      .latour-review-btn {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 8px 14px;
        background: #1C3D2E;
        color: #fff !important;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        text-decoration: none !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        transition: background 0.15s;
        vertical-align: middle;
      }
      .latour-review-btn:hover { background: #2D5C44; }
      .latour-review-btn svg { flex-shrink: 0; }
    `;
    document.head.appendChild(style);
  }

  // ── Positie toepassen ────────────────────────────────────────────────────────
  function applyPosition(pos) {
    const drawer = document.getElementById(DRAWER_ID);
    if (!drawer) return;
    drawer.classList.remove('lr-pos-right', 'lr-pos-left', 'lr-pos-center');
    drawer.classList.add(`lr-pos-${pos}`);
    // Update actieve staat in menu
    document.querySelectorAll('.latour-pos-option').forEach(el => {
      el.classList.toggle('lr-active', el.dataset.pos === pos);
    });
  }

  // ── Drawer bouwen ────────────────────────────────────────────────────────────
  function buildDrawer() {
    if (document.getElementById(DRAWER_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = 'latour-review-overlay';
    overlay.addEventListener('click', closeDrawer);

    const drawer = document.createElement('div');
    drawer.id = DRAWER_ID;

    drawer.innerHTML = `
      <div id="latour-review-header">
        <div id="latour-review-header-left">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <div>
            <div id="latour-review-title">Claude Concept Review</div>
            <div id="latour-review-subtitle">Laden…</div>
          </div>
        </div>
        <div id="latour-review-header-right">

          <!-- Positie-picker -->
          <div style="position:relative">
            <button id="latour-pos-btn" title="Positie wijzigen" aria-label="Positie wijzigen">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </button>
            <div id="latour-pos-menu">
              <button class="latour-pos-option" data-pos="right">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="13" y="3" width="8" height="18" rx="1"/><line x1="3" y1="12" x2="9" y2="12"/>
                </svg>
                Rechts
              </button>
              <button class="latour-pos-option" data-pos="left">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="8" height="18" rx="1"/><line x1="15" y1="12" x2="21" y2="12"/>
                </svg>
                Links
              </button>
              <button class="latour-pos-option" data-pos="center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="5" y="4" width="14" height="16" rx="2"/>
                </svg>
                Midden (popup)
              </button>
            </div>
          </div>

          <!-- Sluiten -->
          <button id="latour-review-close" title="Sluiten (Esc)" aria-label="Sluiten">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <iframe id="latour-review-iframe" src="" title="Claude Concept Review"></iframe>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    // Sluiten
    document.getElementById('latour-review-close').addEventListener('click', closeDrawer);

    // Positie-menu toggle
    const posBtn  = document.getElementById('latour-pos-btn');
    const posMenu = document.getElementById('latour-pos-menu');
    posBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      posMenu.classList.toggle('lr-menu-open');
    });

    // Positie-opties
    document.querySelectorAll('.latour-pos-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pos = btn.dataset.pos;
        savePosition(pos);
        applyPosition(pos);
        posMenu.classList.remove('lr-menu-open');
      });
    });

    // Klik buiten menu sluit het
    document.addEventListener('click', () => posMenu.classList.remove('lr-menu-open'));

    // Huidige positie toepassen
    applyPosition(getPosition());
  }

  // ── Drawer openen/sluiten ────────────────────────────────────────────────────
  function openDrawer(url, ticketId) {
    buildDrawer();
    applyPosition(getPosition());

    const drawer   = document.getElementById(DRAWER_ID);
    const overlay  = document.getElementById('latour-review-overlay');
    const iframe   = document.getElementById('latour-review-iframe');
    const subtitle = document.getElementById('latour-review-subtitle');

    iframe.src = url;
    subtitle.textContent = ticketId ? `Ticket #${ticketId}` : '';

    overlay.classList.add('lr-open');
    drawer.classList.add('lr-open');
  }

  function closeDrawer() {
    const drawer  = document.getElementById(DRAWER_ID);
    const overlay = document.getElementById('latour-review-overlay');
    if (!drawer) return;
    drawer.classList.remove('lr-open');
    overlay.classList.remove('lr-open');
    setTimeout(() => {
      const iframe = document.getElementById('latour-review-iframe');
      if (iframe && !drawer.classList.contains('lr-open')) iframe.src = '';
    }, 300);
  }

  // ── Link → knop conversie ────────────────────────────────────────────────────
  function convertLinks() {
    const anchors = document.querySelectorAll(`a[href*="${REVIEW_HOST}"]`);
    anchors.forEach(a => {
      if (a.dataset.latourConverted) return;
      a.dataset.latourConverted = '1';

      let ticketId = '';
      try {
        const u = new URL(a.href);
        const match = u.pathname.match(/\/ticket\/(\d+)/);
        if (match) ticketId = match[1];
      } catch (_) {}

      const btn = document.createElement('button');
      btn.className = 'latour-review-btn';
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        Bekijk concept
      `;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openDrawer(a.href, ticketId);
      });

      a.replaceWith(btn);
    });
  }

  // ── MutationObserver ─────────────────────────────────────────────────────────
  function startObserver() {
    convertLinks();
    const observer = new MutationObserver(() => convertLinks());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Escape ───────────────────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  // ── Init ─────────────────────────────────────────────────────────────────────
  injectStyles();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }
})();
