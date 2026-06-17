/* ═══════════════════════════════════════════════════════════════════
   CE DEPARTMENT ACADEMIC PORTAL — Shared JavaScript (app.js)
   Add this to ALL HTML pages just before </body>:
   <script src="app.js"></script>
═══════════════════════════════════════════════════════════════════ */

'use strict';

// ────────────────────────────────────────────
//  GLOBAL CONFIG
// ────────────────────────────────────────────
const APP = {
  version:    '1.0.0',
  name:       'CE Department Portal',
  scriptUrl:  localStorage.getItem('script_url') || 'https://script.google.com/macros/s/AKfycby-9-KOvUiNF7Xj1yUX5QTm0zgzVGLVK-xfPYBgsW8XfOsHyq1RmYXkmRwz-ZclWXIU_Q/exec',
  telegramBot:'https://t.me/ce_dept_portal_bot',
  inactivityMs: 30 * 60 * 1000,   // 30 minutes
  toastMs:      3200,
  cacheMs:      5 * 60 * 1000,    // 5 minutes API cache
};

// ────────────────────────────────────────────
//  SESSION / AUTH
// ────────────────────────────────────────────
const Session = {
  get role()   { return sessionStorage.getItem('portal_role');  },
  get token()  { return sessionStorage.getItem('portal_token'); },
  get userId() { return sessionStorage.getItem('portal_user');  },
  get name()   { return sessionStorage.getItem('portal_name') || Session.userId; },

  save(role, token, userId, name) {
    sessionStorage.setItem('portal_role',  role);
    sessionStorage.setItem('portal_token', token  || '');
    sessionStorage.setItem('portal_user',  userId || '');
    sessionStorage.setItem('portal_name',  name   || userId || '');
  },

  clear() { sessionStorage.clear(); },

  isLoggedIn() { return !!Session.role; },

  /** Redirect to index if not logged in, or if wrong role */
  guard(requiredRole) {
    if (!Session.isLoggedIn()) {
      window.location.href = 'index.html';
      return false;
    }
    if (requiredRole && Session.role !== requiredRole) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  },
};

// ────────────────────────────────────────────
//  API CLIENT
// ────────────────────────────────────────────
const Api = {
  _cache: new Map(),

  /** Build query string from an object */
  _qs(params) {
    return Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
  },

  /** GET request with optional cache */
  async get(action, params = {}, useCache = false) {
    const qs  = this._qs({ action, token: Session.token, ...params });
    const url = `${APP.scriptUrl}?${qs}`;
    const key = url;

    if (useCache && this._cache.has(key)) {
      const { data, ts } = this._cache.get(key);
      if (Date.now() - ts < APP.cacheMs) return data;
    }

    try {
      const res  = await fetch(url);
      const data = await res.json();
      if (useCache) this._cache.set(key, { data, ts: Date.now() });
      return data;
    } catch (err) {
      console.error('[API GET]', action, err);
      return { success: false, error: 'Connection error.' };
    }
  },

  /** POST request */
  async post(action, body = {}) {
    try {
      const res  = await fetch(APP.scriptUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action, token: Session.token, ...body }),
      });
      return await res.json();
    } catch (err) {
      console.error('[API POST]', action, err);
      return { success: false, error: 'Connection error.' };
    }
  },

  /** Clear all cached responses */
  clearCache() { this._cache.clear(); },

  /** Invalidate a specific key prefix */
  invalidate(prefix) {
    for (const key of this._cache.keys()) {
      if (key.includes(prefix)) this._cache.delete(key);
    }
  },
};

