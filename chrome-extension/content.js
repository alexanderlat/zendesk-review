(() => {
  'use strict';

  const REVIEW_HOST   = 'zendesk-review-production.up.railway.app';
  const DRAWER_ID     = 'latour-review-drawer';
  const KEY_POSITION  = 'latour-review-position';
  const KEY_WIDTH     = 'latour-review-width';
  const KEY_SIZE_C    = 'latour-review-size-center';

  const DEFAULT_W  = 540;
  const MIN_W      = 320;
  const MAX_W      = () => Math.round(window.innerWidth * 0.85);
  const DEFAULT_CW = 1100;
  const DEFAULT_CH = () => Math.round(window.innerHeight * 0.90);
  const MIN_CW = 360;
  const MIN_CH = 400;

  // ── Opslag ───────────────────────────────────────────────────────────────────
  function getPosition()  { try { return localStorage.getItem(KEY_POSITION) || 'right'; } catch(_) { return 'right'; } }
  function savePosition(p){ try { localStorage.setItem(KEY_POSITION, p); } catch(_) {} }
  function getWidth()     { try { return parseInt(localStorage.getItem(KEY_WIDTH)) || DEFAULT_W; } catch(_) { return DEFAULT_W; } }
  function saveWidth(w)   { try { localStorage.setItem(KEY_WIDTH, w); } catch(_) {} }
  function getCenterSize(){ try { const s = JSON.parse(localStorage.getItem(KEY_SIZE_C)); if (s && s.w && s.h) return s; } catch(_) {} return { w: DEFAULT_CW, h: DEFAULT_CH() }; }
  function saveCenterSize(w, h) { try { localStorage.setItem(KEY_SIZE_C, JSON.stringify({ w, h })); } catch(_) {} }

  // ── Styles ───────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('latour-review-styles')) return;
    const style = document.createElement('style');
    style.id = 'latour-review-styles';
    style.textContent = `
      /* Dim-laag via ::before — alleen voor center positie */
      #${DRAWER_ID}.lr-pos-center.lr-open::before {
        content: '';
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.35);
        z-index: -1;
        pointer-events: auto;
      }

      /* ── Drawer basis ── */
      #${DRAWER_ID} {
        position: fixed;
        background: #fff;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        pointer-events: none;
        transition: transform 0.28s cubic-bezier(0.4,0,0.2,1),
                    opacity  0.28s cubic-bezier(0.4,0,0.2,1);
      }
      #${DRAWER_ID}.lr-open {
        pointer-events: auto;
      }

      /* Rechts */
      #${DRAWER_ID}.lr-pos-right {
        top: 0; right: 0; height: 100vh;
        box-shadow: -8px 0 32px rgba(0,0,0,0.18);
        transform: translateX(110%); border-radius: 0;
      }
      #${DRAWER_ID}.lr-pos-right.lr-open { transform: translateX(0); }

      /* Links */
      #${DRAWER_ID}.lr-pos-left {
        top: 0; left: 0; height: 100vh;
        box-shadow: 8px 0 32px rgba(0,0,0,0.18);
        transform: translateX(-110%); border-radius: 0;
      }
      #${DRAWER_ID}.lr-pos-left.lr-open { transform: translateX(0); }

      /* Midden */
      #${DRAWER_ID}.lr-pos-center {
        top: 50%; left: 50%;
        max-width: 96vw; max-height: 96vh;
        box-shadow: 0 16px 48px rgba(0,0,0,0.28);
        border-radius: 12px;
        transform: translate(-50%, -46%); opacity: 0;
      }
      #${DRAWER_ID}.lr-pos-center.lr-open {
        transform: translate(-50%, -50%); opacity: 1;
      }

      /* Resize handles */
      .lr-resize-handle {
        position: absolute; z-index: 10000; background: transparent;
      }
      .lr-resize-w  { left: 0;  top: 0; width: 6px; height: 100%; cursor: ew-resize; }
      .lr-resize-e  { right: 0; top: 0; width: 6px; height: 100%; cursor: ew-resize; }
      .lr-resize-ce  { right: 0; top: 8px; width: 6px; height: calc(100% - 16px); cursor: ew-resize; }
      .lr-resize-cs  { bottom: 0; left: 8px; height: 6px; width: calc(100% - 16px); cursor: ns-resize; }
      .lr-resize-cse { right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; }
      .lr-resize-handle:hover { background: rgba(45,92,68,0.18); border-radius: 3px; transition: background 0.15s; }

      /* Header */
      #latour-review-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 18px; background: #1C3D2E; color: #fff;
        flex-shrink: 0; border-radius: inherit;
        border-bottom-left-radius: 0; border-bottom-right-radius: 0;
      }
      #latour-review-header-left { display: flex; align-items: center; gap: 10px; }
      #latour-review-title {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px; font-weight: 600; line-height: 1.2;
      }
      #latour-review-subtitle {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 11px; opacity: 0.65; margin-top: 2px;
      }
      #latour-review-header-right { display: flex; align-items: center; gap: 6px; }

      #latour-pos-btn {
        width: 32px; height: 32px; border: none;
        background: rgba(255,255,255,0.15); border-radius: 6px;
        color: #fff; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.15s; position: relative; flex-shrink: 0;
      }
      #latour-pos-btn:hover { background: rgba(255,255,255,0.28); }

      #latour-pos-menu {
        display: none; position: absolute;
        top: calc(100% + 6px); right: 0;
        background: #fff; border: 1px solid #e5e7eb;
        border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.14);
        overflow: hidden; min-width: 170px; z-index: 10001;
      }
      #latour-pos-menu.lr-menu-open { display: block; }

      .latour-pos-option {
        display: flex; align-items: center; gap: 10px; padding: 10px 14px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px; color: #111827; cursor: pointer;
        transition: background 0.12s; white-space: nowrap;
        border: none; background: none; width: 100%; text-align: left;
      }
      .latour-pos-option:hover { background: #f3f4f6; }
      .latour-pos-option.lr-active { background: #E8F2EC; color: #1C3D2E; font-weight: 600; }
      .latour-pos-option svg { flex-shrink: 0; opacity: 0.7; }
      .latour-pos-option.lr-active svg { opacity: 1; }

      #latour-review-close {
        width: 32px; height: 32px; border: none;
        background: rgba(255,255,255,0.15); border-radius: 6px;
        color: #fff; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; transition: background 0.15s;
      }
      #latour-review-close:hover { background: rgba(255,255,255,0.28); }

      #latour-review-iframe {
        flex: 1; border: none; display: block; width: 100%;
        border-radius: 0 0 inherit inherit;
      }

      .latour-review-btn {
        display: inline-flex; align-items: center; gap: 7px;
        padding: 8px 14px; background: #1C3D2E;
        color: #fff !important; border-radius: 6px;
        font-size: 13px; font-weight: 500; cursor: pointer; border: none;
        text-decoration: none !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        transition: background 0.15s; vertical-align: middle;
      }
      .latour-review-btn:hover { background: #2D5C44; }
      .latour-review-btn svg { flex-shrink: 0; }

      body.lr-resizing { user-select: none !important; }
    `;
    document.head.appendChild(style);
  }

  // ── Positie + formaat toepassen ──────────────────────────────────────────────
  function applyPosition(pos) {
    const drawer = document.getElementById(DRAWER_ID);
    if (!drawer) return;
    drawer.classList.remove('lr-pos-right', 'lr-pos-left', 'lr-pos-center');
    drawer.classList.add(`lr-pos-${pos}`);
    document.querySelectorAll('.latour-pos-option').forEach(el => {
      el.classList.toggle('lr-active', el.dataset.pos === pos);
    });
    applySize(pos);
  }

  function applySize(pos) {
    const drawer = document.getElementById(DRAWER_ID);
    if (!drawer) return;
    if (pos === 'center') {
      const { w, h } = getCenterSize();
      drawer.style.width  = `${Math.min(w, window.innerWidth * 0.96)}px`;
      drawer.style.height = `${Math.min(h, window.innerHeight * 0.96)}px`;
    } else {
      drawer.style.width  = `${Math.min(getWidth(), window.innerWidth)}px`;
      drawer.style.height = '';
    }
  }

  // ── Resize ───────────────────────────────────────────────────────────────────
  function addResizeHandles(drawer) {
    [
      ['lr-resize-w',   'w'],
      ['lr-resize-e',   'e'],
      ['lr-resize-ce',  'ce'],
      ['lr-resize-cs',  'cs'],
      ['lr-resize-cse', 'cse'],
    ].forEach(([cls, dir]) => {
      const h = document.createElement('div');
      h.className = `lr-resize-handle ${cls}`;
      h.dataset.dir = dir;
      h.addEventListener('mousedown', startResize);
      drawer.appendChild(h);
    });
  }

  function startResize(e) {
    e.preventDefault(); e.stopPropagation();
    const dir    = e.currentTarget.dataset.dir;
    const drawer = document.getElementById(DRAWER_ID);
    const pos    = getPosition();
    const startX = e.clientX, startY = e.clientY;
    const startW = drawer.offsetWidth, startH = drawer.offsetHeight;

    document.body.classList.add('lr-resizing');
    drawer.style.transition = 'none';

    function onMove(ev) {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (pos === 'right' && dir === 'w') {
        drawer.style.width = `${Math.max(MIN_W, Math.min(MAX_W(), startW - dx))}px`;
      } else if (pos === 'left' && dir === 'e') {
        drawer.style.width = `${Math.max(MIN_W, Math.min(MAX_W(), startW + dx))}px`;
      } else if (pos === 'center') {
        if (dir === 'ce' || dir === 'cse')
          drawer.style.width  = `${Math.max(MIN_CW, Math.min(window.innerWidth  * 0.96, startW + dx))}px`;
        if (dir === 'cs' || dir === 'cse')
          drawer.style.height = `${Math.max(MIN_CH, Math.min(window.innerHeight * 0.96, startH + dy))}px`;
      }
    }

    function onUp() {
      document.body.classList.remove('lr-resizing');
      drawer.style.transition = '';
      if (pos === 'center') saveCenterSize(drawer.offsetWidth, drawer.offsetHeight);
      else saveWidth(drawer.offsetWidth);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Drawer bouwen ─────────────────────────────────────────────────────────────
  function buildDrawer() {
    if (document.getElementById(DRAWER_ID)) return;

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
          <div style="position:relative">
            <button id="latour-pos-btn" title="Positie wijzigen" aria-label="Positie wijzigen">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </button>
            <div id="latour-pos-menu">
              <button class="latour-pos-option" data-pos="right">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="13" y="3" width="8" height="18" rx="1"/>
                  <line x1="3" y1="12" x2="9" y2="12"/>
                </svg>
                Rechts
              </button>
              <button class="latour-pos-option" data-pos="left">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="8" height="18" rx="1"/>
                  <line x1="15" y1="12" x2="21" y2="12"/>
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

    document.body.appendChild(drawer);

    document.getElementById('latour-review-close').addEventListener('click', closeDrawer);

    const posBtn  = document.getElementById('latour-pos-btn');
    const posMenu = document.getElementById('latour-pos-menu');
    posBtn.addEventListener('click', e => { e.stopPropagation(); posMenu.classList.toggle('lr-menu-open'); });

    document.querySelectorAll('.latour-pos-option').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const pos = btn.dataset.pos;
        savePosition(pos);
        applyPosition(pos);
        posMenu.classList.remove('lr-menu-open');
      });
    });

    document.addEventListener('click', () => posMenu.classList.remove('lr-menu-open'));

    addResizeHandles(drawer);
    applyPosition(getPosition());
  }

  // ── Openen / sluiten ─────────────────────────────────────────────────────────
  function openDrawer(url, ticketId) {
    buildDrawer();
    applyPosition(getPosition());

    const drawer   = document.getElementById(DRAWER_ID);
    const iframe   = document.getElementById('latour-review-iframe');
    const subtitle = document.getElementById('latour-review-subtitle');

    iframe.src = url;
    subtitle.textContent = ticketId ? `Ticket #${ticketId}` : '';
    drawer.classList.add('lr-open');
  }

  function closeDrawer() {
    const drawer = document.getElementById(DRAWER_ID);
    if (!drawer) return;
    drawer.classList.remove('lr-open');
    setTimeout(() => {
      const d = document.getElementById(DRAWER_ID);
      if (d && !d.classList.contains('lr-open')) d.remove();
    }, 300);
  }

  // ── Ingelogde Zendesk-gebruiker ophalen ──────────────────────────────────────
  function getLoggedInAgentId() {
    // Methode 1: window.currentUser (Zendesk zet dit globaal)
    if (window.currentUser && window.currentUser.id) {
      return String(window.currentUser.id);
    }
    // Methode 2: meta-tag
    const meta = document.querySelector('meta[name="current-user-id"]');
    if (meta && meta.content) return meta.content;
    // Methode 3: data-attribuut op body of html
    const bodyId = document.body.dataset.currentUserId || document.documentElement.dataset.currentUserId;
    if (bodyId) return bodyId;
    // Fallback: geen id gevonden
    return '';
  }

  // ── URL: vervang agent_id door ingelogde gebruiker ───────────────────────────
  function injectAgentId(href) {
    try {
      const url = new URL(href);
      const agentId = getLoggedInAgentId();
      if (agentId) url.searchParams.set('agent_id', agentId);
      return url.toString();
    } catch(_) {
      return href;
    }
  }

  // ── Link → knop ──────────────────────────────────────────────────────────────
  function convertLinks() {
    document.querySelectorAll(`a[href*="${REVIEW_HOST}"]`).forEach(a => {
      if (a.dataset.latourConverted) return;
      a.dataset.latourConverted = '1';

      let ticketId = '';
      try {
        const match = new URL(a.href).pathname.match(/\/ticket\/(\d+)/);
        if (match) ticketId = match[1];
      } catch(_) {}

      const btn = document.createElement('button');
      btn.className = 'latour-review-btn';
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        Bekijk concept
      `;
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        // Vervang agent_id in de URL door de ingelogde medewerker
        const url = injectAgentId(a.href);
        openDrawer(url, ticketId);
      });
      a.replaceWith(btn);
    });
  }

  // ── Observer ─────────────────────────────────────────────────────────────────
  function startObserver() {
    convertLinks();
    new MutationObserver(() => convertLinks()).observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  injectStyles();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver);
  else startObserver();
})();
