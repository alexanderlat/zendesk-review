(() => {
  'use strict';

  const REVIEW_HOST = 'zendesk-review-production.up.railway.app';
  const DRAWER_ID   = 'latour-review-drawer';

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
      #${DRAWER_ID} {
        position: fixed;
        top: 0;
        right: 0;
        width: 540px;
        max-width: 100vw;
        height: 100vh;
        background: #fff;
        box-shadow: -8px 0 32px rgba(0,0,0,0.18);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
      }
      #${DRAWER_ID}.lr-open {
        transform: translateX(0);
      }
      #latour-review-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        background: #1C3D2E;
        color: #fff;
        flex-shrink: 0;
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
      #latour-review-close {
        width: 32px;
        height: 32px;
        border: none;
        background: rgba(255,255,255,0.15);
        border-radius: 6px;
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background 0.15s;
      }
      #latour-review-close:hover {
        background: rgba(255,255,255,0.28);
      }
      #latour-review-iframe {
        flex: 1;
        border: none;
        display: block;
        width: 100%;
      }
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
      .latour-review-btn:hover {
        background: #2D5C44;
      }
      .latour-review-btn svg {
        flex-shrink: 0;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Drawer ───────────────────────────────────────────────────────────────────
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
        <button id="latour-review-close" title="Sluiten (Esc)" aria-label="Sluiten">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <iframe id="latour-review-iframe" src="" title="Claude Concept Review"></iframe>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    document.getElementById('latour-review-close').addEventListener('click', closeDrawer);
  }

  function openDrawer(url, ticketId) {
    buildDrawer();
    const drawer  = document.getElementById(DRAWER_ID);
    const overlay = document.getElementById('latour-review-overlay');
    const iframe  = document.getElementById('latour-review-iframe');
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
    // Leeg iframe na animatie om geheugen vrij te geven
    setTimeout(() => {
      const iframe = document.getElementById('latour-review-iframe');
      if (iframe && !drawer.classList.contains('lr-open')) {
        iframe.src = '';
      }
    }, 300);
  }

  // ── Link → knop conversie ────────────────────────────────────────────────────
  function convertLinks() {
    const anchors = document.querySelectorAll(`a[href*="${REVIEW_HOST}"]`);
    anchors.forEach(a => {
      if (a.dataset.latourConverted) return;
      a.dataset.latourConverted = '1';

      // Haal ticket-ID op uit de URL (bijv. /ticket/12345)
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

  // ── MutationObserver: Zendesk laadt tickets dynamisch ────────────────────────
  function startObserver() {
    convertLinks(); // direct bij laden
    const observer = new MutationObserver(() => convertLinks());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Escape-toets ─────────────────────────────────────────────────────────────
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