// ────────────────────────────────────────────
//  TOAST NOTIFICATION SYSTEM
// ────────────────────────────────────────────
const Toast = {
  _container: null,

  _getContainer() {
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.className = 'toast-container';
      this._container.style.cssText = `
        position:fixed;bottom:24px;right:24px;z-index:9999;
        display:flex;flex-direction:column;gap:10px;pointer-events:none;
      `;
      document.body.appendChild(this._container);
    }
    return this._container;
  },

  show(message, type = 'info', duration = APP.toastMs) {
    const container = this._getContainer();
    const toast     = document.createElement('div');

    const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    const colors = {
      success: '#10B981', error: '#EF4444',
      warning: '#F59E0B', info:  '#2563EB',
    };

    toast.style.cssText = `
      padding:12px 18px;border-radius:10px;
      background:#1E293B;border:1px solid rgba(255,255,255,0.10);
      border-left:3px solid ${colors[type]||colors.info};
      color:#F1F5F9;font-size:14px;font-weight:500;
      box-shadow:0 8px 24px rgba(0,0,0,0.3);
      pointer-events:all;max-width:340px;
      transform:translateX(110%);opacity:0;
      transition:transform .3s ease,opacity .3s ease;
      font-family:'Inter',sans-serif;
      display:flex;align-items:center;gap:10px;
    `;
    toast.innerHTML = `<span>${icons[type]||''}</span><span>${message}</span>`;
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity   = '1';
      });
    });

    // Animate out
    setTimeout(() => {
      toast.style.transform = 'translateX(110%)';
      toast.style.opacity   = '0';
      setTimeout(() => toast.remove(), 350);
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg)   { this.show(msg, 'error');   },
  warning(msg) { this.show(msg, 'warning'); },
  info(msg)    { this.show(msg, 'info');    },
};

// Backwards-compatible helper used in dashboards
function showToast(msg) {
  const type = msg.startsWith('✅') ? 'success'
    : msg.startsWith('❌') ? 'error'
    : msg.startsWith('⚠')  ? 'warning'
    : 'info';
  Toast.show(msg, type);
}

// ────────────────────────────────────────────
//  THEME MANAGER
// ────────────────────────────────────────────
const Theme = {
  KEY: 'portal_theme',

  get current() {
    return localStorage.getItem(this.KEY) || 'dark';
  },

  apply(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(this.KEY, theme);
    // Update any toggle buttons on the page
    document.querySelectorAll('[data-theme-icon]').forEach(el => {
      el.textContent = theme === 'dark' ? '🌙' : '☀️';
    });
  },

  toggle() {
    const next = this.current === 'dark' ? 'light' : 'dark';
    this.apply(next);
    return next;
  },

  init() {
    this.apply(this.current);
  },
};

// ────────────────────────────────────────────
//  SIDEBAR MANAGER
// ────────────────────────────────────────────
const Sidebar = {
  _sidebar:  null,
  _overlay:  null,
  _main:     null,
  _isMobile: false,

  init() {
    this._sidebar = document.getElementById('sidebar');
    this._overlay = document.getElementById('overlay');
    this._main    = document.getElementById('main');
    this._isMobile = window.innerWidth < 768;

    if (!this._sidebar) return;

    window.addEventListener('resize', this._onResize.bind(this));

    // Close on overlay click
    if (this._overlay) {
      this._overlay.addEventListener('click', () => this.close());
    }

    // Keyboard: Escape closes on mobile
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this._isMobile) this.close();
    });
  },

  toggle() {
    if (window.innerWidth < 768) {
      this._sidebar.classList.toggle('mobile-open');
      if (this._overlay) this._overlay.classList.toggle('show');
    } else {
      this._sidebar.classList.toggle('collapsed');
      if (this._main) this._main.classList.toggle('expanded');
    }
  },

  close() {
    this._sidebar.classList.remove('mobile-open');
    if (this._overlay) this._overlay.classList.remove('show');
  },

  _onResize() {
    const mobile = window.innerWidth < 768;
    if (mobile !== this._isMobile) {
      this._isMobile = mobile;
      // Reset classes when crossing breakpoint
      this._sidebar.classList.remove('mobile-open', 'collapsed');
      if (this._overlay) this._overlay.classList.remove('show');
      if (this._main) this._main.classList.remove('expanded');
    }
  },
};

// Global toggle (called by hamburger button)
function toggleSidebar() { Sidebar.toggle(); }

