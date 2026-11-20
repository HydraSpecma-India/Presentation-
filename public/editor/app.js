/* ===== HydraSpecma Management Report Builder — editor engine =====
   Mounted by the React page (src/components/editor/ReportEditor.tsx) with a store that loads and
   saves the report in Supabase. Plain browser JS so the slide model stays framework-free. */
window.HSEditor = { mount: function (opts) {
  'use strict';
  var C = window.HSCore, ASSETS = window.HS_ASSETS;
  var STORE = opts.store, READONLY = !!opts.readOnly;
  var AC = new AbortController(), SIG = { signal: AC.signal };
  var PX = 72; // px per inch on the 960x540 stage
  var P = null, cur = null, sel = null, view = 'editor';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    }
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(m, ms) { var t = $('#toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toast._t); toast._t = setTimeout(function () { t.style.display = 'none'; }, ms || 2200); }
  function slide() { return P.slides.find(function (s) { return s.id === cur; }) || P.slides[0]; }
  function blockById(s, id) { return (s.blocks || []).find(function (b) { return b.id === id; }); }
  function pageNo(s) { if (!s.include) return null; var n = 0; for (var i = 0; i < P.slides.length; i++) { if (P.slides[i].include) n++; if (P.slides[i] === s) return n; } return null; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function reid(b) { b.id = C.uid(); return b; }

  /* ---------- storage (Supabase via the page's store) ---------- */
  var saveT = null, saving = false, pending = false, conflictOpen = false;
  function setState(t) { var e = $('#saveState'); if (e) e.textContent = t; }
  function save() {
    if (READONLY) { setState('View only – changes are not saved'); return; }
    setState('Unsaved changes…');
    clearTimeout(saveT);
    saveT = setTimeout(flush, 1500);
  }
  function flush(force) {
    if (READONLY || !P) return Promise.resolve();
    if (saving) { pending = true; return Promise.resolve(); }
    saving = true; setState('Saving…');
    return STORE.save(P, force ? { force: true } : undefined).then(function (r) {
      saving = false;
      if (r.ok) setState('Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      else if (r.conflict) { setState('Not saved – someone else changed this report'); showConflict(r); }
      else { setState('Not saved – ' + r.error); toast('Save failed: ' + r.error, 5000); }
      if (pending) { pending = false; flush(); }
    }).catch(function (e) { saving = false; setState('Not saved – ' + e.message); });
  }
  function showConflict(r) {
    if (conflictOpen) return; conflictOpen = true;
    var when = r.at ? new Date(r.at).toLocaleString() : 'just now';
    ask('Someone else saved this report', '<p>' + esc(r.by || 'Another user') + ' saved a newer version (' + esc(when) + ').</p><p class="help">Reload to see their version (your unsaved changes here are lost), or keep yours and overwrite theirs.</p>',
      [['Reload their version', function () { conflictOpen = false; window.location.reload(); }],
       ['Overwrite with mine', function () { conflictOpen = false; flush(true); }, 'red']]);
  }
  window.addEventListener('beforeunload', function (e) { if (saveT && !READONLY && $('#saveState') && /Unsaved|Saving/.test($('#saveState').textContent)) { e.preventDefault(); e.returnValue = ''; } }, SIG);

  /* ---------- change pipeline ---------- */
  var stT = null;
  function slideOf(b) { return P.slides.find(function (s) { return (s.blocks || []).indexOf(b) >= 0; }); }
  function changed(kind, b) {
    save();
    clearTimeout(stT);
    stT = setTimeout(function () {
      if (view === 'editor') renderStage();
      if (kind === 'title' || kind === 'struct') renderSide();
      if (view === 'entry' && kind === 'struct') { if (b) refillCard(slideOf(b)); else renderEntry(); }
    }, 90);
    if (kind === 'struct' && view === 'editor') renderPanel();
  }

  /* =========================================================
     SIDEBAR
     ========================================================= */
  function renderSide() {
    var q = ($('#q').value || '').toLowerCase();
    var list = $('#slist'); list.innerHTML = '';
    var inc = P.slides.filter(function (s) { return s.include; }).length;
    $('#meta').textContent = inc + ' of ' + P.slides.length + ' slides will be exported';
    var secs = C.sectionsFor(P.slides), lastSec = null;
    P.slides.forEach(function (s, i) {
      var name = s.layout === 'cover' ? (s.subtitle || 'Cover') : (s.title || 'Untitled');
      var sec = secs[i].section;
      if (q && name.toLowerCase().indexOf(q) < 0 && sec.toLowerCase().indexOf(q) < 0) return;
      if (sec !== lastSec) {
        lastSec = sec;
        list.appendChild(sectionHeader(sec, secs));
      }
      if (!q && collapsed[sec] && s.id !== cur) return;
      var pg = pageNo(s);
      var cb = el('input', { type: 'checkbox', title: s.include ? 'Included – untick to remove from the export' : 'Excluded – tick to include', onclick: function (e) { e.stopPropagation(); s.include = cb.checked; changed('struct'); } });
      cb.checked = !!s.include;
      var item = el('div', { class: 'si' + (s.id === cur ? ' on' : '') + (s.include ? '' : ' off'), onclick: function () { selectSlide(s.id, true); } }, [
        cb, el('span', { class: 'pg', text: pg == null ? '–' : String(pg) }),
        el('span', { class: 'tt', title: name, text: name }),
        s.layout !== 'content' ? el('span', { class: 'kind', text: s.layout === 'end' ? 'end' : 'cover' }) : null,
        el('span', { class: 'acts' }, [
          el('button', { class: 'ib', title: 'Move up', text: '↑', onclick: function (e) { e.stopPropagation(); move(i, -1); } }),
          el('button', { class: 'ib', title: 'Move down', text: '↓', onclick: function (e) { e.stopPropagation(); move(i, 1); } }),
          el('button', { class: 'ib', title: 'Duplicate', text: '⧉', onclick: function (e) { e.stopPropagation(); dupSlide(i); } }),
          el('button', { class: 'ib del', title: 'Delete slide', text: '✕', onclick: function (e) { e.stopPropagation(); delSlide(i); } })
        ])
      ]);
      list.appendChild(item);
    });
  }
  /* Category headers in the page list: name, included/total count, click to fold. */
  var collapsed = {};
  function sectionHeader(sec, secs) {
    var all = secs.filter(function (x) { return x.section === sec; });
    var on = all.filter(function (x) { return x.slide.include; }).length;
    var allOn = on === all.length;
    var cb = el('input', { type: 'checkbox', title: allOn ? 'Untick to leave this whole category out' : 'Tick to include the whole category', onclick: function (e) {
      e.stopPropagation(); all.forEach(function (x) { x.slide.include = cb.checked; }); changed('struct');
    } });
    cb.checked = allOn; cb.indeterminate = on > 0 && !allOn;
    return el('div', { class: 'sh' + (collapsed[sec] ? ' folded' : ''), title: collapsed[sec] ? 'Show pages' : 'Hide pages', onclick: function () { collapsed[sec] = !collapsed[sec]; renderSide(); } }, [
      cb, el('span', { class: 'arw', text: collapsed[sec] ? '▸' : '▾' }), el('span', { class: 'nm', text: sec }), el('span', { class: 'cnt', text: on + '/' + all.length })
    ]);
  }
  function sectionList() {
    var seen = {}, out = [];
    C.sectionsFor(P.slides).forEach(function (x) { if (!seen[x.section]) { seen[x.section] = true; out.push(x.section); } });
    return out;
  }
  function currentSection() {
    var i = P.slides.findIndex(function (s) { return s.id === cur; });
    var secs = C.sectionsFor(P.slides);
    return i >= 0 ? secs[i].section : (secs.length ? secs[secs.length - 1].section : 'Other');
  }
  function move(i, d) {
    var j = i + d; if (j < 0 || j >= P.slides.length) return;
    var t = P.slides[i]; P.slides[i] = P.slides[j]; P.slides[j] = t; changed('struct');
  }
  function dupSlide(i) {
    var c = clone(P.slides[i]); c.id = C.uid(); (c.blocks || []).forEach(reid);
    P.slides.splice(i + 1, 0, c); cur = c.id; sel = null; changed('struct'); renderAll();
  }
  function delSlide(i) {
    var s = P.slides[i];
    ask('Delete slide?', '<p>Delete <b>' + esc(s.title || s.subtitle) + '</b> permanently?</p><p class="help">Tip: to just leave it out of the PowerPoint, untick its checkbox instead – you can bring it back any time.</p>',
      [['Cancel'], ['Delete', function () {
        P.slides.splice(i, 1);
        if (!P.slides.length) P.slides.push(C.S('blank', 'New slide', []));
        if (cur === s.id) cur = P.slides[Math.min(i, P.slides.length - 1)].id;
        sel = null; changed('struct'); renderAll();
      }, 'red']]);
  }
  function selectSlide(id, scroll) {
    cur = id; sel = null;
    renderSide();
    if (view === 'editor') { renderStage(); renderPanel(); }
    else if (scroll) { var c = document.getElementById('card-' + id); if (c) { c.scrollIntoView({ block: 'start' }); fillVisible(); } }
  }

  /* =========================================================
     STAGE (preview)
     ========================================================= */
  function fitStage() {
    var wrap = $('#stageWrap'), box = $('#stageBox'), st = $('#stage');
    var avail = Math.max(320, wrap.clientWidth - 36), availH = Math.max(200, wrap.clientHeight - 36);
    var sc = Math.min(avail / 960, availH / 540, 1.6);
    st.style.transform = 'scale(' + sc + ')';
    box.style.width = (960 * sc) + 'px'; box.style.height = (540 * sc) + 'px';
    fitStage.sc = sc;
  }
  function slideHTML(s, editing) {
    /* returns a DOM node 960x540 rendering of a slide */
    var root = el('div', { style: 'position:absolute;inset:0' });
    var isCover = s.layout === 'cover' || s.layout === 'end';
    root.appendChild(el('img', { class: 'bg', src: isCover ? ASSETS.bgCover : ASSETS.bgContent, draggable: 'false' }));
    var pg = pageNo(s);
    if (P.settings.pageNumbers !== false && pg != null) root.appendChild(el('div', { class: 'pgno', text: String(pg) }));
    if (s.layout === 'cover') {
      root.appendChild(el('div', { style: 'position:absolute;left:50px;top:166px;font:bold 60px Arial;white-space:nowrap', html: '<span style="color:#fff">Hydra</span><span style="color:#FFCD00">Specma</span>' }));
      root.appendChild(el('div', { style: 'position:absolute;left:54px;top:268px;font:20px Arial;color:#d0d0d0;white-space:nowrap', text: s.subtitle || '' }));
      root.appendChild(el('div', { style: 'position:absolute;left:648px;top:350px;font:18px/26px Arial;color:#d0d0d0;white-space:pre', text: (s.presenter || '') + '\n' + (s.date || '') }));
    } else if (s.layout === 'end') {
      C.endItems(s).forEach(function (it) {
        var st = 'position:absolute;left:' + it.x * PX + 'px;top:' + it.y * PX + 'px;width:' + it.w * PX + 'px;height:' + it.h * PX + 'px;';
        if (it.rect) root.appendChild(el('div', { style: st + 'background:#' + it.fill }));
        else root.appendChild(el('div', { style: st + 'display:flex;flex-direction:column;justify-content:' + (it.valign === 'bottom' ? 'flex-end' : it.valign === 'middle' ? 'center' : 'flex-start') + ';font:' + (it.bold ? 'bold ' : '') + it.size + 'px/1.15 Arial;color:#' + it.color + ';white-space:pre-wrap;overflow:hidden', text: it.t }));
      });
    } else {
      var ty = 0.22;
      if (s.tag) { root.appendChild(el('div', { class: 'sl-tag', style: 'left:' + 0.69 * PX + 'px;top:' + 0.14 * PX + 'px;width:' + 2 * PX + 'px;height:' + 0.26 * PX + 'px;font-size:7px', text: s.tag })); ty = 0.48; }
      root.appendChild(el('div', { class: 'sl-title', style: 'left:' + 0.95 * PX + 'px;top:' + ty * PX + 'px;height:' + 0.65 * PX + 'px;display:flex;align-items:center;font-size:26px', html: esc(s.title) + (s.titleSmall ? '<span style="font-weight:400;font-size:15px">&nbsp;&nbsp;' + esc(s.titleSmall) + '</span>' : '') }));
    }
    (s.blocks || []).forEach(function (b) { root.appendChild(blockNode(b, editing)); });
    return root;
  }
  function blockNode(b, editing) {
    var d = el('div', { class: 'blk' + (editing === true && b.id === sel ? ' sel' : ''), 'data-id': b.id, style: 'left:' + b.x * PX + 'px;top:' + b.y * PX + 'px;width:' + b.w * PX + 'px;height:' + b.h * PX + 'px' });
    if (b.type === 'text') d.appendChild(textPreview(b, editing));
    else if (b.type === 'table') d.appendChild(tablePreview(b));
    else if (b.type === 'chart') d.appendChild(el('div', { style: 'position:absolute;inset:0', html: chartSVG(b, b.w * PX, b.h * PX) }));
    else if (b.type === 'kpi') d.appendChild(kpiPreview(b));
    else if (b.type === 'image') {
      if (b.src) {
        var r = b.fit === 'cover' ? null : C.fitRect(b, { x: 0, y: 0, w: b.w, h: b.h });
        d.appendChild(b.fit === 'cover'
          ? el('img', { src: b.src, draggable: 'false', style: 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover' })
          : el('img', { src: b.src, draggable: 'false', style: 'position:absolute;left:' + r.x * PX + 'px;top:' + r.y * PX + 'px;width:' + r.w * PX + 'px;height:' + r.h * PX + 'px' }));
      } else if (editing !== 'thumb') {
        d.appendChild(el('div', { class: 'ph', html: '<b>' + esc(b.label || 'Image') + '</b>Double-click to upload<br>or select &amp; paste (Ctrl+V)<br><span style="font-size:10px">Empty slots are not exported</span>' }));
      }
    }
    if (editing === true) {
      d.appendChild(el('div', { class: 'tag', text: b.label || b.type }));
      d.appendChild(el('div', { class: 'rz' }));
    }
    return d;
  }
  function kpiPreview(b) {
    var L = C.kpiLayout(b), al = b.align === 'center' ? 'center' : 'left';
    var card = el('div', { style: 'position:absolute;inset:0;background:#' + (b.fill || 'FFFFFF') + ';border:1px solid #d0d0d0;overflow:hidden;font-family:Arial' });
    if (L.acc) card.appendChild(el('div', { style: 'position:absolute;left:0;top:0;bottom:0;width:' + L.acc * PX + 'px;background:#' + b.accent }));
    var put = function (r, st, txt) {
      card.appendChild(el('div', { style: 'position:absolute;left:' + r.x * PX + 'px;top:' + r.y * PX + 'px;width:' + r.w * PX + 'px;height:' + r.h * PX + 'px;text-align:' + al + ';' + st, text: txt }));
    };
    var dark = b.fill && b.fill !== 'FFFFFF' && /^[0-3]/.test(b.fill);
    if (String(b.title || '').trim()) put(L.title, 'font-size:7.5px;line-height:' + L.title.h * PX + 'px;color:#' + (dark ? 'D9D9D9' : '595959') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis', b.title);
    if (String(b.value || '').trim()) put(L.value, 'font-size:' + (+b.size || 16) + 'px;font-weight:700;color:#' + L.valueColor + ';display:flex;align-items:center;' + (al === 'center' ? 'justify-content:center;' : '') + 'white-space:pre-line;line-height:1.05', b.value);
    if (L.badge) put(L.badge, 'font-size:7px;font-weight:700;background:#' + C.YEL + ';border-radius:6px;text-align:center;line-height:' + L.badge.h * PX + 'px', L.badge.text);
    if (String(b.sub || '').trim()) put(L.sub, 'font-size:7px;line-height:1.2;color:#595959;white-space:pre-line;overflow:hidden', b.sub);
    return card;
  }
  function textPreview(b, editing) {
    var fs = +b.size || 10;
    var box = el('div', { class: 'txt', style: 'position:absolute;inset:0;padding:3px;font-size:' + fs + 'px' });
    var ps = C.parseText(b.text), any = false;
    ps.forEach(function (p) {
      var empty = p.k !== 'p' && p.k !== 'h' && !p.t.trim();
      if (empty && editing !== true) return;
      var st = 'margin-top:' + (p.k === 'h' ? 5 : 2) + 'px;';
      if (p.k === 'b' || p.k === 'dot' || p.k === 'chk') st += 'padding-left:' + fs * 1.5 + 'px;';
      if (p.k === 'b2') st += 'padding-left:' + fs * 3 + 'px;';
      if (p.k === 'b2') st += '--x:0';
      var e = el('p', { class: p.k + (empty ? ' empty' : ''), style: st + (p.color ? 'color:#' + p.color + ';' : '') + (p.big ? 'font-size:' + (fs + 2) + 'px;' : '') });
      if (empty) e.textContent = 'type here…';
      else C.boldSegments(p.t || ' ').forEach(function (sg) { e.appendChild(sg.b ? el('b', { text: sg.t }) : document.createTextNode(sg.t)); });
      if (p.k === 'b2') e.style.setProperty('--ind', fs * 1.5 + 'px');
      box.appendChild(e); any = true;
    });
    if (!any && editing !== 'thumb') box.appendChild(el('p', { class: 'empty', text: 'Empty text box' }));
    // position level-2 bullet marker
    $$('.b2', box).forEach(function (p) { p.style.setProperty('position', 'relative'); });
    return box;
  }
  function tablePreview(b) {
    var fs = +b.size || 8;
    var wrap = el('div', { style: 'position:absolute;inset:0;font-size:' + fs + 'px' });
    var hh = b.h * PX;
    if (b.caption) { wrap.appendChild(el('div', { class: 'cap', style: 'font-size:' + Math.max(8, fs + 1) + 'px;height:' + (0.26 * PX) + 'px;display:flex;align-items:center', text: b.caption })); hh -= 0.28 * PX; }
    var cw = C.colWidths(b), nc = cw.length;
    var t = el('table', { class: 'pt' });
    var cg = el('colgroup'); cw.forEach(function (f) { cg.appendChild(el('col', { style: 'width:' + (f * 100) + '%' })); }); t.appendChild(cg);
    var rhs = C.rowHeights(b, hh / PX);
    b.rows.forEach(function (r, ri) {
      var tr = el('tr', { class: ri < b.header ? 'hd' : (b.totalRow && ri === b.rows.length - 1 ? 'tot' : ''), style: 'height:' + rhs[ri] * PX + 'px' });
      var dot = null;
      for (var c = 0; c < nc; c++) {
        var cf = C.cellFill(r[c]), v = cf.text;
        var st = cf.fill ? 'background:#' + cf.fill + ';' : '';
        if (ri >= b.header) {
          if ((b.rowBold && b.rowBold[ri]) || (b.firstColBold && c === 0)) st += 'font-weight:700;';
          if (c > 0 && C.isNumLike(v)) st += 'text-align:right;';
          if (c === b.statusCol) { var sx = C.normStatus(v); if (sx && +b.statusSize > 0) { v = ''; var dd = Math.min(+b.statusSize, rhs[ri] * PX * 0.9); st += 'text-align:center;'; var dot = el('span', { style: 'display:inline-block;vertical-align:middle;border-radius:50%;width:' + dd + 'px;height:' + dd + 'px;background:#' + C.STATUS[sx] }); }
          else if (sx) { v = '●'; st += 'text-align:center;color:#' + C.STATUS[sx] + ';font-size:' + Math.max(fs * 2.6, 16) + 'px;line-height:1;'; } }
        } else if (c > 0) st += 'text-align:center;';
        var tdp = el('td', { style: st, text: v }); if (dot) { tdp.appendChild(dot); dot = null; } tr.appendChild(tdp);
      }
      t.appendChild(tr);
    });
    wrap.appendChild(t);
    return wrap;
  }

  /* ---------- chart preview (SVG) ---------- */
  function chartSVG(b, W, H) {
    var svg = chartSVGBody(b, W, H), g = C.stampGeometry(b, { x: 0, y: 0, w: W / PX, h: H / PX });
    if (!g) return svg;
    var cx = (g.x + g.d / 2) * PX, cy = (g.y + g.d / 2) * PX, r = g.d / 2 * PX, col = '#' + C.STAMP_COLOR, note = b.stampNote ? String(b.stampNote) : '';
    var st = '<g transform="rotate(-12 ' + cx + ' ' + cy + ')"><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="rgba(255,255,255,.85)" stroke="' + col + '" stroke-width="3"/>' +
      '<text x="' + cx + '" y="' + (cy + (note ? 0 : r * 0.35)) + '" text-anchor="middle" fill="' + col + '" style="font-size:' + Math.round(r * 0.95) + 'px;font-weight:700">' + esc(String(b.stamp).trim()) + '</text>' +
      (note ? '<text x="' + cx + '" y="' + (cy + r * 0.45) + '" text-anchor="middle" fill="' + col + '" style="font-size:' + Math.max(6, Math.round(r * 0.2)) + 'px;font-weight:700">' + esc(note) + '</text>' : '') + '</g>';
    return svg.replace(/<\/svg>$/, st + '</svg>');
  }
  function chartSVGBody(b, W, H) {
    var f = C.chartFormat(b);
    var o = [];
    var top = b.title ? 16 : 4, bot = 14 + (b.legend ? 13 : 0), left = 4, right = 4;
    var cats = b.cats.map(String);
    var ser = b.series.map(function (s) { return { s: s, v: s.values.map(C.parseNum) }; });
    o.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="font-family:Arial;font-size:7px">');
    if (b.title) o.push('<text x="' + W / 2 + '" y="11" text-anchor="middle" style="font-size:10px">' + esc(b.title) + '</text>');
    var anyVal = ser.some(function (x) { return x.v.some(function (v) { return v != null; }); });
    if (!anyVal) o.push('<text x="' + W / 2 + '" y="' + (H / 2 + 3) + '" text-anchor="middle" fill="#b0b5bd" style="font-size:9px">No data yet – enter values in the panel</text>');
    var ag = anyVal ? C.arrowGeometry(b, { x: 0, y: 0, w: W / PX, h: H / PX }) : null;
    if (ag) {
      /* same geometry as the PowerPoint export (inches → px) */
      var k = PX, p0 = ag.plot, sl0 = p0.w / cats.length, bw = sl0 / (1 + C.ARROW_GAP / 100), af = C.chartFormat(b, [ser[0].s]);
      ser[0].v.forEach(function (v, i) {
        var cxp = (p0.x + sl0 * (i + 0.5)) * k;
        if (v != null) {
          var yTop = ag.yOf(Math.max(0, v)) * k, yy = yTop, hh = Math.abs(ag.yOf(v) - ag.zeroY) * k;
          o.push('<rect x="' + (cxp - bw * k / 2) + '" y="' + yy + '" width="' + bw * k + '" height="' + hh + '" fill="#' + ser[0].s.color + '"/>');
          if (b.labels) o.push('<text x="' + cxp + '" y="' + (yy + hh / 2 + 3) + '" text-anchor="middle" style="font-size:9px" fill="#404040">' + esc(C.fmtVal(v, af)) + '</text>');
        }
        o.push('<text x="' + cxp + '" y="' + ((p0.y + p0.h) * k + 10) + '" text-anchor="middle" fill="#404040">' + esc(cats[i]) + '</text>');
      });
      o.push('<defs><marker id="ah' + b.id + '" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#595959"/></marker></defs>');
      ag.pairs.forEach(function (a) {
        o.push('<polyline points="' + a.x1 * k + ',' + a.top1 * k + ' ' + a.x1 * k + ',' + a.level * k + ' ' + a.x2 * k + ',' + a.level * k + ' ' + a.x2 * k + ',' + a.top2 * k + '" fill="none" stroke="#595959" stroke-width="1.2" marker-end="url(#ah' + b.id + ')"/>');
        o.push('<ellipse cx="' + a.mid * k + '" cy="' + a.level * k + '" rx="' + a.ow / 2 * k + '" ry="' + 0.13 * k + '" fill="#fff" stroke="#595959"/>');
        o.push('<text x="' + a.mid * k + '" y="' + (a.level * k + 3.5) + '" text-anchor="middle" style="font-size:9px;font-weight:700" fill="#404040">' + esc(a.label) + '</text>');
      });
      return o.join('') + '</svg>';
    }
    if (b.chartType === 'pie' || b.chartType === 'doughnut') {
      var s0 = ser[0]; if (!s0) return o.join('') + '</svg>';
      var tot = s0.v.reduce(function (a, v) { return a + (v > 0 ? v : 0); }, 0);
      var lgd = !!b.legend, cx = lgd ? W * 0.32 : W / 2, cy = top + (H - top - 4) / 2, R = Math.max(5, Math.min(W * (lgd ? 0.22 : 0.28), (H - top - 8) / 2 - 6)), r0 = b.chartType === 'doughnut' ? R * 0.55 : 0;
      if (lgd) {
        var lh = Math.min(12, (H - top - 6) / Math.max(1, cats.length)), ly0 = cy - lh * cats.length / 2, lx0 = W * 0.6;
        var pfl = C.chartFormat(b, [s0.s]);
        cats.forEach(function (c, i) {
          var yy = ly0 + i * lh;
          o.push('<rect x="' + lx0 + '" y="' + (yy + 1) + '" width="7" height="7" fill="#' + C.PALETTE[i % C.PALETTE.length] + '"/>');
          var lv = s0.v[i] != null && !isNaN(s0.v[i]) ? ', ' + C.fmtVal(s0.v[i], pfl) + (tot > 0 ? ' (' + C.pctLabel(s0.v[i], tot) + ')' : '') : '';
          o.push('<text x="' + (lx0 + 10) + '" y="' + (yy + 7.5) + '">' + esc(c + lv) + '</text>');
        });
      }
      var a = -Math.PI / 2, pf = C.chartFormat(b, [s0.s]);
      if (tot > 0) s0.v.forEach(function (v, i) {
        if (!(v > 0)) return;
        var da = v / tot * Math.PI * 2, a2 = a + da, col = '#' + C.PALETTE[i % C.PALETTE.length];
        var lg = da > Math.PI ? 1 : 0;
        var p = 'M' + (cx + R * Math.cos(a)) + ',' + (cy + R * Math.sin(a)) + 'A' + R + ',' + R + ' 0 ' + lg + ' 1 ' + (cx + R * Math.cos(a2)) + ',' + (cy + R * Math.sin(a2));
        if (r0) p += 'L' + (cx + r0 * Math.cos(a2)) + ',' + (cy + r0 * Math.sin(a2)) + 'A' + r0 + ',' + r0 + ' 0 ' + lg + ' 0 ' + (cx + r0 * Math.cos(a)) + ',' + (cy + r0 * Math.sin(a)) + 'Z';
        else p += 'L' + cx + ',' + cy + 'Z';
        o.push('<path d="' + p + '" fill="' + col + '" stroke="#fff" stroke-width="0.8"/>');
        if (b.labels) {
          var am = a + da / 2, lx = cx + (R + 8) * Math.cos(am), ly = cy + (R + 8) * Math.sin(am);
          var lt = lgd ? Math.round(v / tot * 100) + '%' : cats[i] + ', ' + C.fmtVal(v, pf) + ', ' + Math.round(v / tot * 100) + '%';
          o.push('<text x="' + lx + '" y="' + ly + '" text-anchor="' + (Math.cos(am) >= 0 ? 'start' : 'end') + '">' + esc(lt) + '</text>');
        }
        a = a2;
      });
      return o.join('') + '</svg>';
    }
    var isLineChart = b.chartType === 'line';
    var bars = isLineChart ? [] : ser.filter(function (x) { return b.chartType === 'bar' || x.s.kind !== 'line'; });
    var lines = isLineChart ? ser : (b.chartType === 'combo' ? ser.filter(function (x) { return x.s.kind === 'line'; }) : []);
    var prim = lines.filter(function (x) { return !(b.chartType === 'combo' && x.s.axis === 'secondary'); });
    var secL = lines.filter(function (x) { return b.chartType === 'combo' && x.s.axis === 'secondary'; });
    var n = cats.length || 1;
    function range(list, stacked) {
      var mn = 0, mx = 0;
      for (var i = 0; i < n; i++) {
        if (stacked) { var p = 0, q = 0; list.forEach(function (x) { var v = x.v[i] || 0; if (v >= 0) p += v; else q += v; }); mx = Math.max(mx, p); mn = Math.min(mn, q); }
        else list.forEach(function (x) { var v = x.v[i]; if (v != null) { mx = Math.max(mx, v); mn = Math.min(mn, v); } });
      }
      if (mx === mn) mx = mn + 1;
      return [mn, mx];
    }
    var rb = range(bars, b.stacked), rl = range(prim, false);
    var r1 = [Math.min(bars.length ? rb[0] : 0, prim.length ? rl[0] : 0), Math.max(bars.length ? rb[1] : 0, prim.length ? rl[1] : 0)];
    if (r1[1] === r1[0]) r1[1] = 1;
    var r2 = range(secL, false);
    if (secL.length) right = 22;
    var pw = W - left - right, ph = H - top - bot - 8;
    var horiz = b.horizontal && !isLineChart;
    if (horiz) left = Math.min(W * 0.3, 6 + 4 * cats.reduce(function (m, c) { return Math.max(m, c.length); }, 0)), pw = W - left - 18;
    var pad = (r1[1] - r1[0]) * 0.12;
    var lo = r1[0] < 0 ? r1[0] - pad : 0, hi = r1[1] + pad;
    function Y(v) { return top + 8 + ph - (v - lo) / (hi - lo) * ph; }
    function X(v) { return left + (v - lo) / (hi - lo) * pw; }
    var lo2 = Math.min(0, r2[0]), hi2 = r2[1] + (r2[1] - lo2) * 0.15;
    function Y2(v) { return top + 8 + ph - (v - lo2) / (hi2 - lo2) * ph; }
    var band = (horiz ? ph : pw) / n;
    // axis line
    if (horiz) o.push('<line x1="' + X(0) + '" y1="' + (top + 6) + '" x2="' + X(0) + '" y2="' + (top + 8 + ph) + '" stroke="#bbb" stroke-width="0.6"/>');
    else o.push('<line x1="' + left + '" y1="' + Y(0) + '" x2="' + (left + pw) + '" y2="' + Y(0) + '" stroke="#bbb" stroke-width="0.6"/>');
    var fb = C.chartFormat(b, bars.length ? bars.map(function (x) { return x.s; }) : undefined);
    for (var i = 0; i < n; i++) {
      var c0 = (horiz ? top + 8 : left) + band * i;
      // category label
      if (horiz) o.push('<text x="' + (left - 3) + '" y="' + (c0 + band / 2 + 2.5) + '" text-anchor="end" fill="#404040">' + esc(cats[i]) + '</text>');
      else {
        var maxc = Math.max(2, Math.floor(band / 3.6));
        o.push('<text x="' + (c0 + band / 2) + '" y="' + (top + 8 + ph + 9) + '" text-anchor="middle" fill="#404040">' + esc(cats[i].length > maxc ? cats[i].slice(0, maxc) : cats[i]) + '</text>');
      }
      if (bars.length) {
        var gw = band * 0.62, bw = b.stacked ? gw : gw / bars.length, pos = 0, neg = 0;
        bars.forEach(function (x, j) {
          var v = x.v[i]; if (v == null) return;
          var col = '#' + (x.s.color || C.PALETTE[j % C.PALETTE.length]);
          var a0, a1;
          if (b.stacked) { if (v >= 0) { a0 = pos; a1 = pos + v; pos = a1; } else { a0 = neg; a1 = neg + v; neg = a1; } }
          else { a0 = 0; a1 = v; }
          var off = c0 + (band - gw) / 2 + (b.stacked ? 0 : bw * j);
          var lab = b.labels ? esc(C.fmtVal(v, fb)) : '';
          if (horiz) {
            var xa = X(Math.min(a0, a1)), xw = Math.abs(X(a1) - X(a0));
            o.push('<rect x="' + xa + '" y="' + off + '" width="' + xw + '" height="' + Math.max(0.5, bw) + '" fill="' + col + '"/>');
            if (lab) o.push('<text x="' + (b.stacked ? xa + xw / 2 : X(a1) + 2) + '" y="' + (off + bw / 2 + 2.5) + '" text-anchor="' + (b.stacked ? 'middle' : 'start') + '">' + lab + '</text>');
          } else {
            var ya = Y(Math.max(a0, a1)), yh = Math.abs(Y(a1) - Y(a0));
            o.push('<rect x="' + off + '" y="' + ya + '" width="' + Math.max(0.5, bw) + '" height="' + yh + '" fill="' + col + '"/>');
            if (lab) o.push('<text x="' + (off + bw / 2) + '" y="' + (b.stacked ? ya + yh / 2 + 2.5 : (v >= 0 ? ya - 2 : ya + yh + 7)) + '" text-anchor="middle">' + lab + '</text>');
          }
        });
        if (b.totals && b.stacked && !horiz && bars.length > 1 && pos > 0) {
          o.push('<text x="' + (c0 + band / 2) + '" y="' + (Y(pos) - 2.5) + '" text-anchor="middle" style="font-weight:700">' + esc(C.fmtVal(Math.round(pos * 100) / 100, fb)) + '</text>');
        }
      }
    }
    lines.forEach(function (x, j) {
      var sec = secL.indexOf(x) >= 0, col = '#' + (x.s.color || C.PALETTE[j % C.PALETTE.length]);
      var lf = C.chartFormat(b, [x.s]);
      var pts = [];
      x.v.forEach(function (v, i) { if (v == null) return; pts.push([left + band * i + band / 2, sec ? Y2(v) : Y(v), v]); });
      if (pts.length > 1) o.push('<polyline fill="none" stroke="' + col + '" stroke-width="1.6" points="' + pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '"/>');
      pts.forEach(function (p) {
        o.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2" fill="' + col + '"/>');
        if (b.labels && !x.s.noLabels) o.push('<text x="' + p[0] + '" y="' + (p[1] - 4) + '" text-anchor="middle">' + esc(C.fmtVal(p[2], lf)) + '</text>');
      });
    });
    if (secL.length) {
      var sf = C.chartFormat(b, secL.map(function (x) { return x.s; }));
      [0, 0.5, 1].forEach(function (t) { var v = lo2 + (hi2 - lo2) * t; o.push('<text x="' + (W - 2) + '" y="' + (Y2(v) + 2) + '" text-anchor="end" fill="#666">' + esc(C.fmtVal(v, sf)) + '</text>'); });
    }
    if (b.legend) {
      var lx = W / 2 - b.series.length * 30, ly = H - 4;
      b.series.forEach(function (s, j) {
        var col = '#' + (s.color || C.PALETTE[j % C.PALETTE.length]);
        o.push('<rect x="' + lx + '" y="' + (ly - 6) + '" width="7" height="6" fill="' + col + '"/><text x="' + (lx + 9) + '" y="' + ly + '">' + esc(s.name) + '</text>');
        lx += 14 + Math.max(20, (s.name || '').length * 3.8);
      });
    }
    return o.join('') + '</svg>';
  }

  function renderStage() {
    var s = slide(); var st = $('#stage'); st.innerHTML = '';
    st.appendChild(slideHTML(s, true));
    fitStage();
  }

  /* drag / resize on the stage */
  (function () {
    var drag = null;
    document.addEventListener('mousedown', function (e) {
      var blk = e.target.closest && e.target.closest('#stage .blk');
      if (!blk) { if (e.target.closest && e.target.closest('#stage')) { sel = null; renderStage(); renderPanel(); } return; }
      var s = slide(), b = blockById(s, blk.getAttribute('data-id')); if (!b) return;
      if (e.detail >= 2 && b.type === 'image') { pickImage(b); e.preventDefault(); return; }
      if (sel !== b.id) { sel = b.id; renderStage(); renderPanel(); blk = $('#stage .blk[data-id="' + b.id + '"]'); }
      drag = { b: b, mode: e.target.classList.contains('rz') ? 'rz' : 'mv', x: e.clientX, y: e.clientY, ox: b.x, oy: b.y, ow: b.w, oh: b.h, node: blk, moved: false };
      e.preventDefault();
    }, SIG);
    document.addEventListener('mousemove', function (e) {
      if (!drag) return;
      var sc = fitStage.sc || 1, dx = (e.clientX - drag.x) / sc / PX, dy = (e.clientY - drag.y) / sc / PX;
      if (Math.abs(dx) + Math.abs(dy) > 0.01) drag.moved = true;
      var snap = function (v) { return Math.round(v * 20) / 20; }, b = drag.b;
      if (drag.mode === 'mv') { b.x = snap(Math.min(C.W - 0.2, Math.max(-0.5, drag.ox + dx))); b.y = snap(Math.min(C.H - 0.2, Math.max(-0.3, drag.oy + dy))); }
      else { b.w = snap(Math.max(0.3, drag.ow + dx)); b.h = snap(Math.max(0.2, drag.oh + dy)); }
      var n = drag.node; n.style.left = b.x * PX + 'px'; n.style.top = b.y * PX + 'px'; n.style.width = b.w * PX + 'px'; n.style.height = b.h * PX + 'px';
      if (drag.mode === 'rz' && (b.type === 'chart')) { n.querySelector('div').innerHTML = chartSVG(b, b.w * PX, b.h * PX); }
    }, SIG);
    document.addEventListener('mouseup', function () {
      if (!drag) return;
      var d = drag; drag = null;
      if (d.moved) { save(); renderStage(); syncPos(d.b); }
    }, SIG);
    document.addEventListener('keydown', function (e) {
      if (view !== 'editor' || !sel) return;
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      var s = slide(), b = blockById(s, sel); if (!b) return;
      var st = e.shiftKey ? 0.25 : 0.05, k = e.key;
      if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); removeBlock(s, b); return; }
      var mv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[k];
      if (mv) { e.preventDefault(); b.x = +(b.x + mv[0]).toFixed(2); b.y = +(b.y + mv[1]).toFixed(2); renderStage(); syncPos(b); save(); }
    }, SIG);
  })();

  /* =========================================================
     IMAGES
     ========================================================= */
  var imgTarget = null;
  function pickImage(b) { imgTarget = b; $('#fileImg').value = ''; $('#fileImg').click(); }
  $('#fileImg').addEventListener('change', function () { var f = this.files[0]; if (f && imgTarget) loadImageFile(f, imgTarget); });
  function loadImageFile(file, b) {
    if (!/^image\//.test(file.type)) { toast('That is not an image file'); return; }
    var fr = new FileReader();
    fr.onload = function () { setImage(b, fr.result, file.type); };
    fr.readAsDataURL(file);
  }
  function setImage(b, dataUrl, type) {
    var im = new Image();
    im.onload = function () {
      var w = im.naturalWidth, h = im.naturalHeight, MAX = 2200, src = dataUrl;
      if (Math.max(w, h) > MAX || dataUrl.length > 2.5e6) {
        var k = Math.min(1, MAX / Math.max(w, h)); var cv = document.createElement('canvas');
        cv.width = Math.round(w * k); cv.height = Math.round(h * k);
        var cx = cv.getContext('2d');
        var png = /png|gif|svg/.test(type || '');
        if (!png) { cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); }
        cx.drawImage(im, 0, 0, cv.width, cv.height);
        src = png ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.9);
        if (png && src.length > 3e6) src = cv.toDataURL('image/jpeg', 0.9);
        w = cv.width; h = cv.height;
      }
      if (/svg/.test(type || '')) { var cv2 = document.createElement('canvas'); cv2.width = w; cv2.height = h; cv2.getContext('2d').drawImage(im, 0, 0, w, h); src = cv2.toDataURL('image/png'); }
      b.src = src; b.iw = w; b.ih = h; b.img = null;
      changed('struct', b);
      toast('Image placed in “' + (b.label || 'image') + '”');
    };
    im.onerror = function () { toast('Could not read that image'); };
    im.src = dataUrl;
  }
  function imageFromClipboard(e) {
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) if (items[i].type.indexOf('image') === 0) return items[i].getAsFile();
    return null;
  }
  document.addEventListener('paste', function (e) {
    if (view !== 'editor' || !sel) return;
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA/.test(tag)) return;
    var b = blockById(slide(), sel); if (!b || b.type !== 'image') return;
    var f = imageFromClipboard(e); if (f) { e.preventDefault(); loadImageFile(f, b); }
  }, SIG);

  /* =========================================================
     PANEL (right side, editor view)
     ========================================================= */
  function fld(label, input) { return el('div', { class: 'fld' }, [el('label', { text: label }), input]); }
  function tInput(obj, key, kind, ph) {
    var i = el('input', { type: 'text', value: obj[key] == null ? '' : obj[key], placeholder: ph || '' });
    i.addEventListener('input', function () { obj[key] = i.value; changed(kind); });
    return i;
  }
  function renderPanel() {
    var pn = $('#panel'); pn.innerHTML = '';
    var s = slide(); if (!s) return;
    var pg = pageNo(s);
    var sec1 = el('div', { class: 'sec' }, [el('h3', { html: 'Slide ' + (pg == null ? '<span style="color:#c00">(excluded)</span>' : 'page ' + pg) })]);
    var inc = el('input', { type: 'checkbox' }); inc.checked = s.include;
    inc.addEventListener('change', function () { s.include = inc.checked; changed('struct'); });
    sec1.appendChild(el('label', { class: 'chk', style: 'margin-bottom:8px' }, [inc, 'Include this slide in the PowerPoint']));
    slideFields(s).forEach(function (n) { sec1.appendChild(n); });
    if (s.tpl && s.tpl !== 'blank') sec1.appendChild(el('button', { class: 'btn sm', text: 'Reset slide to template', title: 'Restore the original layout and empty fields for this page', onclick: function () { resetSlide(s); } }));
    pn.appendChild(sec1);
    if (s.layout === 'content') {
      var sec2 = el('div', { class: 'sec' }, [el('h3', { text: 'Boxes on this slide' })]);
      var bl = el('div', { class: 'bl' });
      (s.blocks || []).forEach(function (b, i) {
        bl.appendChild(el('div', { class: 'bli' + (b.id === sel ? ' on' : ''), onclick: function () { sel = b.id; renderStage(); renderPanel(); } }, [
          el('span', { class: 'ty ' + b.type, text: b.type }), el('span', { class: 'nm', text: b.label || b.type }),
          el('button', { class: 'ib', title: 'Send backward', text: '↑', onclick: function (e) { e.stopPropagation(); if (i > 0) { s.blocks.splice(i - 1, 0, s.blocks.splice(i, 1)[0]); changed('struct'); } } }),
          el('button', { class: 'ib', title: 'Bring forward', text: '↓', onclick: function (e) { e.stopPropagation(); if (i < s.blocks.length - 1) { s.blocks.splice(i + 1, 0, s.blocks.splice(i, 1)[0]); changed('struct'); } } })
        ]));
      });
      if (!(s.blocks || []).length) bl.appendChild(el('div', { class: 'help', text: 'No boxes yet – use the “Add to this slide” buttons below the preview.' }));
      sec2.appendChild(bl);
      pn.appendChild(sec2);
    }
    var b = sel && blockById(s, sel);
    if (b) {
      var sec3 = el('div', { class: 'sec' }, [el('h3', {}, [el('span', { class: 'ty ' + b.type, style: 'color:#fff;border-radius:4px;padding:1px 6px;font-size:10px', text: b.type }), document.createTextNode(' Selected box')])]);
      sec3.appendChild(fld('Box name (shown only in this app)', tInput(b, 'label', 'struct-lite')));
      sec3.appendChild(posEditor(b));
      sec3.appendChild(el('div', { style: 'height:6px' }));
      sec3.appendChild(blockEditor(b));
      sec3.appendChild(el('div', { class: 'row', style: 'margin-top:10px' }, [
        el('button', { class: 'btn sm', text: 'Duplicate box', onclick: function () { var c = reid(clone(b)); c.x += 0.2; c.y += 0.2; s.blocks.push(c); sel = c.id; changed('struct'); } }),
        el('button', { class: 'btn sm red', text: 'Delete box', onclick: function () { removeBlock(s, b); } })
      ]));
      pn.appendChild(sec3);
    } else if (s.layout === 'content') {
      pn.appendChild(el('div', { class: 'sec help', html: 'Select a box on the slide (or in the list above) to edit its text, table, chart data or image.<br><br>Prefer filling everything page by page? Switch to <b>Page-wise entry</b> at the top.' }));
    }
  }
  function categoryField(s) {
    var id = 'secs-' + s.id;
    var i = el('input', { type: 'text', value: C.sectionOf(s, ''), list: id, placeholder: 'e.g. Sales' });
    i.addEventListener('input', function () { s.section = i.value; changed('title'); });
    var dl = el('datalist', { id: id }, sectionList().map(function (x) { return el('option', { value: x }); }));
    return el('div', { class: 'fld' }, [el('label', { text: 'Category (PowerPoint section)' }), i, dl]);
  }
  function slideFields(s, compact) {
    var out = [categoryField(s)];
    if (s.layout === 'cover') {
      out.push(fld('Subtitle', tInput(s, 'subtitle', 'title')));
      out.push(el('div', { class: 'row' }, [fld('Presenter', tInput(s, 'presenter', 'x')), fld('Date', tInput(s, 'date', 'x'))]));
    } else if (s.layout === 'end') {
      if (!compact) out.push(fld('Closing text', tInput(s, 'title', 'title')));
      out.push(fld('Subtitle (yellow)', tInput(s, 'subtitle', 'title', 'e.g. Questions & discussion')));
      var hl = el('textarea', { class: 'ta', rows: 4, placeholder: 'Up to 4 lines, each "value | label", e.g. ▲ 51% | Sales growth 2026 vs 2025' });
      hl.value = s.highlights || '';
      hl.addEventListener('input', function () { s.highlights = hl.value; changed('title'); });
      out.push(fld('Key highlights', hl));
      out.push(el('div', { class: 'row' }, [fld('Presenter', tInput(s, 'presenter', 'title')), fld('Date', tInput(s, 'date', 'title'))]));
    } else {
      if (!compact) out.push(fld('Slide header', tInput(s, 'title', 'title')));
      out.push(el('div', { class: 'row' }, [fld('Header suffix (small text)', tInput(s, 'titleSmall', 'x', 'optional')), fld('Yellow section tag', tInput(s, 'tag', 'x', 'optional'))]));
    }
    return out;
  }
  function removeBlock(s, b) {
    var i = s.blocks.indexOf(b); if (i < 0) return;
    s.blocks.splice(i, 1); sel = null; changed('struct'); renderStage();
    toast('Box removed');
  }
  function resetSlide(s) {
    var t = C.TEMPLATE().find(function (x) { return x.tpl === s.tpl; });
    if (!t) return;
    ask('Reset this slide?', '<p>This puts <b>' + esc(s.title || s.subtitle) + '</b> back to the original template layout and clears what you entered on it.</p>', [['Cancel'], ['Reset slide', function () {
      var i = P.slides.indexOf(s); t.id = s.id; t.include = s.include; P.slides[i] = t; sel = null; changed('struct'); renderAll();
    }, 'red']]);
  }

  var PRESETS = {
    'Full content area': [0.5, 1.0, 12.4, 5.9], 'Left half': [0.5, 1.0, 6.1, 5.9], 'Right half': [6.8, 1.0, 6.1, 5.9],
    'Left two-thirds': [0.5, 1.0, 8.1, 5.9], 'Right third': [8.8, 1.0, 4.1, 5.9],
    'Top left': [0.5, 1.0, 6.1, 2.9], 'Top right': [6.8, 1.0, 6.1, 2.9], 'Bottom left': [0.5, 4.0, 6.1, 2.9], 'Bottom right': [6.8, 4.0, 6.1, 2.9],
    'Top full width': [0.5, 1.0, 12.4, 2.9], 'Bottom full width': [0.5, 4.0, 12.4, 2.9], 'Centre': [3.65, 1.75, 6.0, 4.0]
  };
  function presetSelect(b, after) {
    var s = el('select', { class: 'inp' }, [el('option', { value: '', text: 'Place at…' })].concat(Object.keys(PRESETS).map(function (k) { return el('option', { value: k, text: k }); })));
    s.addEventListener('change', function () { var p = PRESETS[s.value]; if (!p) return; b.x = p[0]; b.y = p[1]; b.w = p[2]; b.h = p[3]; s.value = ''; syncPos(b); changed('pos'); if (after) after(); });
    return s;
  }
  function posEditor(b) {
    var wrap = el('div', { 'data-pos': b.id });
    var g = el('div', { class: 'pos' });
    ['x', 'y', 'w', 'h'].forEach(function (k) {
      var i = el('input', { type: 'number', step: '0.05', value: (+b[k]).toFixed(2), 'data-k': k });
      i.addEventListener('input', function () { var v = parseFloat(i.value); if (!isNaN(v)) { b[k] = v; changed('pos'); } });
      g.appendChild(el('div', { class: 'fld' }, [el('label', { text: { x: 'Left (in)', y: 'Top (in)', w: 'Width', h: 'Height' }[k] }), i]));
    });
    wrap.appendChild(el('div', { class: 'lab', style: 'margin-bottom:3px', text: 'Location on slide (inches, slide is 13.33 × 7.5)' }));
    wrap.appendChild(g);
    wrap.appendChild(el('div', { style: 'margin-top:6px' }, [presetSelect(b)]));
    return wrap;
  }
  function syncPos(b) {
    $$('[data-pos="' + b.id + '"] input[data-k]').forEach(function (i) { i.value = (+b[i.getAttribute('data-k')]).toFixed(2); });
  }
  function blockEditor(b) {
    if (b.type === 'text') return edText(b);
    if (b.type === 'table') return edTable(b);
    if (b.type === 'chart') return edChart(b);
    if (b.type === 'kpi') return edKpi(b);
    return edImage(b);
  }

  /* ---------- text editor ---------- */
  function edText(b) {
    var w = el('div');
    var ta = el('textarea', { class: 'ta', rows: Math.min(18, Math.max(5, String(b.text || '').split('\n').length + 1)), spellcheck: 'true' });
    ta.value = b.text || '';
    ta.addEventListener('input', function () { b.text = ta.value; changed('text'); });
    var size = el('input', { type: 'number', step: '0.5', min: '5', max: '40', value: b.size || 10, style: 'width:70px' });
    size.addEventListener('input', function () { var v = parseFloat(size.value); if (v > 0) { b.size = v; changed('text'); } });
    var ins = function (pfx) {
      return el('button', { class: 'mini', style: 'border:1px solid #e3e5e8', text: pfx.label, title: pfx.tip, onclick: function () {
        var st = ta.selectionStart, v = ta.value, ls = v.lastIndexOf('\n', st - 1) + 1;
        var line = v.slice(ls).split('\n')[0];
        var stripped = line.replace(/^(#g |#r |# |-- |- |v |\* )/, '');
        ta.value = v.slice(0, ls) + pfx.p + stripped + v.slice(ls + line.length);
        b.text = ta.value; changed('text'); ta.focus();
        var pos = ls + pfx.p.length + stripped.length; ta.setSelectionRange(pos, pos);
      } });
    };
    w.appendChild(el('div', { class: 'row', style: 'justify-content:flex-start;gap:4px;margin-bottom:5px;flex-wrap:wrap' }, [
      el('span', { class: 'lab', style: 'flex:none', text: 'Line style:' }),
      ins({ label: 'Heading', p: '# ', tip: 'Bold heading e.g. Achieved' }), ins({ label: '▪ Bullet', p: '- ', tip: 'Yellow square bullet' }), ins({ label: '▪▪ Sub', p: '-- ', tip: 'Indented bullet' }),
      ins({ label: '✓ Check', p: 'v ', tip: 'Tick bullet' }), ins({ label: '• Dot', p: '* ', tip: 'Round bullet' }), ins({ label: 'Green hd', p: '#g ', tip: 'Green heading (Upsides)' }), ins({ label: 'Red hd', p: '#r ', tip: 'Red heading (Downsides)' }), ins({ label: 'Plain', p: '', tip: 'Normal text' })
    ]));
    w.appendChild(ta);
    w.appendChild(el('div', { class: 'row', style: 'margin-top:6px;justify-content:flex-start' }, [el('span', { class: 'lab', style: 'flex:none', text: 'Font size (pt)' }), size, el('span')]));
    w.appendChild(el('div', { class: 'help', html: 'Start a line with <code>#</code> heading · <code>-</code> bullet · <code>--</code> sub-bullet · <code>v</code> tick · <code>*</code> dot · <code>#g</code>/<code>#r</code> green/red heading. Empty bullets are left out of the PowerPoint.' }));
    return w;
  }

  /* ---------- grid paste helper (Excel → cells) ---------- */
  function spreadPaste(e, startR, startC, apply) {
    var t = (e.clipboardData || window.clipboardData).getData('text');
    if (!t || (t.indexOf('\t') < 0 && t.indexOf('\n') < 0)) return false;
    e.preventDefault();
    apply(parseTsv(t), startR, startC);
    return true;
  }
  /* Excel-style TSV: cells containing tabs/newlines/quotes arrive wrapped in "..." with "" escapes */
  function parseTsv(t) {
    t = String(t || '').replace(/\r\n?/g, '\n');
    var rows = [], row = [], cell = '', i = 0, q = false;
    while (i < t.length) {
      var ch = t[i];
      if (q) {
        if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i += 2; continue; } q = false; i++; continue; }
        cell += ch; i++; continue;
      }
      if (ch === '"' && cell === '') { q = true; i++; continue; }
      if (ch === '\t') { row.push(cell); cell = ''; i++; continue; }
      if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
      cell += ch; i++;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function toTsv(rows) {
    return rows.map(function (r) {
      return r.map(function (v) { v = v == null ? '' : String(v); return /[\t\n"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join('\t');
    }).join('\n');
  }
  function copyText(text) {
    function fallback() {
      var ta = el('textarea', { style: 'position:fixed;left:-9999px;top:0' }); ta.value = text; document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove(); return ok;
    }
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(function () { return true; }, fallback);
    return Promise.resolve(fallback());
  }

  /* ---------- table editor ---------- */
  function edTable(b) {
    var w = el('div');
    var nc = function () { return b.rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0); };
    function norm() { var n = nc(); b.rows.forEach(function (r) { while (r.length < n) r.push(''); }); b.rowBold = b.rowBold || []; while (b.rowBold.length < b.rows.length) b.rowBold.push(false); b.rowBold.length = b.rows.length; }
    norm();
    var grid = el('div', { class: 'gridWrap' });
    function draw() {
      norm(); grid.innerHTML = '';
      var t = el('table', { class: 'g' }), n = nc();
      var ct = el('tr', { class: 'ct' }, [el('td', { class: 'tool' })]);
      for (var c = 0; c < n; c++) (function (c) {
        ct.appendChild(el('td', {}, [
          el('button', { class: 'mini', title: 'Insert column left', text: '+', onclick: function () { b.rows.forEach(function (r) { r.splice(c, 0, ''); }); fixStatus(c, 1); draw(); changed('table'); } }),
          el('button', { class: 'mini', title: 'Delete column', text: '✕', onclick: function () { if (n < 2) return; b.rows.forEach(function (r) { r.splice(c, 1); }); fixStatus(c, -1); draw(); changed('table'); } })
        ]));
      })(c);
      ct.appendChild(el('td', {}, [el('button', { class: 'mini', title: 'Add column at end', text: '+ col', onclick: function () { b.rows.forEach(function (r) { r.push(''); }); draw(); changed('table'); } })]));
      t.appendChild(ct);
      b.rows.forEach(function (r, ri) {
        var tr = el('tr', { class: (ri < b.header ? 'h' : '') + (b.rowBold[ri] ? ' bold' : '') });
        tr.appendChild(el('td', { class: 'tool' }, [
          el('button', { class: 'mini' + (b.rowBold[ri] ? ' on' : ''), title: 'Bold row', text: 'B', onclick: function () { b.rowBold[ri] = !b.rowBold[ri]; draw(); changed('table'); } }),
          el('button', { class: 'mini', title: 'Insert row below', text: '+', onclick: function () { b.rows.splice(ri + 1, 0, C.blanks(n)); b.rowBold.splice(ri + 1, 0, false); draw(); changed('table'); } }),
          el('button', { class: 'mini', title: 'Delete row', text: '✕', onclick: function () { if (b.rows.length < 2) return; b.rows.splice(ri, 1); b.rowBold.splice(ri, 1); if (ri < b.header) b.header--; draw(); changed('table'); } })
        ]));
        for (var c = 0; c < n; c++) (function (c) {
          var st = (ri >= b.header && c === b.statusCol) ? C.normStatus(r[c]) : '';
          var td = el('td', { class: (c === 0 ? 'c0' : '') + (st ? ' st-' + st : '') });
          var cv = r[c] == null ? '' : String(r[c]);
          /* cells with line breaks get a small textarea so the breaks survive editing */
          var i = cv.indexOf('\n') >= 0
            ? el('textarea', { rows: String(Math.min(5, cv.split('\n').length)), style: 'width:100%;min-width:220px;font:inherit;resize:vertical;border:1px solid #e3e5e8;padding:2px 4px' })
            : el('input', { type: 'text', value: cv, placeholder: ri >= b.header && c === b.statusCol ? 'G / Y / R' : '' });
          if (i.tagName === 'TEXTAREA') i.value = cv;
          i.addEventListener('input', function () { r[c] = i.value; if (c === b.statusCol) { td.className = (c === 0 ? 'c0' : '') + (C.normStatus(i.value) ? ' st-' + C.normStatus(i.value) : ''); } changed('table'); });
          i.addEventListener('paste', function (e) {
            spreadPaste(e, ri, c, function (rows, r0, c0) {
              rows.forEach(function (pr, k) {
                var R = r0 + k; while (b.rows.length <= R) { b.rows.push(C.blanks(nc())); b.rowBold.push(false); }
                pr.forEach(function (v, j) { var Cc = c0 + j; while (b.rows[R].length <= Cc) b.rows.forEach(function (x) { x.push(''); }); b.rows[R][Cc] = v; });
              });
              draw(); changed('table'); toast('Pasted ' + rows.length + ' row(s)');
            });
          });
          td.appendChild(i); tr.appendChild(td);
        })(c);
        t.appendChild(tr);
      });
      grid.appendChild(t);
    }
    function fixStatus(c, d) { if (b.statusCol >= 0) { if (d < 0 && b.statusCol === c) b.statusCol = -1; else if (b.statusCol >= c) b.statusCol += d; } }
    draw();
    var hdr = el('input', { type: 'number', min: '0', max: '5', value: b.header, style: 'width:56px' });
    hdr.addEventListener('input', function () { var v = parseInt(hdr.value, 10); if (v >= 0) { b.header = v; draw(); changed('table'); } });
    var fs = el('input', { type: 'number', step: '0.5', min: '4', max: '24', value: b.size, style: 'width:60px' });
    fs.addEventListener('input', function () { var v = parseFloat(fs.value); if (v > 0) { b.size = v; changed('table'); } });
    var ss = el('input', { type: 'number', step: '2', min: '0', max: '72', value: b.statusSize || '', placeholder: 'auto', title: 'Status dot size in pt (empty = automatic)', style: 'width:60px' });
    ss.addEventListener('input', function () { var v = parseFloat(ss.value); b.statusSize = v > 0 ? v : 0; changed('table'); });
    var fc = el('input', { type: 'checkbox' }); fc.checked = !!b.firstColBold; fc.addEventListener('change', function () { b.firstColBold = fc.checked; changed('table'); });
    var tr = el('input', { type: 'checkbox' }); tr.checked = !!b.totalRow; tr.addEventListener('change', function () { b.totalRow = tr.checked; changed('table'); });
    var sc = el('select', { class: 'inp', style: 'width:auto' }, [el('option', { value: '-1', text: 'none' })]);
    for (var c = 0; c < nc(); c++) sc.appendChild(el('option', { value: String(c), text: 'Col ' + (c + 1) + (b.rows[0] && b.rows[b.header - 1 >= 0 ? b.header - 1 : 0][c] ? ' – ' + b.rows[b.header - 1 >= 0 ? b.header - 1 : 0][c] : '') }));
    sc.value = String(b.statusCol == null ? -1 : b.statusCol);
    sc.addEventListener('change', function () { b.statusCol = parseInt(sc.value, 10); draw(); changed('table'); });
    w.appendChild(fld('Caption above table (optional)', tInput(b, 'caption', 'table')));
    w.appendChild(el('div', { class: 'row', style: 'flex-wrap:wrap;justify-content:flex-start;gap:12px;margin-bottom:8px' }, [
      el('label', { class: 'chk', style: 'flex:none' }, ['Header rows', hdr]), el('label', { class: 'chk', style: 'flex:none' }, ['Font', fs]),
      el('label', { class: 'chk', style: 'flex:none' }, [fc, 'Bold 1st column']), el('label', { class: 'chk', style: 'flex:none' }, [tr, 'Last row = total']),
      el('label', { class: 'chk', style: 'flex:none' }, ['Status column (●)', sc]),
      el('label', { class: 'chk', style: 'flex:none' }, ['Dot size', ss])
    ]));
    w.appendChild(grid);
    w.appendChild(el('div', { class: 'row', style: 'margin-top:6px;justify-content:flex-start;flex-wrap:wrap;gap:6px' }, [
      el('button', { class: 'btn sm', text: '+ Row', onclick: function () { b.rows.push(C.blanks(nc())); draw(); changed('table'); } }),
      el('button', { class: 'btn sm', text: 'Copy table', title: 'Copy the whole table (with headers) – paste it into Excel', onclick: function () {
        copyText(toTsv(b.rows)).then(function (ok) { toast(ok ? 'Table copied – paste it into Excel' : 'Copy blocked by the browser'); });
      } }),
      el('button', { class: 'btn sm', text: 'Paste table', title: 'Replace the table rows with data copied from Excel', onclick: function () { pasteTableDialog(); } }),
      el('button', { class: 'btn sm', text: 'Clear numbers', title: 'Empty all cells except header rows and the first column', onclick: function () { b.rows.forEach(function (r, ri) { if (ri >= b.header) for (var c = 1; c < r.length; c++) r[c] = ''; }); draw(); changed('table'); } }),
      fldInline('Column widths', tInput(b, 'colW', 'table', 'auto, e.g. 3,1,1,1'))
    ]));
    function pasteTableDialog() {
      var box = el('div');
      var ta = el('textarea', { class: 'inp', rows: '10', style: 'width:100%;font-family:monospace;font-size:12px;white-space:pre', placeholder: 'Copy the rows in Excel (Ctrl+C) and paste here (Ctrl+V)' });
      var keep = el('input', { type: 'checkbox' }); keep.checked = true;
      box.appendChild(el('div', { class: 'help', style: 'margin-bottom:8px', html: 'Pasted rows replace the rows below the ' + b.header + ' header row(s). If the pasted block starts with the same header rows, they are skipped.' }));
      box.appendChild(ta);
      box.appendChild(el('label', { class: 'chk', style: 'margin-top:8px' }, [keep, 'Keep text already typed where the pasted cell is empty (e.g. your comments)']));
      ask('Paste table', box, [
        ['Cancel'],
        ['Replace rows', function () {
          var rows = parseTsv(ta.value).filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); });
          if (!rows.length) { toast('Nothing to paste'); return false; }
          var same = function (a, h) { return a.map(function (v) { return String(v).trim(); }).join('\t').replace(/\t+$/, '') === h.map(function (v) { return String(v == null ? '' : v).trim(); }).join('\t').replace(/\t+$/, ''); };
          var hi = 0; while (hi < b.header && rows.length && same(rows[0], b.rows[hi])) { rows.shift(); hi++; }
          var old = b.rows.slice(b.header), n = Math.max(nc(), rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0));
          var body = rows.map(function (r, k) {
            var out = []; for (var c = 0; c < n; c++) {
              var v = r[c] == null ? '' : String(r[c]);
              if (keep.checked && v.trim() === '' && old[k] && old[k][c]) v = old[k][c];
              out.push(v);
            }
            return out;
          });
          b.rows = b.rows.slice(0, b.header).concat(body);
          b.rowBold = (b.rowBold || []).slice(0, b.rows.length);
          draw(); changed('table'); toast('Pasted ' + body.length + ' row(s)');
        }, 'y']
      ]);
      setTimeout(function () { ta.focus(); }, 30);
    }
    w.appendChild(el('div', { class: 'help', html: 'Tip: copy a range in Excel and paste into any cell – it fills across and down (rows/columns are added as needed). Or use <b>Paste table</b> to replace all rows at once, and <b>Copy table</b> to take it back to Excel. Start a cell with <code>#g </code>, <code>#y </code> or <code>#r </code> to fill it green, yellow or red (e.g. <code>#g Localized</code>). Status column: type <code>G</code>, <code>Y</code> or <code>R</code> for a green/yellow/red dot.' }));
    return w;
  }
  function fldInline(label, input) { input.style.width = '150px'; return el('label', { class: 'chk', style: 'flex:none' }, [label, input]); }

  /* ---------- KPI card editor ---------- */
  function edKpi(b) {
    var w = el('div');
    var sub = el('textarea', { class: 'ta', rows: 3, placeholder: 'Small text under the value (Enter for a new line)' });
    sub.value = b.sub || '';
    sub.addEventListener('input', function () { b.sub = sub.value; changed('kpi'); });
    var tone = el('select', { class: 'inp' }, [['', 'Black'], ['g', 'Green (good)'], ['r', 'Red (attention)'], ['y', 'Amber']].map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
    tone.value = b.tone || '';
    tone.addEventListener('change', function () { b.tone = tone.value; changed('kpi'); });
    var al = el('select', { class: 'inp' }, [['left', 'Left'], ['center', 'Centre']].map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
    al.value = b.align || 'left';
    al.addEventListener('change', function () { b.align = al.value; changed('kpi'); });
    var size = el('input', { type: 'number', step: '1', min: '7', max: '40', value: b.size || 16, style: 'width:70px' });
    size.addEventListener('input', function () { var v = parseFloat(size.value); if (v > 0) { b.size = v; changed('kpi'); } });
    var hex = function (key, ph) {
      var i = el('input', { type: 'text', value: b[key] || '', placeholder: ph, style: 'width:90px' });
      i.addEventListener('input', function () { var v = i.value.replace('#', '').trim(); if (!v || /^[0-9a-fA-F]{6}$/.test(v)) { b[key] = v.toUpperCase(); changed('kpi'); } });
      return i;
    };
    w.appendChild(el('div', { class: 'row' }, [fld('Label', tInput(b, 'title', 'kpi', 'e.g. Current inventory')), fld('Value', tInput(b, 'value', 'kpi', 'e.g. ₹ 232.15 M'))]));
    w.appendChild(el('div', { class: 'row' }, [fld('Badge (optional)', tInput(b, 'badge', 'kpi', 'e.g. 54.6%')), fld('Value colour', tone)]));
    w.appendChild(fld('Sub text', sub));
    w.appendChild(el('div', { class: 'row', style: 'justify-content:flex-start;gap:12px;flex-wrap:wrap' }, [
      fldInline('Value size (pt)', size), fldInline('Align', al), fldInline('Accent bar (hex, empty = none)', hex('accent', 'FFCD00')), fldInline('Card fill (hex)', hex('fill', 'FFFFFF'))]));
    return w;
  }

  /* ---------- chart editor ---------- */
  function edChart(b) {
    var w = el('div');
    var ty = el('select', { class: 'inp' }, [['bar', 'Bar / column'], ['line', 'Line'], ['combo', 'Combo (bars + line)'], ['pie', 'Pie'], ['doughnut', 'Doughnut']].map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
    ty.value = b.chartType;
    ty.addEventListener('change', function () { b.chartType = ty.value; if (b.chartType === 'combo' && !b.series.some(function (s) { return s.kind === 'line'; }) && b.series.length > 1) b.series[b.series.length - 1].kind = 'line'; changed('struct', b); });
    var cb = function (key, label) { var i = el('input', { type: 'checkbox' }); i.checked = !!b[key]; i.addEventListener('change', function () { b[key] = i.checked; changed('chart'); }); return el('label', { class: 'chk', style: 'flex:none' }, [i, label]); };
    w.appendChild(el('div', { class: 'row' }, [fld('Chart title', tInput(b, 'title', 'chart')), fld('Chart type', ty)]));
    var opts = [cb('labels', 'Data labels'), cb('legend', 'Legend')];
    if (b.chartType === 'bar' || b.chartType === 'combo') opts.push(cb('stacked', 'Stacked'));
    if (b.chartType === 'bar' || b.chartType === 'combo') { var tc = cb('totals', 'Show totals'); tc.title = 'Stacked charts: show the total above each column'; opts.push(tc); }
    if (b.chartType === 'bar') opts.push(cb('horizontal', 'Horizontal'));
    if (b.chartType === 'bar' && b.series.length === 1) {
      var ac = cb('arrows', 'Variance arrows (1→2, 3→4)');
      ac.title = 'Draws an arrow with the % change from bar 1 to bar 2, bar 3 to bar 4 …';
      opts.push(ac);
    }
    w.appendChild(el('div', { class: 'row', style: 'justify-content:flex-start;gap:12px;margin-bottom:8px;flex-wrap:wrap' }, opts));
    w.appendChild(el('div', { class: 'row', style: 'justify-content:flex-start;gap:12px;margin-bottom:8px;flex-wrap:wrap', title: 'Optional green stamp over the chart, e.g. 0 + injuries Jan–Oct' }, [
      fldInline('Stamp', tInput(b, 'stamp', 'chart', 'e.g. 0')), fldInline('Stamp note', tInput(b, 'stampNote', 'chart', 'e.g. injuries Jan–Oct'))]));
    var grid = el('div', { class: 'gridWrap' });
    function draw() {
      grid.innerHTML = '';
      var t = el('table', { class: 'g' });
      var hr = el('tr', { class: 'h' }, [el('td', { class: 'c0' }, [el('input', { value: 'Series ↓  /  Category →', disabled: true })])]);
      b.cats.forEach(function (c, ci) {
        var i = el('input', { value: c });
        i.addEventListener('input', function () { b.cats[ci] = i.value; changed('chart'); });
        i.addEventListener('paste', function (e) { pasteChart(e, 0, ci + 1); });
        hr.appendChild(el('td', {}, [i]));
      });
      t.appendChild(hr);
      var pie = b.chartType === 'pie' || b.chartType === 'doughnut';
      b.series.forEach(function (s, si) {
        if (pie && si > 0) return;
        var tr = el('tr');
        var ni = el('input', { value: s.name }); ni.addEventListener('input', function () { s.name = ni.value; changed('chart'); });
        ni.addEventListener('paste', function (e) { pasteChart(e, si + 1, 0); });
        tr.appendChild(el('td', { class: 'c0' }, [ni]));
        b.cats.forEach(function (c, ci) {
          var i = el('input', { value: s.values[ci] == null ? '' : s.values[ci], inputmode: 'decimal' });
          i.addEventListener('input', function () { s.values[ci] = i.value; changed('chart'); });
          i.addEventListener('paste', function (e) { pasteChart(e, si + 1, ci + 1); });
          tr.appendChild(el('td', {}, [i]));
        });
        t.appendChild(tr);
      });
      grid.appendChild(t);
    }
    function pasteChart(e, r0, c0) {
      spreadPaste(e, r0, c0, function (rows) {
        rows.forEach(function (pr, k) {
          var R = r0 + k;
          pr.forEach(function (v, j) {
            var Cc = c0 + j;
            if (Cc > b.cats.length) { while (b.cats.length < Cc) { b.cats.push(''); b.series.forEach(function (s) { s.values.push(''); }); } }
            if (R === 0) { if (Cc > 0) b.cats[Cc - 1] = v; return; }
            while (b.series.length < R) b.series.push({ name: 'Series ' + (b.series.length + 1), values: C.blanks(b.cats.length), kind: 'bar', axis: 'primary', color: C.PALETTE[b.series.length % C.PALETTE.length] });
            var s = b.series[R - 1];
            while (s.values.length < b.cats.length) s.values.push('');
            if (Cc === 0) s.name = v; else s.values[Cc - 1] = v;
          });
        });
        draw(); drawSeries(); changed('chart'); toast('Pasted ' + rows.length + ' row(s)');
      });
    }
    draw();
    w.appendChild(grid);
    w.appendChild(el('div', { class: 'row', style: 'margin-top:6px;justify-content:flex-start;gap:6px;flex-wrap:wrap' }, [
      el('button', { class: 'btn sm', text: '+ Category', onclick: function () { b.cats.push(''); b.series.forEach(function (s) { s.values.push(''); }); draw(); changed('chart'); } }),
      el('button', { class: 'btn sm', text: '− Last category', onclick: function () { if (b.cats.length < 2) return; b.cats.pop(); b.series.forEach(function (s) { s.values.pop(); }); draw(); changed('chart'); } }),
      (b.chartType === 'pie' || b.chartType === 'doughnut') ? null : el('button', { class: 'btn sm', text: '+ Series', onclick: function () { b.series.push({ name: 'Series ' + (b.series.length + 1), values: C.blanks(b.cats.length), kind: b.chartType === 'combo' ? 'line' : 'bar', axis: 'primary', color: C.PALETTE[b.series.length % C.PALETTE.length] }); draw(); drawSeries(); changed('chart'); } }),
      el('button', { class: 'btn sm', text: 'Clear values', onclick: function () { b.series.forEach(function (s) { s.values = C.blanks(b.cats.length); }); draw(); changed('chart'); } })
    ]));
    var sw = el('div', { style: 'margin-top:8px' });
    function drawSeries() {
      sw.innerHTML = '';
      if (b.chartType === 'pie' || b.chartType === 'doughnut') { sw.appendChild(el('div', { class: 'help', text: 'Pie/doughnut uses the first series. Slice colours follow the HydraSpecma palette.' })); return; }
      sw.appendChild(el('div', { class: 'lab', text: 'Series settings' }));
      b.series.forEach(function (s, si) {
        var col = el('input', { type: 'color', value: '#' + (s.color || 'FFCD00') });
        col.addEventListener('input', function () { s.color = col.value.replace('#', '').toUpperCase(); changed('chart'); });
        var kind = el('select', { class: 'inp' }, [el('option', { value: 'bar', text: 'Bars' }), el('option', { value: 'line', text: 'Line' })]);
        kind.value = s.kind || 'bar'; kind.disabled = b.chartType !== 'combo';
        kind.addEventListener('change', function () { s.kind = kind.value; changed('chart'); drawSeries(); });
        var ax = el('input', { type: 'checkbox' }); ax.checked = s.axis === 'secondary'; ax.disabled = b.chartType !== 'combo';
        ax.addEventListener('change', function () { s.axis = ax.checked ? 'secondary' : 'primary'; changed('chart'); });
        var lb = el('input', { type: 'checkbox' }); lb.checked = !s.noLabels; lb.disabled = !(b.chartType === 'combo' && s.kind === 'line');
        lb.addEventListener('change', function () { if (lb.checked) delete s.noLabels; else s.noLabels = true; changed('chart'); });
        sw.appendChild(el('div', { class: 'ser' }, [el('span', { text: s.name || ('Series ' + (si + 1)), style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }), col, kind,
          el('label', { class: 'chk', title: 'Right-hand axis (combo only), e.g. for % lines' }, [ax, '2nd axis']),
          el('label', { class: 'chk', title: 'Show the value labels of this line (combo charts) – untick for a target line' }, [lb, 'Values']),
          el('button', { class: 'ib del', text: '✕', title: 'Remove series', onclick: function () { if (b.series.length < 2) return; b.series.splice(si, 1); draw(); drawSeries(); changed('chart'); } })]));
      });
    }
    drawSeries();
    w.appendChild(sw);
    w.appendChild(el('div', { class: 'help', html: 'Values: type numbers like <code>1,234</code>, <code>-41.8</code> or percentages like <code>97%</code>. Paste a block from Excel into any cell (first row = categories, first column = series names). Charts are exported as real, editable PowerPoint charts.' }));
    return w;
  }

  /* ---------- image editor ---------- */
  function edImage(b, onAfter) {
    var w = el('div');
    var drop = el('div', { class: 'drop', tabindex: '0', title: 'Click, then paste (Ctrl+V) a screenshot – or drop an image file here' });
    function drawDrop() {
      drop.innerHTML = '';
      if (b.src) drop.appendChild(el('img', { src: b.src }));
      else drop.appendChild(el('div', { html: '<b>No image yet</b><br>Click here and press Ctrl+V to paste a screenshot,<br>drop an image file, or use “Choose image”.' }));
    }
    drawDrop();
    drop.addEventListener('paste', function (e) { var f = imageFromClipboard(e); if (f) { e.preventDefault(); e.stopPropagation(); loadImageFile(f, b); } else toast('Clipboard has no image'); });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); var f = e.dataTransfer.files[0]; if (f) loadImageFile(f, b); });
    drop._redraw = drawDrop; drop.setAttribute('data-img', b.id);
    w.appendChild(drop);
    var fit = el('select', { class: 'inp', style: 'width:auto' }, [el('option', { value: 'contain', text: 'Fit inside box' }), el('option', { value: 'cover', text: 'Fill box (crop)' }), el('option', { value: 'stretch', text: 'Stretch to box' })]);
    fit.value = b.fit || 'contain';
    fit.addEventListener('change', function () { b.fit = fit.value; changed('image'); });
    w.appendChild(el('div', { class: 'row', style: 'margin-top:8px;justify-content:flex-start;gap:6px;flex-wrap:wrap' }, [
      el('button', { class: 'btn sm y', text: b.src ? 'Replace image' : 'Choose image', onclick: function () { pickImage(b); } }),
      b.src ? el('button', { class: 'btn sm red', text: 'Remove image', onclick: function () { b.src = null; b.img = null; b.iw = b.ih = 0; changed('struct', b); } }) : null,
      fit
    ]));
    return w;
  }

  /* add a block */
  function addBlock(type) {
    var s = slide();
    if (s.layout !== 'content') { toast('Cover slides have fixed fields – add boxes on content slides'); return; }
    var b;
    if (type === 'text') b = C.T('Text box', 0.6, 1.2, 6, 3, '# Heading\n- ', 10);
    if (type === 'table') b = C.TB('Table', 0.6, 1.2, 8, 3, [['Column 1', 'Column 2', 'Column 3', 'Column 4']], C.blankRows(5, 4), { size: 9 });
    if (type === 'chart') b = C.CH('Chart', 0.6, 1.2, 6, 3, 'bar', 'Chart title', C.M12, [{ name: 'Series 1' }]);
    if (type === 'image') b = C.IM('Image', 6.9, 1.2, 5.8, 3.8);
    if (type === 'kpi') b = C.KP('KPI card', 0.6, 1.2, 2.4, 0.9, { title: 'Label', value: '₹ 0.0 M', sub: 'Short note' });
    s.blocks.push(b); sel = b.id; changed('struct'); renderStage();
    if (type === 'image') pickImage(b);
  }
  $$('[data-add]').forEach(function (bt) { bt.addEventListener('click', function () { addBlock(bt.getAttribute('data-add')); }); });

  /* =========================================================
     PAGE-WISE ENTRY VIEW
     ========================================================= */
  function renderEntry() {
    var host = $('#entry'), keep = host.scrollTop; host.innerHTML = '';
    host.appendChild(el('div', { class: 'help entry-intro', html: '<b>Page-wise entry:</b> every page of the report in order, with its header. Type comments, paste table/chart data from Excel, and drop or paste images into each slot. Untick a page to leave it out of the PowerPoint. Click the thumbnail to open that slide in the visual editor.' }));
    var esecs = C.sectionsFor(P.slides), elast = null;
    P.slides.forEach(function (s, si) {
      if (esecs[si].section !== elast) {
        elast = esecs[si].section;
        host.appendChild(el('h2', { class: 'esec', text: elast }));
      }
      var pg = pageNo(s);
      var inc = el('input', { type: 'checkbox', title: 'Include in PowerPoint' }); inc.checked = s.include;
      inc.addEventListener('change', function () { s.include = inc.checked; changed('struct'); });
      var ti = el('input', { class: 'ti', value: s.layout === 'cover' ? (s.subtitle || '') : (s.title || '') });
      ti.addEventListener('input', function () { if (s.layout === 'cover') s.subtitle = ti.value; else s.title = ti.value; changed('title'); });
      var card = el('div', { class: 'card' + (s.include ? '' : ' off'), id: 'card-' + s.id }, [
        el('div', { class: 'ch' }, [
          el('span', { class: 'pgb' }, [el('span', { text: pg == null ? 'Excluded' : 'Page ' + pg })]), ti,
          el('label', { class: 'chk', style: 'flex:none' }, [inc, 'Include']),
          el('button', { class: 'btn sm', text: 'Open in editor', onclick: function () { cur = s.id; sel = null; setView('editor'); } })
        ])
      ]);
      var body = el('div', { class: 'cb' }, [el('div', { class: 'lazy', text: 'Loading…' })]);
      card.appendChild(body);
      body._fill = function () { fillCard(s, body); };
      host.appendChild(card);
    });
    host.scrollTop = keep;
    fillVisible();
    setTimeout(fillVisible, 60);
  }
  function fillVisible() {
    var host = $('#entry'), hr = host.getBoundingClientRect();
    $$('#entry .cb').forEach(function (body) {
      if (!body._fill) return;
      var r = body.getBoundingClientRect();
      if (r.bottom > hr.top - 900 && r.top < hr.bottom + 900) { var f = body._fill; body._fill = null; f(); }
    });
  }
  var fvT = null;
  $('#entry').addEventListener('scroll', function () { if (fvT) return; fvT = setTimeout(function () { fvT = null; fillVisible(); }, 80); });
  function fillCard(s, body) {
    body.innerHTML = '';
    var top = el('div', { class: 'row', style: 'align-items:flex-start;gap:14px' });
    var th = el('div', { class: 'thumb', title: 'Open in visual editor', onclick: function () { cur = s.id; sel = null; setView('editor'); } });
    th.appendChild(thumbNode(s)); th._s = s;
    var f = el('div', { style: 'flex:1' }); slideFields(s, true).forEach(function (n) { f.appendChild(n); });
    if (s.layout === 'content' && !(s.blocks || []).length) f.appendChild(el('div', { class: 'help', text: 'This slide has only a header. Open it in the editor to add text, tables, charts or images.' }));
    top.appendChild(th); top.appendChild(f);
    body.appendChild(top);
    (s.blocks || []).forEach(function (b) {
      var be = el('div', { class: 'blkE' }, [el('div', { class: 'bh' }, [el('span', { class: 'ty ' + b.type, style: 'color:#fff;border-radius:4px;padding:1px 6px;font-size:10px', text: b.type }), document.createTextNode(b.label || b.type)])]);
      if (b.type === 'image') {
        var r = el('div', { class: 'row', style: 'align-items:flex-start;gap:14px' });
        var left = el('div', { style: 'flex:1.2' }); left.appendChild(edImage(b));
        var right = el('div', { style: 'flex:1' }); right.appendChild(posEditor(b));
        r.appendChild(left); r.appendChild(right); be.appendChild(r);
      } else be.appendChild(blockEditor(b));
      body.appendChild(be);
    });
  }
  function thumbNode(s) {
    var wrap = el('div', { style: 'position:absolute;left:0;top:0;width:960px;height:540px;transform:scale(0.25);transform-origin:0 0;font-family:Arial' });
    wrap.appendChild(slideHTML(s, 'thumb'));
    return wrap;
  }
  var thT = null;
  function refreshThumbs() {
    clearTimeout(thT);
    thT = setTimeout(function () { $$('#entry .thumb').forEach(function (t) { if (t._s && t.getBoundingClientRect().bottom > 0 && t.getBoundingClientRect().top < innerHeight) { t.innerHTML = ''; t.appendChild(thumbNode(t._s)); } }); }, 400);
  }
  function refillCard(s) {
    if (!s) return;
    var card = document.getElementById('card-' + s.id); if (!card) return;
    var body = card.querySelector('.cb'); if (body && !body._fill) fillCard(s, body);
    refreshThumbs();
  }

  /* =========================================================
     VIEW + MODALS + TOP BAR
     ========================================================= */
  function setView(v) {
    view = v;
    $('#tabEd').classList.toggle('on', v === 'editor'); $('#tabEn').classList.toggle('on', v === 'entry');
    $('#main').classList.toggle('entry', v === 'entry');
    renderAll();
    if (v === 'entry') { var c = document.getElementById('card-' + cur); if (c) setTimeout(function () { c.scrollIntoView({ block: 'start' }); fillVisible(); }, 30); }
  }
  function renderAll() {
    renderSide();
    if (view === 'editor') { renderStage(); renderPanel(); } else renderEntry();
  }
  $('#tabEd').onclick = function () { setView('editor'); };
  $('#tabEn').onclick = function () { setView('entry'); };
  $('#q').addEventListener('input', renderSide);
  window.addEventListener('resize', function () { if (view === 'editor') fitStage(); }, SIG);

  function ask(title, html, buttons) {
    $('#mTitle').textContent = title; $('#mBody').innerHTML = '';
    if (typeof html === 'string') $('#mBody').innerHTML = html; else $('#mBody').appendChild(html);
    var ft = $('#mFoot'); ft.innerHTML = '';
    buttons.forEach(function (b) {
      ft.appendChild(el('button', { class: 'btn' + (b[2] === 'red' ? ' red' : b[2] === 'y' ? ' y' : ''), text: b[0], onclick: function () { var keep = b[1] && b[1]() === false; if (!keep) closeModal(); } }));
    });
    $('#modal').classList.add('on');
  }
  function closeModal() { $('#modal').classList.remove('on'); }
  $('#modal').addEventListener('mousedown', function (e) { if (e.target.id === 'modal') closeModal(); });

  $('#bAll').onclick = function () {
    var allOn = P.slides.every(function (s) { return s.include; });
    P.slides.forEach(function (s) { s.include = !allOn; }); changed('struct'); renderAll();
  };

  $('#bAddSlide').onclick = function () {
    var box = el('div');
    var pos = P.slides.findIndex(function (s) { return s.id === cur; });
    var curSec = currentSection();
    function add(s, keepTemplateSection) { s.include = true; if (!keepTemplateSection || !s.section) s.section = curSec; P.slides.splice(pos + 1, 0, s); cur = s.id; sel = null; changed('struct'); renderAll(); closeModal(); }
    box.appendChild(el('div', { class: 'lab', style: 'margin-bottom:6px', text: 'Basic layouts (inserted after the current slide)' }));
    var basics = el('div', { class: 'tplList', style: 'max-height:none;margin-bottom:14px' });
    [
      ['Header only', function () { return C.S('blank', 'New slide', []); }],
      ['Text – two columns', function () { return C.S('blank', 'New slide', [C.T('Left text', 0.5, 1.05, 6.1, 5.8, C.ACN, 10), C.T('Right text', 6.9, 1.05, 6.0, 5.8, '# Heading\n- ', 10)]); }],
      ['Charts left + comments right', function () { return C.S('blank', 'New slide', [C.CH('Chart 1', 0.5, 1.0, 7.5, 2.9, 'bar', 'Chart 1', C.M12, [{ name: 'Series 1' }]), C.CH('Chart 2', 0.5, 4.0, 7.5, 2.9, 'bar', 'Chart 2', C.M12, [{ name: 'Series 1' }]), C.T('Achieved / Challenge / Next Plan', 8.3, 1.0, 4.7, 5.8, C.ACN, 10)]); }],
      ['Table full page', function () { return C.S('blank', 'New slide', [C.TB('Table', 0.5, 1.0, 12.4, 5.9, [['Column 1', 'Column 2', 'Column 3', 'Column 4', 'Comment']], C.blankRows(12, 5), { size: 9 })]); }],
      ['Image + text', function () { return C.S('blank', 'New slide', [C.T('Text', 0.5, 1.1, 6.0, 5.8, '- \n- ', 12), C.IM('Image', 6.8, 1.0, 6.1, 5.9)]); }],
      ['Section cover', function () { return C.COVER('blank', 'Section title', 'Presenter name', 'Date'); }]
    ].forEach(function (o) { basics.appendChild(el('button', { text: o[0], onclick: function () { add(o[1]()); } })); });
    box.appendChild(basics);
    box.appendChild(el('div', { class: 'lab', style: 'margin-bottom:6px', text: 'Pages from the board report template (fresh, empty copy)' }));
    var tl = el('div', { class: 'tplList' });
    C.TEMPLATE().forEach(function (t, i) {
      tl.appendChild(el('button', { html: '<span class="tn">' + (i + 1) + '.</span> ' + esc(t.layout === 'cover' ? 'Cover – ' + t.subtitle : t.title) + ' <span class="tn">· ' + esc(t.section || '') + '</span>', onclick: function () { add(t, true); } }));
    });
    box.appendChild(tl);
    ask('Add slide', box, [['Close']]);
  };

  $('#bSet').onclick = function () {
    var st = P.settings, box = el('div');
    var fn = el('input', { type: 'text', value: st.fileName || '' }), rt = el('input', { type: 'text', value: st.reportTitle || '' }), au = el('input', { type: 'text', value: st.author || '' });
    var pn = el('input', { type: 'checkbox' }); pn.checked = st.pageNumbers !== false;
    box.appendChild(fld('PowerPoint file name', fn));
    box.appendChild(fld('Report title (file properties)', rt));
    box.appendChild(fld('Author (file properties)', au));
    box.appendChild(el('label', { class: 'chk', style: 'margin:6px 0 14px' }, [pn, 'Show page numbers (top-right, counts only included slides)']));
    box.appendChild(el('div', { class: 'lab', text: 'Start over' }));
    box.appendChild(el('div', { class: 'help', html: 'Your work is kept in this browser automatically. Use <b>Save project</b> to keep a file copy you can open on another PC or send to a colleague.' }));
    box.appendChild(el('div', { class: 'row', style: 'margin-top:8px;justify-content:flex-start' }, [el('button', { class: 'btn red', text: 'Reset everything to the empty India template', onclick: function () {
      ask('Reset everything?', '<p>All pages, comments, data and images in this browser will be replaced by the empty template. Save a project file first if you want to keep this version.</p>', [['Cancel'], ['Reset all', function () { var keepName = P.settings.reportName; P = C.newProject(); P.settings.reportName = keepName; cur = P.slides[0].id; sel = null; changed('struct'); renderAll(); toast('Template restored'); }, 'red']]);
    } })]));
    ask('Settings', box, [['Cancel'], ['Save', function () { st.fileName = fn.value.trim() || 'Management_Report'; st.reportTitle = rt.value; st.author = au.value; st.pageNumbers = pn.checked; changed('struct'); renderAll(); }, 'y']]);
  };

  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function stamp() { var d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
  $('#bSave').onclick = function () {
    download(new Blob([JSON.stringify(P)], { type: 'application/json' }), (P.settings.fileName || 'report') + '_backup_' + stamp() + '.json');
    toast('Backup file downloaded (includes images)');
  };
  $('#bOpen').onclick = function () { $('#fileProj').value = ''; $('#fileProj').click(); };
  $('#fileProj').addEventListener('change', function () {
    var f = this.files[0]; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var p = JSON.parse(fr.result);
        if (!p || !Array.isArray(p.slides)) throw new Error('bad');
        p.settings = p.settings || {};
        p.settings.reportName = P.settings.reportName;
        p.slides.forEach(function (s) { (s.blocks || []).forEach(function (b) { if (b.type === 'image') b.img = null; }); });
        P = p; cur = P.slides[0].id; sel = null; changed('struct'); renderAll(); toast('Backup imported: ' + f.name);
      } catch (e) { toast('That file is not a report project (.json)'); }
    };
    fr.readAsText(f);
  });
  $('#bExport').onclick = function () {
    var n = P.slides.filter(function (s) { return s.include; }).length;
    if (!n) { toast('No slides are included – tick at least one'); return; }
    $('#busy').style.display = 'flex';
    setTimeout(function () {
      try {
        var pptx = C.buildPptx(window.PptxGenJS, P, ASSETS);
        pptx.write({ outputType: 'blob', compression: true }).then(function (blob) {
          download(blob, (P.settings.fileName || 'Management_Report') + '_' + stamp() + '.pptx');
          $('#busy').style.display = 'none'; toast('PowerPoint exported – ' + n + ' slides', 3000);
        }).catch(function (e) { $('#busy').style.display = 'none'; toast('Export failed: ' + e.message, 5000); });
      } catch (e) { $('#busy').style.display = 'none'; toast('Export failed: ' + e.message, 5000); console.error(e); }
    }, 30);
  };

  /* PDF: every included slide is drawn at full size into a print-only deck (one slide per
     13.33 x 7.5 in page) and the browser's print dialog saves it as a PDF with real text. */
  var pdfBtn = $('#bPdf');
  if (pdfBtn) pdfBtn.onclick = function () {
    var list = P.slides.filter(function (s) { return s.include; });
    if (!list.length) { toast('No slides are included – tick at least one'); return; }
    var old = document.getElementById('printDeck'); if (old) old.remove();
    var deck = el('div', { id: 'printDeck' });
    list.forEach(function (s) {
      var pg = el('div', { class: 'pslide' }), inner = el('div', { class: 'pslide-in' });
      inner.appendChild(slideHTML(s, 'thumb'));
      pg.appendChild(inner); deck.appendChild(pg);
    });
    document.body.appendChild(deck);
    var title = document.title, name = (P.settings.fileName || 'Management_Report') + '_' + stamp();
    var imgs = Array.prototype.slice.call(deck.querySelectorAll('img'));
    $('#busy').style.display = 'flex';
    var ready = Promise.all(imgs.map(function (im) { return im.decode ? im.decode().catch(function () {}) : null; }));
    Promise.race([ready, new Promise(function (r) { setTimeout(r, 4000); })]).then(function () {
      $('#busy').style.display = 'none';
      var done = function () { document.body.classList.remove('printing'); document.title = title; deck.remove(); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      document.body.classList.add('printing'); document.title = name;
      toast('Choose “Save as PDF” as the printer – ' + list.length + ' slides', 4000);
      setTimeout(function () { window.print(); }, 50);
    });
  };

  /* thumbs refresh in entry view on edits */
  var _changed = changed;
  changed = function (k, b) { _changed(k, b); if (view === 'entry') refreshThumbs(); };

  /* ---------- boot ---------- */
  var nameInput = $('#rName');
  if (nameInput) nameInput.addEventListener('input', function () { P.settings.reportName = nameInput.value; save(); }, SIG);
  if (READONLY) document.body.classList.add('ro');
  setState('Loading report…');
  STORE.load().then(function (p) {
    P = p; P.settings = P.settings || {};
    cur = P.slides[0].id;
    if (nameInput) { nameInput.value = P.settings.reportName || ''; nameInput.readOnly = READONLY; }
    renderAll();
    setState(READONLY ? 'View only – you can export, but changes are not saved' : 'All changes saved');
  }).catch(function (e) { setState('Could not load: ' + e.message); toast('Could not load the report: ' + e.message, 6000); });

  return {
    destroy: function () { clearTimeout(saveT); AC.abort(); document.body.classList.remove('ro'); },
    flush: function () { return flush(); }
  };
} };