// ────────────────────────────────────────────
//  PAGE ROUTER (single-page navigation)
// ────────────────────────────────────────────
const Router = {
  _pages:    {},     // id → { el, title, onEnter }
  _current:  null,
  _titleEl:  null,

  register(id, title, onEnter) {
    const el = document.getElementById('page-' + id);
    if (el) this._pages[id] = { el, title, onEnter };
  },

  go(id, navEl) {
    // Deactivate all pages
    Object.values(this._pages).forEach(p => p.el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const page = this._pages[id];
    if (!page) { console.warn('[Router] Unknown page:', id); return; }

    // Activate
    page.el.classList.add('active');
    if (navEl) navEl.classList.add('active');

    // Update topbar title
    if (this._titleEl) this._titleEl.textContent = page.title;

    // Fire onEnter hook
    if (page.onEnter) page.onEnter();

    // Close mobile sidebar
    Sidebar.close();

    this._current = id;

    // Push to browser history for back-button support
    try {
      history.pushState({ page: id }, '', `#${id}`);
    } catch (_) {}
  },

  init(titleElementId) {
    this._titleEl = document.getElementById(titleElementId);

    // Handle browser back/forward
    window.addEventListener('popstate', e => {
      if (e.state && e.state.page) this.go(e.state.page);
    });

    // Handle hash on load
    const hash = location.hash.replace('#', '');
    if (hash && this._pages[hash]) this.go(hash);
  },
};

// Convenience wrapper used in onclick attributes
function showPage(id, navEl) { Router.go(id, navEl); }

// ────────────────────────────────────────────
//  INACTIVITY AUTO-LOGOUT
// ────────────────────────────────────────────
const Inactivity = {
  _timer:  null,
  _warned: false,

  init(ms = APP.inactivityMs) {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => document.addEventListener(e, () => this._reset(ms), { passive: true }));
    this._reset(ms);
  },

  _reset(ms) {
    clearTimeout(this._timer);
    this._warned = false;
    this._timer = setTimeout(() => {
      Toast.warning('⏱ Session expired. Redirecting to login…');
      setTimeout(() => {
        Session.clear();
        window.location.href = 'index.html';
      }, 2500);
    }, ms);
  },
};

// ────────────────────────────────────────────
//  PASSWORD TOGGLE
// ────────────────────────────────────────────
function togglePw(inputId, btn) {
  const inp  = document.getElementById(inputId);
  const show = inp.type === 'password';
  inp.type   = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
}

// ────────────────────────────────────────────
//  MODAL MANAGER
// ────────────────────────────────────────────
const Modal = {
  open(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
  },

  close(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  },

  closeAll() {
    document.querySelectorAll('.modal-overlay.open')
      .forEach(m => m.classList.remove('open'));
  },

  init() {
    // Click outside modal to close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });

    // Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.closeAll();
    });
  },
};

// Shorthand wrappers used in onclick attributes
function openModal(id)  { Modal.open(id);  }
function closeModal(id) { Modal.close(id); }

// ────────────────────────────────────────────
//  ANIMATED COUNTER
// ────────────────────────────────────────────
function animateCounter(el, target, duration = 1400, suffix = '') {
  const start = performance.now();
  const from  = 0;

  function step(now) {
    const elapsed = now - start;
    const progress= Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased   = 1 - Math.pow(1 - progress, 3);
    const value   = Math.round(from + (target - from) * eased);
    el.textContent = value.toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

// ────────────────────────────────────────────
//  SCROLL REVEAL (Intersection Observer)
// ────────────────────────────────────────────
const RevealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');

    // Trigger counters inside revealed elements
    entry.target.querySelectorAll('[data-count]').forEach(el => {
      if (el.dataset.animated) return;
      el.dataset.animated = '1';
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      animateCounter(el, target, 1400, suffix);
    });

    RevealObserver.unobserve(entry.target);
  });
}, { threshold: 0.12 });

function initReveal() {
  document.querySelectorAll('.reveal').forEach(el => RevealObserver.observe(el));
}

// ────────────────────────────────────────────
//  FORM VALIDATION
// ────────────────────────────────────────────
const Validator = {
  /** Returns true if all pass */
  run(rules) {
    let valid = true;
    rules.forEach(({ field, test, msg }) => {
      const el    = typeof field === 'string' ? document.getElementById(field) : field;
      const errEl = el ? document.getElementById(el.id + '-err') : null;
      const value = el ? el.value.trim() : '';
      const ok    = test(value, el);

      if (el) el.style.borderColor = ok ? '' : 'var(--red)';
      if (errEl) { errEl.textContent = ok ? '' : msg; errEl.style.display = ok ? 'none' : 'block'; }
      if (!ok) valid = false;
    });
    return valid;
  },

  required: (v) => v.length > 0,
  email:    (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  minLen:   (n) => (v) => v.length >= n,
  maxLen:   (n) => (v) => v.length <= n,
  numeric:  (v) => /^\d+(\.\d+)?$/.test(v),
  range:    (min, max) => (v) => parseFloat(v) >= min && parseFloat(v) <= max,
  studentId:(v) => /^UGR\/\d+\/\d+$/.test(v),
};

// ────────────────────────────────────────────
//  SKELETON LOADER HELPERS
// ────────────────────────────────────────────
const Skeleton = {
  /** Replace element innerHTML with skeleton rows */
  show(containerId, rows = 3, cols = 4) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = Array.from({ length: rows }, () => `
      <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
        ${Array.from({ length: cols }, (_, i) => `
          <div class="skeleton skeleton-text" style="flex:${i === 0 ? 2 : 1};height:16px;border-radius:6px"></div>
        `).join('')}
      </div>
    `).join('');
  },

  /** Table skeleton */
  table(containerId, rows = 5, cols = 5) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const headerRow = `<tr>${Array.from({length:cols}, () =>
      `<th><div class="skeleton" style="height:12px;width:80%;border-radius:4px"></div></th>`
    ).join('')}</tr>`;
    const bodyRows  = Array.from({length:rows}, () => `<tr>${Array.from({length:cols}, () =>
      `<td><div class="skeleton" style="height:14px;border-radius:4px"></div></td>`
    ).join('')}</tr>`).join('');
    el.innerHTML = `<table class="table"><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>`;
  },

  /** Cards skeleton */
  cards(containerId, count = 4) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = Array.from({length:count}, () => `
      <div class="card" style="padding:20px">
        <div class="skeleton skeleton-text" style="height:12px;width:40%;margin-bottom:10px"></div>
        <div class="skeleton skeleton-text" style="height:20px;width:70%;margin-bottom:14px"></div>
        <div class="skeleton skeleton-text" style="height:12px;width:55%"></div>
      </div>
    `).join('');
  },
};

// ────────────────────────────────────────────
//  GRADE UTILITIES
// ────────────────────────────────────────────
const Grades = {
  /** Ethiopian university grading system */
  fromPercentage(pct) {
    if (pct >= 90) return { letter: 'A',  gp: 4.00, desc: 'Excellent' };
    if (pct >= 85) return { letter: 'A-', gp: 3.75, desc: 'Very Good' };
    if (pct >= 80) return { letter: 'B+', gp: 3.50, desc: 'Good+'     };
    if (pct >= 75) return { letter: 'B',  gp: 3.00, desc: 'Good'      };
    if (pct >= 70) return { letter: 'B-', gp: 2.75, desc: 'Good-'     };
    if (pct >= 65) return { letter: 'C+', gp: 2.50, desc: 'Satisfactory+' };
    if (pct >= 60) return { letter: 'C',  gp: 2.00, desc: 'Satisfactory'  };
    if (pct >= 50) return { letter: 'D',  gp: 1.00, desc: 'Pass'          };
    return                { letter: 'F',  gp: 0.00, desc: 'Fail'          };
  },

  /** CSS class for grade badge colouring */
  badgeClass(letter) {
    if (letter.startsWith('A')) return 'grade-A';
    if (letter.startsWith('B')) return 'grade-B';
    if (letter.startsWith('C')) return 'grade-C';
    if (letter === 'D')         return 'grade-D';
    return 'grade-F';
  },

  /** Weighted total from assessments array and scores array */
  calcTotal(assessments, scores) {
    let total = 0;
    assessments.forEach((a, i) => {
      const score = parseFloat(scores[i]) || 0;
      const max   = parseFloat(a.max)    || 100;
      const wt    = parseFloat(a.weight) || 0;
      total += (score / max) * wt;
    });
    return Math.round(total * 10) / 10;
  },

  /** GPA from array of {gp, credits} */
  calcGPA(courses) {
    let num = 0, den = 0;
    courses.forEach(c => {
      const cr = parseFloat(c.credits) || 0;
      num += (parseFloat(c.gp) || 0) * cr;
      den += cr;
    });
    return den > 0 ? Math.round((num / den) * 100) / 100 : 0;
  },

  /** HTML badge span */
  badge(letter) {
    return `<span class="grade-badge ${this.badgeClass(letter)}">${letter}</span>`;
  },
};

// ────────────────────────────────────────────
//  DATE / TIME HELPERS
// ────────────────────────────────────────────
const DateUtil = {
  timeAgo(isoString) {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)    return 'just now';
    if (mins < 60)   return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)    return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7)    return `${days}d ago`;
    return new Date(isoString).toLocaleDateString('en-GB', { day:'numeric', month:'short' });
  },

  format(isoString, opts = {}) {
    return new Date(isoString).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', ...opts
    });
  },

  isToday(isoString) {
    const d = new Date(isoString);
    const n = new Date();
    return d.getDate() === n.getDate() &&
           d.getMonth() === n.getMonth() &&
           d.getFullYear() === n.getFullYear();
  },
};

// ────────────────────────────────────────────
//  CSV EXPORT HELPER
// ────────────────────────────────────────────
const Csv = {
  download(filename, rows) {
    const content = rows.map(r =>
      r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success(`⬇ ${filename} downloaded.`);
  },

  fromTable(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const rows = [...table.querySelectorAll('tr')].map(tr =>
      [...tr.querySelectorAll('th,td')].map(td => td.innerText.trim())
    );
    this.download(filename || 'export.csv', rows);
  },
};

// ────────────────────────────────────────────
//  DEBOUNCE / THROTTLE
// ────────────────────────────────────────────
function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function throttle(fn, ms = 100) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
  };
}

// ────────────────────────────────────────────
//  SEARCH / FILTER HELPER
// ────────────────────────────────────────────
function filterList(items, query, keys) {
  if (!query) return items;
  const q = query.toLowerCase().trim();
  return items.filter(item =>
    keys.some(key => String(item[key] || '').toLowerCase().includes(q))
  );
}

// Live search binding
function bindSearch(inputId, renderFn, items, keys) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('input', debounce(() => {
    renderFn(filterList(items, input.value, keys));
  }, 250));
}

// ────────────────────────────────────────────
//  NOTIFICATION BADGE UPDATER
// ────────────────────────────────────────────
const NotifBadge = {
  update(count) {
    const badges = document.querySelectorAll('#notif-count, .notif-badge');
    badges.forEach(b => {
      b.textContent = count > 0 ? count : '';
      b.style.display = count > 0 ? 'inline' : 'none';
    });
    const dots = document.querySelectorAll('.notif-dot');
    dots.forEach(d => d.style.display = count > 0 ? 'block' : 'none');
  },

  async refresh() {
    const data = await Api.get('getNotifications', {
      userId: Session.userId,
      role:   Session.role,
    });
    if (data.success) {
      const unread = (data.notifications || []).filter(n => !n.read).length;
      this.update(unread);
    }
  },
};

// ────────────────────────────────────────────
//  TELEGRAM DEEP-LINK
// ────────────────────────────────────────────
function openTelegram() {
  window.open(APP.telegramBot, '_blank');
}

// ────────────────────────────────────────────
//  LOGOUT
// ────────────────────────────────────────────
function logout() {
  Session.clear();
  Api.clearCache();
  window.location.href = 'index.html';
}

// ────────────────────────────────────────────
//  TOGGLE THEME (global helper)
// ────────────────────────────────────────────
function toggleTheme() {
  Theme.toggle();
}

// ────────────────────────────────────────────
//  GPA RING ANIMATION (SVG circle)
// ────────────────────────────────────────────
function animateGpaRing(circleId, gpa, max = 4.0, radius = 58) {
  const circle = document.getElementById(circleId);
  if (!circle) return;
  const circ   = 2 * Math.PI * radius;
  const pct    = Math.min(gpa / max, 1);
  circle.style.strokeDasharray  = circ;
  circle.style.strokeDashoffset = circ; // start hidden

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      circle.style.transition      = 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)';
      circle.style.strokeDashoffset= circ - circ * pct;
    });
  });
}

// ────────────────────────────────────────────
//  BAR CHART RENDERER (pure CSS)
// ────────────────────────────────────────────
function renderBarChart(elementId, data, colorMap = {}) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const defaultColors = {
    'A':'#10B981','A-':'#34D399','B+':'#3B82F6','B':'#60A5FA',
    'B-':'#93C5FD','C+':'#F59E0B','C':'#FCD34D','D':'#FB923C','F':'#EF4444',
  };
  const colors = { ...defaultColors, ...colorMap };
  const values = Object.values(data).map(Number);
  const max    = Math.max(...values, 1);

  el.style.cssText = 'display:flex;align-items:flex-end;gap:8px;height:160px;padding:0 4px';

  el.innerHTML = Object.entries(data).map(([label, count]) => {
    const pct   = Math.round((Number(count) / max) * 100);
    const color = colors[label] || 'var(--blue)';
    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%">
        <div style="font-size:11px;font-weight:600;color:var(--text2)">${count}</div>
        <div style="width:100%;flex:1;background:var(--bg3);border-radius:6px 6px 0 0;display:flex;align-items:flex-end;overflow:hidden">
          <div style="width:100%;border-radius:6px 6px 0 0;background:${color};height:0%;transition:height 1.2s ease" data-target="${pct}"></div>
        </div>
        <div style="font-size:10px;color:var(--text2);white-space:nowrap">${label}</div>
      </div>`;
  }).join('');

  // Animate bars after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.querySelectorAll('[data-target]').forEach(bar => {
        bar.style.height = bar.dataset.target + '%';
      });
    });
  });
}

// ────────────────────────────────────────────
//  DONUT CHART RENDERER (SVG)
// ────────────────────────────────────────────
function renderDonutChart(elementId, { pass, fail, total, radius = 50, stroke = 14 }) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const circ    = 2 * Math.PI * radius;
  const passRt  = total > 0 ? Math.round((pass / total) * 100) : 0;
  const offset  = circ * (1 - passRt / 100);

  el.innerHTML = `
    <div style="position:relative;width:${radius*2+stroke}px;height:${radius*2+stroke}px;flex-shrink:0">
      <svg viewBox="0 0 ${radius*2+stroke} ${radius*2+stroke}"
           width="${radius*2+stroke}" height="${radius*2+stroke}"
           style="position:absolute;inset:0;transform:rotate(-90deg)">
        <circle cx="${radius+stroke/2}" cy="${radius+stroke/2}" r="${radius}"
          fill="none" stroke="var(--bg3)" stroke-width="${stroke}"/>
        <circle cx="${radius+stroke/2}" cy="${radius+stroke/2}" r="${radius}"
          fill="none" stroke="#10B981" stroke-width="${stroke}" stroke-linecap="round"
          stroke-dasharray="${circ}" stroke-dashoffset="${circ}"
          id="donut-arc-${elementId}"
          style="transition:stroke-dashoffset 1.2s ease"/>
      </svg>
      <div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center">
        <div>
          <div style="font-family:'Space Grotesk',sans-serif;font-size:1.3rem;font-weight:700">${passRt}%</div>
          <div style="font-size:11px;color:var(--text2)">Pass</div>
        </div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:center;gap:8px;font-size:13px">
        <div style="width:10px;height:10px;border-radius:50%;background:#10B981"></div>
        Pass · ${pass} students
      </div>
      <div style="display:flex;align-items:center;gap:8px;font-size:13px">
        <div style="width:10px;height:10px;border-radius:50%;background:#EF4444"></div>
        Fail · ${fail} students
      </div>
      <div style="display:flex;align-items:center;gap:8px;font-size:13px">
        <div style="width:10px;height:10px;border-radius:50%;background:var(--bg3)"></div>
        Total · ${total} students
      </div>
    </div>`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const arc = document.getElementById(`donut-arc-${elementId}`);
      if (arc) arc.style.strokeDashoffset = offset;
    });
  });
}

// ────────────────────────────────────────────
//  SERVICE WORKER (PWA caching)
// ────────────────────────────────────────────
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // SW not present — silent fail
      });
    });
  }
}

// ────────────────────────────────────────────
//  PRINT HELPER
// ────────────────────────────────────────────
function printSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head>
      <title>${APP.name}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body{font-family:'Inter',sans-serif;padding:24px;color:#0F172A}
        table{width:100%;border-collapse:collapse}
        th,td{padding:8px 12px;border:1px solid #E2E8F0;text-align:left;font-size:13px}
        th{background:#F8FAFC;font-weight:600}
        h1,h2{font-size:18px;margin-bottom:12px}
      </style>
    </head><body>${section.innerHTML}</body></html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

// ────────────────────────────────────────────
//  GLOBAL KEYBOARD SHORTCUTS
// ────────────────────────────────────────────
function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    // Ctrl/Cmd + K — focus search (if present)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const search = document.querySelector('input[type="search"], input[placeholder*="search" i]');
      if (search) search.focus();
    }
    // Ctrl/Cmd + B — toggle sidebar
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      Sidebar.toggle();
    }
  });
}

// ────────────────────────────────────────────
//  APP BOOTSTRAP — runs on every page load
// ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // 1. Theme
  Theme.init();

  // 2. Sidebar
  Sidebar.init();

  // 3. Modals
  Modal.init();

  // 4. Scroll reveal
  initReveal();

  // 5. Keyboard shortcuts
  initKeyboardShortcuts();

  // 6. Service Worker
  registerServiceWorker();

  // 7. Inactivity timer (only on dashboard pages)
  const isDashboard = document.getElementById('sidebar');
  if (isDashboard && Session.isLoggedIn()) {
    Inactivity.init();
  }

  // 8. Refresh notification badge every 2 minutes
  if (Session.isLoggedIn()) {
    NotifBadge.refresh();
    setInterval(() => NotifBadge.refresh(), 2 * 60 * 1000);
  }

  // 9. Apply saved Script URL from localStorage
  if (APP.scriptUrl !== 'https://script.google.com/macros/s/AKfycby-9-KOvUiNF7Xj1yUX5QTm0zgzVGLVK-xfPYBgsW8XfOsHyq1RmYXkmRwz-ZclWXIU_Q/exec') {
    console.info('[CE Portal] Connected to Apps Script:', APP.scriptUrl.slice(0, 60) + '…');
  } else {
    console.warn('[CE Portal] Running in demo mode. Set script_url in localStorage.');
  }
});

// ────────────────────────────────────────────
//  EXPOSE GLOBALS (used by onclick attributes)
// ────────────────────────────────────────────
window.APP        = APP;
window.Session    = Session;
window.Api        = Api;
window.Toast      = Toast;
window.Theme      = Theme;
window.Sidebar    = Sidebar;
window.Router     = Router;
window.Modal      = Modal;
window.Grades     = Grades;
window.DateUtil   = DateUtil;
window.Csv        = Csv;
window.Skeleton   = Skeleton;
window.NotifBadge = NotifBadge;
window.Validator  = Validator;

window.showToast    = showToast;
window.toggleTheme  = toggleTheme;
window.toggleSidebar= toggleSidebar;
window.showPage     = showPage;
window.openModal    = openModal;
window.closeModal   = closeModal;
window.togglePw     = togglePw;
window.logout       = logout;
window.openTelegram = openTelegram;
window.printSection = printSection;
window.debounce     = debounce;
window.throttle     = throttle;
window.filterList   = filterList;
window.bindSearch   = bindSearch;
window.animateCounter    = animateCounter;
window.animateGpaRing    = animateGpaRing;
window.renderBarChart    = renderBarChart;
window.renderDonutChart  = renderDonutChart;
