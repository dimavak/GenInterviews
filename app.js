/* Нина Терентьевна рассказывает: проигрыватель, расшифровка и навигация.
   Обычный JavaScript без библиотек; данные берутся из transcript.js и content.js. */
(function () {
  'use strict';

  var T = window.TRANSCRIPT || [];
  var PERIODS = window.PERIODS || [];
  var CHAPTERS = (window.CHAPTERS || []).slice().sort(function (a, b) { return a.t - b.t; });
  var EVENTS = window.EVENTS || [];
  var PHOTOS = window.PHOTOS || [];
  var ENV = window.ENVELOPE || { step: 2, data: '' };
  var DUR0 = window.DURATION || 0;
  var KEY = 'nina-2015-position';

  var DIMS = {
    'army.jpg': [1034, 1400], 'artash-1930s.jpg': [1400, 966], 'artash.jpg': [966, 1400],
    'avakyan-1930s.jpg': [734, 1024], 'children.jpg': [1400, 1008], 'family-1945.jpg': [936, 1400],
    'lena.jpg': [870, 1192], 'nina-young.jpg': [1295, 930], 'parents.jpg': [1277, 1000], 'son-baby.jpg': [1004, 1365]
  };
  var ALBUM_ORDER = ['parents.jpg', 'artash-1930s.jpg', 'family-1945.jpg', 'nina-young.jpg', 'artash.jpg',
    'army.jpg', 'son-baby.jpg', 'children.jpg', 'lena.jpg'];

  var root = document.documentElement;
  var $ = function (s) { return document.querySelector(s); };
  var audio = $('#audio');
  var player = $('#player');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- мелочи ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(t) {
    t = Math.max(0, Math.floor(t || 0));
    var h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
    return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cssVar(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
  function thread(id) { return 'var(--t-' + id + ')'; }
  function file(src) { return src.split('/').pop(); }
  function dims(src) { var d = DIMS[file(src)]; return d ? ' width="' + d[0] + '" height="' + d[1] + '"' : ''; }
  function duration() { return isFinite(audio.duration) && audio.duration > 0 ? audio.duration : DUR0; }
  var periodById = {};
  PERIODS.forEach(function (p) { periodById[p.id] = p; });

  function chapterAt(t) {
    var lo = 0, hi = CHAPTERS.length - 1, k = 0;
    while (lo <= hi) {
      var m = (lo + hi) >> 1;
      if (CHAPTERS[m].t <= t + 0.01) { k = m; lo = m + 1; } else hi = m - 1;
    }
    return k;
  }

  /* Квадратные скобки в тексте: [?] — неуверенно, [неразб.] — не разобрано, остальное — пояснения. */
  function markup(text, st) {
    var out = st.open ? '<span class="' + st.open + '">' : '';
    var parts = String(text).split(/([\[\]])/);
    for (var k = 0; k < parts.length; k++) {
      var p = parts[k];
      if (p === '[') {
        if (st.open) { out += '['; continue; }
        var next = parts[k + 1] || '';
        st.open = next.charAt(0) === '?' ? 'q' : /^неразб/.test(next) ? 'unclear' : 'ed';
        out += '<span class="' + st.open + '">[';
      } else if (p === ']') {
        if (st.open) { out += ']</span>'; st.open = null; } else out += ']';
      } else out += esc(p);
    }
    if (st.open) out += '</span>';
    return out;
  }

  /* Поиск: точный, а если ничего не нашлось — «по звучанию»
     (Копавишча найдётся по слову Коповище, дзеревня — по слову деревня). */
  function norm(s) { return s.toLowerCase().replace(/ё/g, 'е'); }
  function skel(s) {
    return norm(s).replace(/щ/g, 'шч').replace(/дз/g, 'д').replace(/дж/g, 'ж').replace(/ц/g, 'т')
      .replace(/[ьъ'’]/g, '').replace(/[аеиоуыэюя]+/g, '*')
      .replace(/([бвгджзйклмнпрстфхчш])\1+/g, '$1');
  }

  /* ---------- узоры: вышивка, плетение, эмблема ---------- */
  function svgUrl(s) { return 'url("data:image/svg+xml,' + encodeURIComponent(s) + '")'; }
  function stitchPath(x, y, r) {
    return 'M' + (x - r) + ' ' + (y + r) + 'L' + (x + r) + ' ' + (y - r) +
      'M' + (x - r) + ' ' + (y - r) + 'L' + (x + r) + ' ' + (y + r);
  }

  function paintWeaves() {
    var red = cssVar('--red'), apr = cssVar('--apricot'), pom = cssVar('--pomegranate'), lin = cssVar('--linen');
    // белорусская полоса: ромбик крестиком, середина абрикосовая
    var c = 4, d = '', mid = '';
    [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [1, -1], [-1, 1], [-1, -1], [-4, 0], [4, 0]].forEach(function (p) {
      d += stitchPath(16 + p[0] * c, 11 + p[1] * c, 1.45);
    });
    mid = stitchPath(16, 11, 1.45);
    var by = "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='22'><g fill='none' stroke-width='1.25' stroke-linecap='round'>" +
      "<path d='" + d + "' stroke='" + red + "'/><path d='" + mid + "' stroke='" + apr + "'/></g></svg>";
    // армянское плетение: две нити, которые по очереди проходят друг над другом
    function strand(sign, x0, x1) {
      var pts = [];
      for (var x = x0; x <= x1 + 0.01; x += 1) pts.push(x.toFixed(1) + ',' + (11 - sign * 8 * Math.sin(Math.PI * x / 22)).toFixed(2));
      return pts.join(' ');
    }
    function line(points, color, w) {
      return "<polyline points='" + points + "' fill='none' stroke='" + color + "' stroke-width='" + w + "' stroke-linecap='round'/>";
    }
    var am = "<svg xmlns='http://www.w3.org/2000/svg' width='44' height='22'>" +
      line(strand(1, 0, 44), pom, 2.3) + line(strand(-1, 0, 44), apr, 2.3) +
      line(strand(1, 15, 29), lin, 5.2) + line(strand(1, 15, 29), pom, 2.3) +
      line(strand(-1, -7, 7), lin, 5.2) + line(strand(-1, -7, 7), apr, 2.3) +
      line(strand(-1, 37, 51), lin, 5.2) + line(strand(-1, 37, 51), apr, 2.3) +
      "<path d='M11 8.6 13.4 11 11 13.4 8.6 11Z' fill='" + red + "'/><path d='M33 8.6 35.4 11 33 13.4 30.6 11Z' fill='" + red + "'/></svg>";
    var byUrl = svgUrl(by), amUrl = svgUrl(am);
    document.querySelectorAll('.weave-by').forEach(function (e) { e.style.backgroundImage = byUrl; });
    document.querySelectorAll('.weave-am').forEach(function (e) { e.style.backgroundImage = amUrl; });
  }

  /* Эмблема союза: белорусский ромб с «рожками», вышитый крестиком,
     внутри — армянский знак вечности (аревахач). */
  function drawEmblem() {
    var svg = $('#emblem');
    if (!svg) return;
    var cell = 6, R = 7, red = '', inner = '';
    for (var i = -R; i <= R; i++) for (var j = -R; j <= R; j++) {
      if (Math.abs(i) + Math.abs(j) === R) red += stitchPath(i * cell, j * cell, 1.9);
    }
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (v) {
      var dx = v[0], dy = v[1];
      red += stitchPath(dx * (R + 1) * cell, dy * (R + 1) * cell, 1.9);
      red += stitchPath((dx * (R + 2) + dy) * cell, (dy * (R + 2) + dx) * cell, 1.9);
      red += stitchPath((dx * (R + 2) - dy) * cell, (dy * (R + 2) - dx) * cell, 1.9);
      inner += stitchPath(dx * 5 * cell, dy * 5 * cell, 1.9);
    });
    var arm = 'M0 0C7 2 17 1 23-9C17-4 9-4 2-2Z';
    var arms = '';
    for (var k = 0; k < 8; k++) {
      arms += '<path d="' + arm + '" transform="rotate(' + (k * 45) + ')" style="fill:var(' +
        (k % 2 ? '--apricot' : '--pomegranate') + ')"/>';
    }
    svg.innerHTML =
      '<g fill="none" stroke-width="1.5" stroke-linecap="round">' +
      '<path d="' + red + '" style="stroke:var(--red)"/>' +
      '<path d="' + inner + '" style="stroke:var(--apricot)"/></g>' +
      '<g class="arev"><g transform="scale(1.14)">' + arms + '</g></g>' +
      '<circle r="3.4" style="fill:var(--linen-light);stroke:var(--red)" stroke-width="1.4"/>';
  }

  function swatch(id) {
    var d = '';
    for (var k = 0; k < 4; k++) d += stitchPath(5 + k * 9, 6, 3);
    return '<svg class="thread-swatch" viewBox="0 0 40 12" aria-hidden="true"><path d="' + d +
      '" fill="none" stroke-width="2" stroke-linecap="round" style="stroke:' + thread(id) + '"/></svg>';
  }

  /* ---------- расшифровка ---------- */
  var textBox = $('#text');
  var sents = [];        // {t, el, norm, skel}
  var times = [];
  var heads = [];        // заголовок главы в тексте по номеру главы

  function photoFigure(ph, cls) {
    return '<figure class="' + cls + '"><button class="print" type="button" data-photo="' + esc(ph.src) +
      '" aria-label="Открыть фотографию: ' + esc(ph.caption) + '"><img src="' + esc(ph.src) + '" alt="' +
      esc(ph.caption) + '" loading="lazy"' + dims(ph.src) + '></button><figcaption>' + esc(ph.caption) +
      '</figcaption></figure>';
  }

  function renderTranscript() {
    var headsAt = {}, photosAfter = {};
    CHAPTERS.forEach(function (c, k) { (headsAt[c.p] = headsAt[c.p] || []).push(k); });
    PHOTOS.forEach(function (ph) { if (ph.after != null) (photosAfter[ph.after] = photosAfter[ph.after] || []).push(ph); });
    var html = [];
    T.forEach(function (p, i) {
      (headsAt[i] || []).forEach(function (k) {
        var c = CHAPTERS[k], per = periodById[c.period] || { title: '', years: '' };
        html.push('<div class="ch-head" id="ch' + (k + 1) + '" data-k="' + k + '" style="--c:' + thread(c.period) + '">' +
          '<p class="ch-period">' + esc(per.title + ', ' + per.years) + '</p><h3>' + esc(c.title) + '</h3></div>');
      });
      var kind = p.s === 'Б' ? 'b' : p.s === 'Д' ? 'd' : 'x';
      var who = kind === 'b' ? 'Бабушка' : kind === 'd' ? 'Дима' : '';
      var st = { open: null };
      var body = p.x.map(function (x) {
        return '<span class="s" data-t="' + x[0] + '">' + markup(x[1], st) + '</span>';
      }).join(' ');
      html.push('<div class="para para-' + kind + '" id="p' + i + '">' +
        '<button class="para-time" type="button" data-t="' + p.t + '" aria-label="Слушать с ' + fmt(p.t) + '">' + fmt(p.t) + '</button>' +
        '<div class="para-body">' + (who ? '<span class="who">' + who + '</span>' : '') +
        '<p class="say">' + body + '</p></div></div>');
      (photosAfter[i] || []).forEach(function (ph) { html.push(photoFigure(ph, 'inline-photo')); });
    });
    textBox.innerHTML = html.join('');

    var flat = [];
    T.forEach(function (p) { p.x.forEach(function (x) { flat.push(x[1]); }); });
    textBox.querySelectorAll('.s').forEach(function (node, k) {
      var s = flat[k] || '';
      sents.push({ t: +node.dataset.t, el: node, norm: norm(s), skel: skel(s) });
    });
    var run = 0;
    times = sents.map(function (s) { run = Math.max(run, s.t); return run; });
    textBox.querySelectorAll('.ch-head').forEach(function (h) { heads[+h.dataset.k] = h; });
  }

  function sentAt(t) {
    var lo = 0, hi = times.length - 1, k = -1;
    while (lo <= hi) {
      var m = (lo + hi) >> 1;
      if (times[m] <= t + 0.05) { k = m; lo = m + 1; } else hi = m - 1;
    }
    return k;
  }

  /* ---------- главы, периоды, альбом ---------- */
  var chapterBtns = [];
  function renderChapters() {
    var list = $('#chapterList');
    list.innerHTML = CHAPTERS.map(function (c, k) {
      return '<li><button class="chapter-btn" type="button" data-k="' + k + '" style="--c:' + thread(c.period) + '">' +
        '<span>' + esc(c.title) + '</span><span class="chapter-time">' + fmt(c.t) + '</span></button></li>';
    }).join('');
    chapterBtns = Array.prototype.slice.call(list.querySelectorAll('.chapter-btn'));
    list.addEventListener('click', function (e) {
      var b = e.target.closest('.chapter-btn');
      if (b) goChapter(+b.dataset.k);
    });
    var rail = $('.rail'), toggle = $('#railToggle');
    toggle.addEventListener('click', function () {
      var open = !rail.classList.contains('open');
      rail.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  function goChapter(k) {
    var c = CHAPTERS[k];
    seek(c.t);
    var rail = $('.rail');
    if (rail.classList.contains('open')) {
      rail.classList.remove('open');
      $('#railToggle').setAttribute('aria-expanded', 'false');
    }
    if (heads[k]) scrollToEl(heads[k], 'start');
  }

  function renderThreads() {
    var ul = $('#threads');
    ul.innerHTML = PERIODS.map(function (p) {
      return '<li><button class="thread-btn" type="button" data-id="' + p.id + '">' + swatch(p.id) +
        '<span class="thread-name">' + esc(p.title) + '</span><span class="thread-years">' + esc(p.years) + '</span></button></li>';
    }).join('');
    ul.querySelectorAll('.thread-btn').forEach(function (b) {
      var id = b.dataset.id;
      var on = function () { bigBand && bigBand.emphasize(id); };
      var off = function () { bigBand && bigBand.emphasize(null); };
      b.addEventListener('mouseenter', on); b.addEventListener('focus', on);
      b.addEventListener('mouseleave', off); b.addEventListener('blur', off);
      b.addEventListener('click', function () {
        var target = document.getElementById('period-' + id);
        if (target) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }

  var PLAY_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>';
  function renderPeriods() {
    var ol = $('#periods');
    ol.innerHTML = PERIODS.map(function (p) {
      var chips = CHAPTERS.map(function (c, k) { return c.period === p.id ?
        '<li><button class="chip" type="button" data-k="' + k + '">' + esc(c.title) + '</button></li>' : ''; }).join('');
      var photos = PHOTOS.filter(function (ph) { return ph.period === p.id; }).map(function (ph) {
        return '<button class="print" type="button" data-photo="' + esc(ph.src) + '" aria-label="Открыть фотографию: ' +
          esc(ph.caption) + '"><img src="' + esc(ph.src) + '" alt="' + esc(ph.caption) + '" loading="lazy"' + dims(ph.src) + '></button>';
      }).join('');
      var events = EVENTS.filter(function (e) { return e.period === p.id; }).map(function (e) {
        return '<li><button class="event" type="button" data-t="' + e.t + '" aria-label="' + esc(e.date + '. ' + e.text +
          '. Слушать с ' + fmt(e.t)) + '">' + PLAY_ICON + '<span class="event-date">' + esc(e.date) + '</span>' +
          '<span class="event-text">' + esc(e.text) + '</span><span class="event-time">' + fmt(e.t) + '</span></button></li>';
      }).join('');
      return '<li class="period" id="period-' + p.id + '" style="--c:' + thread(p.id) + '">' +
        '<p class="period-years">' + esc(p.years) + '</p>' +
        '<div class="period-main"><h3>' + esc(p.title) + '</h3><p class="period-places">' + esc(p.places) + '</p>' +
        '<p class="period-summary">' + esc(p.summary) + '</p>' +
        (chips ? '<ul class="period-chapters" aria-label="Главы рассказа">' + chips + '</ul>' : '') +
        (photos ? '<div class="period-photos">' + photos + '</div>' : '') + '</div>' +
        '<ul class="events" aria-label="События">' + events + '</ul></li>';
    }).join('');
    ol.addEventListener('click', function (e) {
      var ev = e.target.closest('.event');
      if (ev) { playFrom(+ev.dataset.t); return; }
      var chip = e.target.closest('.chip');
      if (chip) goChapter(+chip.dataset.k);
    });
  }

  function renderAlbum() {
    var list = PHOTOS.slice().sort(function (a, b) {
      return ALBUM_ORDER.indexOf(file(a.src)) - ALBUM_ORDER.indexOf(file(b.src));
    });
    $('#album').innerHTML = list.map(function (ph) {
      return '<li class="album-item"><figure><button class="mount" type="button" data-photo="' + esc(ph.src) +
        '" aria-label="Открыть фотографию: ' + esc(ph.caption) + '"><img src="' + esc(ph.src) + '" alt="' + esc(ph.caption) +
        '" loading="lazy"' + dims(ph.src) + '><span class="corner-b" aria-hidden="true"></span></button>' +
        '<figcaption>' + esc(ph.caption) + '</figcaption></figure></li>';
    }).join('');
  }

  /* ---------- вышитое полотно записи ---------- */
  /* Громкость речи по столбцам полотна, растянутая так, чтобы тишина была тонкой строчкой,
     а оживлённый рассказ — широкой полосой. */
  function levels(cols, dur) {
    var data = ENV.data, step = ENV.step || 2, raw = [];
    for (var c = 0; c < cols; c++) {
      var i0 = Math.floor(c / cols * dur / step), i1 = Math.max(i0 + 1, Math.ceil((c + 1) / cols * dur / step));
      i1 = Math.min(i1, data.length);
      var sum = 0, n = 0;
      for (var i = i0; i < i1; i++) { sum += data.charCodeAt(i) - 48; n++; }
      raw.push(n ? sum / n : 0);
    }
    if (!data) return raw.map(function () { return 0.3; });
    var sorted = raw.slice().sort(function (a, b) { return a - b; });
    var lo = sorted[Math.floor(cols * 0.04)], hi = sorted[Math.floor(cols * 0.97)] || 1;
    return raw.map(function (v) { return Math.min(1, Math.max(0, (v - lo) / (hi - lo || 1))); });
  }

  function Band(canvas, opt) {
    this.c = canvas; this.o = opt; this.emph = null; this.hoverT = null; this.w = 0;
    this.on = document.createElement('canvas');
    this.off = document.createElement('canvas');
  }
  Band.prototype.layout = function () {
    var r = this.c.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    if (!this.w || !this.h) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = Math.round(this.w * this.dpr), H = Math.round(this.h * this.dpr);
    [this.c, this.on, this.off].forEach(function (cv) { cv.width = W; cv.height = H; });
    this.paint();
  };
  Band.prototype.paint = function () {
    if (!this.w) return;
    var o = this.o, cell = o.cell, margin = o.margin || 0;
    var rows = Math.floor((this.h - 2 * margin) / cell);
    if (rows % 2 === 0) rows--;
    rows = Math.max(rows, 1);
    var half = (rows - 1) / 2;
    var cols = Math.max(24, Math.floor(this.w / cell));
    var cw = this.w / cols, y0 = (this.h - rows * cell) / 2, dur = duration() || 1;
    var colors = {};
    PERIODS.forEach(function (p) { colors[p.id] = cssVar('--t-' + p.id); });
    this.ink = cssVar('--ink'); this.red = cssVar('--red'); this.soft = cssVar('--ink-soft');
    var self = this, lv = levels(cols, dur);
    [[this.off, o.rest || 0.42], [this.on, 1]].forEach(function (pair) {
      var g = pair[0].getContext('2d'), alpha = pair[1];
      g.setTransform(self.dpr, 0, 0, self.dpr, 0, 0);
      g.clearRect(0, 0, self.w, self.h);
      g.lineCap = 'round';
      if (o.holes && pair[0] === self.off) {          // дырочки канвы
        g.fillStyle = cssVar('--rule');
        for (var cx = 0; cx < cols; cx++) for (var ry = 0; ry < rows; ry++) {
          g.fillRect((cx + 0.5) * cw - 0.6, y0 + (ry + 0.5) * cell - 0.6, 1.2, 1.2);
        }
      }
      var r = cell * 0.3;
      g.lineWidth = Math.max(1, cell * 0.24);
      for (var c = 0; c < cols; c++) {
        var t0 = c / cols * dur, t1 = (c + 1) / cols * dur;
        var k = Math.round(lv[c] * half);
        var per = CHAPTERS.length ? CHAPTERS[chapterAt((t0 + t1) / 2)].period : '';
        var dim = self.emph && self.emph !== per ? 0.16 : 1;
        g.strokeStyle = colors[per] || self.ink;
        var x = (c + 0.5) * cw;
        for (var rr = -k; rr <= k; rr++) {
          var y = y0 + (half + rr + 0.5) * cell;
          g.globalAlpha = alpha * dim * 0.78;          // нижний стежок
          g.beginPath(); g.moveTo(x - r, y + r); g.lineTo(x + r, y - r); g.stroke();
          g.globalAlpha = alpha * dim;                 // верхний стежок
          g.beginPath(); g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.stroke();
        }
      }
      g.globalAlpha = 1;
      if (o.ticks && pair[0] === self.off) {          // начало каждой главы
        g.fillStyle = self.soft;
        CHAPTERS.forEach(function (ch) {
          var x = ch.t / dur * self.w, y = self.h - 2.5;
          g.beginPath(); g.moveTo(x, y - 2.5); g.lineTo(x + 2.5, y); g.lineTo(x, y + 2.5); g.lineTo(x - 2.5, y); g.fill();
        });
      }
    });
  };
  Band.prototype.draw = function (t) {
    if (!this.w) return;
    var g = this.c.getContext('2d'), W = this.c.width, H = this.c.height, d = this.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.drawImage(this.off, 0, 0);
    var px = Math.round(Math.min(1, t / (duration() || 1)) * W);
    if (px > 0) g.drawImage(this.on, 0, 0, px, H, 0, 0, px, H);
    if (this.hoverT != null) {
      var hx = Math.round(this.hoverT / (duration() || 1) * W);
      g.fillStyle = this.soft; g.globalAlpha = 0.7;
      g.fillRect(hx - 0.5 * d, 0, d, H);
      g.globalAlpha = 1;
    }
    g.fillStyle = this.ink;
    g.fillRect(px - d, 0, 2 * d, H);
    if (this.o.knob) {                               // ромбик на игле
      var s = 4.5 * d;
      g.fillStyle = this.red;
      [s, H - s].forEach(function (y) {
        g.beginPath(); g.moveTo(px, y - s); g.lineTo(px + s, y); g.lineTo(px, y + s); g.lineTo(px - s, y); g.fill();
      });
    }
  };
  Band.prototype.emphasize = function (id) {
    if (this.emph === id) return;
    this.emph = id; this.paint(); this.draw(now());
  };
  Band.prototype.bind = function () {
    var self = this, c = this.c, dragging = false, moved = false;
    function tAt(e) {
      var r = c.getBoundingClientRect();
      return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * duration();
    }
    c.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      dragging = true; moved = false;
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* старые браузеры */ }
      seek(tAt(e));
      e.preventDefault();
    });
    c.addEventListener('pointermove', function (e) {
      var t = tAt(e);
      if (dragging) { moved = true; seek(t); }
      if (e.pointerType === 'mouse') self.hover(t, e);
    });
    function end() {
      if (!dragging) return;
      dragging = false;
      if (self.o.playOnClick && audio.paused) play();
    }
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', function () { dragging = false; });
    c.addEventListener('pointerleave', function () { self.hover(null); });
    if (self.o.keys) {
      c.addEventListener('keydown', function (e) {
        var t = now(), map = { ArrowLeft: -10, ArrowDown: -10, ArrowRight: 10, ArrowUp: 10, PageDown: -60, PageUp: 60 };
        if (e.key in map) seek(t + map[e.key]);
        else if (e.key === 'Home') seek(0);
        else if (e.key === 'End') seek(duration() - 1);
        else if (e.key === ' ' || e.key === 'Enter') toggle();
        else return;
        e.preventDefault(); e.stopPropagation();
      });
    }
  };
  Band.prototype.hover = function (t, e) {
    this.hoverT = t;
    this.draw(now());
    var tip = this.o.tip;
    if (!tip) return;
    if (t == null) { tip.hidden = true; return; }
    var c = CHAPTERS[chapterAt(t)];
    tip.innerHTML = '<b>' + fmt(t) + '</b> ' + esc(c ? c.title : '');
    tip.hidden = false;
    var box = tip.parentNode.getBoundingClientRect();
    var x = e.clientX - box.left, w = tip.offsetWidth / 2;
    tip.style.left = Math.min(box.width - w, Math.max(w, x)) + 'px';
  };

  var bigBand = null, miniBand = null, bands = [];

  /* ---------- проигрыватель ---------- */
  var pendingT = null;
  function now() { return pendingT != null ? pendingT : audio.currentTime || 0; }
  function seek(t) {
    t = Math.min(Math.max(0, t), Math.max(0, duration() - 0.5));
    if (audio.readyState >= 1) { pendingT = null; audio.currentTime = t; } else pendingT = t;
    update(t);
  }
  function play() {
    var p = audio.play();
    if (p && p.catch) p.catch(function (err) { if (err && err.name === 'NotSupportedError') audioFailed(); });
  }
  function toggle() { if (audio.paused) play(); else audio.pause(); }
  function playFrom(t) { seek(t); play(); }

  audio.addEventListener('loadedmetadata', function () {
    if (pendingT != null) { var t = pendingT; pendingT = null; audio.currentTime = t; }
    $('#band').setAttribute('aria-valuemax', String(Math.round(duration())));
  });

  var ptime = $('#ptime'), pchapter = $('#pchapter'), band = $('#band');
  var curSent = -1, curChap = -1, lastSec = -1;

  function update(t) {
    var k = sentAt(t);
    if (k !== curSent) {
      if (curSent >= 0) sents[curSent].el.classList.remove('now');
      curSent = k;
      if (k >= 0) sents[k].el.classList.add('now');
      sentenceChanged();
    }
    var c = chapterAt(t);
    if (c !== curChap) { curChap = c; chapterChanged(c); }
    var sec = Math.floor(t);
    if (sec !== lastSec) {
      lastSec = sec;
      ptime.textContent = fmt(t) + ' / ' + fmt(duration());
      band.setAttribute('aria-valuenow', String(sec));
      band.setAttribute('aria-valuetext', fmt(t) + ', ' + (CHAPTERS[c] ? CHAPTERS[c].title : ''));
    }
    bands.forEach(function (b) { b.draw(t); });
    if (!audio.paused) savePos(false);
  }

  function chapterChanged(c) {
    var ch = CHAPTERS[c];
    if (!ch) return;
    if (!pchapter.dataset.error) {
      pchapter.innerHTML = '<span class="pdot" style="background:' + thread(ch.period) + '"></span>' + esc(ch.title);
    }
    chapterBtns.forEach(function (b, k) {
      if (k === c) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    var rail = $('.rail'), btn = chapterBtns[c];
    if (btn && rail.scrollHeight > rail.clientHeight + 4) {
      var br = btn.getBoundingClientRect(), rr = rail.getBoundingClientRect();
      if (br.top < rr.top || br.bottom > rr.bottom) rail.scrollTop += br.top - rr.top - rr.height / 3;
    }
  }

  ['timeupdate', 'seeked'].forEach(function (ev) { audio.addEventListener(ev, function () { update(now()); }); });
  audio.addEventListener('play', function () { setPlaying(true); });
  audio.addEventListener('pause', function () { setPlaying(false); });
  audio.addEventListener('ended', function () { setPlaying(false); });
  audio.addEventListener('error', audioFailed);

  function audioFailed() {
    pchapter.dataset.error = '1';
    pchapter.textContent = 'Запись не загрузилась. Её можно скачать по ссылке внизу страницы.';
  }

  var playBtn = $('#playBtn');
  function setPlaying(on) {
    player.classList.toggle('playing', on);
    root.classList.toggle('is-playing', on);
    playBtn.setAttribute('aria-label', on ? 'Пауза' : 'Слушать');
    if (!on) savePos(true);
    updateFollow();
  }

  playBtn.addEventListener('click', toggle);
  $('#backBtn').addEventListener('click', function () { seek(now() - 10); });
  $('#fwdBtn').addEventListener('click', function () { seek(now() + 10); });

  var SPEEDS = [1, 1.25, 1.5, 0.75], sp = 0, speedBtn = $('#speedBtn');
  speedBtn.addEventListener('click', function () {
    sp = (sp + 1) % SPEEDS.length;
    audio.playbackRate = SPEEDS[sp];
    var label = String(SPEEDS[sp]).replace('.', ',') + '×';
    speedBtn.textContent = label;
    speedBtn.setAttribute('aria-label', 'Скорость: ' + (SPEEDS[sp] === 1 ? 'обычная' : label));
  });

  var toastEl = $('#toast'), toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  $('#linkBtn').addEventListener('click', function () {
    var t = Math.floor(now());
    var url = location.href.split('#')[0] + '#t=' + t;
    var fallback = function () {
      try { history.replaceState(null, '', '#t=' + t); } catch (err) { location.hash = 't=' + t; }
      toast('Ссылка на ' + fmt(t) + ' теперь в адресной строке');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast('Ссылка на ' + fmt(t) + ' скопирована'); }, fallback);
    } else fallback();
  });

  /* запоминаем, где остановились */
  var lastSaved = -100;
  function savePos(force) {
    var t = now();
    if (!force && Math.abs(t - lastSaved) < 5) return;
    lastSaved = t;
    try { localStorage.setItem(KEY, String(Math.floor(t))); } catch (err) { /* приватный режим */ }
  }
  function loadPos() {
    try { return parseFloat(localStorage.getItem(KEY)) || 0; } catch (err) { return 0; }
  }

  function hashTime() {
    var m = location.hash.match(/t=([\d:.]+)/);
    if (!m) return null;
    var parts = m[1].split(':').map(Number);
    if (parts.some(isNaN)) return null;
    return parts.reduce(function (a, v) { return a * 60 + v; }, 0);
  }

  /* ---------- следование за текстом ---------- */
  var userScrollAt = 0, progUntil = 0, textVisible = false, followBtn = $('#followBtn');
  function scrollToEl(el, block) {
    progUntil = Date.now() + 3000;      // длинная плавная прокрутка; заканчивается по scrollend
    userScrollAt = 0;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: block || 'center' });
  }
  function scrollToTime(t) {
    var k = sentAt(t);
    if (k >= 0) scrollToEl(sents[k].el);
  }
  function viewH() { return window.innerHeight - player.offsetHeight; }
  function sentenceChanged() {
    if (curSent < 0) return;
    var el = sents[curSent].el;
    if (!audio.paused && textVisible && Date.now() - userScrollAt > 5000) {
      var r = el.getBoundingClientRect(), h = viewH();
      if (r.top < h * 0.15 || r.bottom > h * 0.72) scrollToEl(el);
    }
    updateFollow();
  }
  function updateFollow() {
    var show = false;
    if (!audio.paused && curSent >= 0) {
      var r = sents[curSent].el.getBoundingClientRect();
      show = r.bottom < 0 || r.top > viewH();
    }
    followBtn.hidden = !show;
  }
  followBtn.addEventListener('click', function () { if (curSent >= 0) scrollToEl(sents[curSent].el); });

  var scrollQueued = false;
  window.addEventListener('scroll', function () {
    if (Date.now() > progUntil) userScrollAt = Date.now();
    if (!scrollQueued) {
      scrollQueued = true;
      requestAnimationFrame(function () { scrollQueued = false; updateFollow(); });
    }
  }, { passive: true });
  window.addEventListener('scrollend', function () { if (progUntil > Date.now()) progUntil = Date.now() + 80; });
  ['wheel', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, function () { progUntil = 0; userScrollAt = Date.now(); }, { passive: true });
  });

  /* ---------- поиск ---------- */
  var q = $('#q'), qCount = $('#qCount'), qPrev = $('#qPrev'), qNext = $('#qNext');
  var hits = [], hitK = -1, fuzzy = false, qTimer = 0;
  function clearHits() {
    hits.forEach(function (k) { sents[k].el.classList.remove('hit', 'hit-now'); });
    hits = []; hitK = -1; fuzzy = false;
  }
  function runSearch() {
    clearHits();
    var v = q.value.trim();
    if (v.length < 2) { qCount.textContent = ''; setNav(); return; }
    // точное совпадение плюс совпадение «по звучанию»: Коповище найдёт и бабушкино «Копавишча»
    var nq = norm(v), exact = 0;
    var sq = skel(v).replace(/^\*+|\*+$/g, '');
    var sound = (sq.match(/[^*]/g) || []).length >= 3;
    sents.forEach(function (s, k) {
      if (s.norm.indexOf(nq) >= 0) { hits.push(k); exact++; }
      else if (sound && s.skel.indexOf(sq) >= 0) hits.push(k);
    });
    fuzzy = hits.length > 0 && exact === 0;
    hits.forEach(function (k) { sents[k].el.classList.add('hit'); });
    if (hits.length) goHit(0);
    else { qCount.textContent = 'Не найдено'; setNav(); }
  }
  function goHit(k) {
    if (!hits.length) return;
    if (hitK >= 0) sents[hits[hitK]].el.classList.remove('hit-now');
    hitK = (k + hits.length) % hits.length;
    var el = sents[hits[hitK]].el;
    el.classList.add('hit-now');
    scrollToEl(el);
    userScrollAt = Date.now() + 1500;   // поиск — это чтение: не уводить к звучащей фразе
    qCount.textContent = (hitK + 1) + ' из ' + hits.length + (fuzzy ? ', похожие' : '');
    setNav();
  }
  function setNav() { qPrev.disabled = qNext.disabled = hits.length < 2; }
  q.addEventListener('input', function () { clearTimeout(qTimer); qTimer = setTimeout(runSearch, 250); });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); clearTimeout(qTimer); if (!hits.length) runSearch(); else goHit(hitK + (e.shiftKey ? -1 : 1)); }
    else if (e.key === 'Escape') { q.value = ''; runSearch(); }
  });
  qPrev.addEventListener('click', function () { goHit(hitK - 1); });
  qNext.addEventListener('click', function () { goHit(hitK + 1); });

  /* ---------- фотографии ---------- */
  var lb = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCap'), lbListen = $('#lbListen'), lbT = null;
  function openPhoto(src) {
    var ph = PHOTOS.filter(function (p) { return p.src === src; })[0] || { src: src, caption: '' };
    if (!lb.showModal) { window.open(src, '_blank'); return; }
    lbImg.src = src; lbImg.alt = ph.caption; lbCap.textContent = ph.caption;
    lbT = ph.t != null ? ph.t : null;
    lbListen.hidden = lbT == null;
    lb.showModal();
  }
  lbListen.addEventListener('click', function () {
    lb.close();
    playFrom(lbT);
    scrollToTime(lbT);
  });
  lb.addEventListener('click', function (e) {
    if (e.target !== lb) return;
    var r = lb.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) lb.close();
  });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-photo]');
    if (b) { e.preventDefault(); openPhoto(b.dataset.photo); }
  });

  textBox.addEventListener('click', function (e) {
    var tb = e.target.closest('.para-time');
    if (tb) { playFrom(+tb.dataset.t); return; }
    var s = e.target.closest('.s');
    if (!s) return;
    var sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed && String(sel).trim()) return;   // человек выделяет текст
    playFrom(+s.dataset.t);
  });

  /* ---------- клавиатура ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || lb.open) return;
    var tg = e.target, tag = tg.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tg.isContentEditable) return;
    if (e.key === ' ') {
      if (tag === 'BUTTON' || tag === 'A') return;
      e.preventDefault(); toggle();
    } else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(now() - 5); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); seek(now() + 5); }
    else if (/^(PageUp|PageDown|ArrowUp|ArrowDown|Home|End)$/.test(e.key)) userScrollAt = Date.now();
  });

  /* ---------- запуск ---------- */
  renderTranscript();
  renderChapters();
  renderThreads();
  renderPeriods();
  renderAlbum();
  drawEmblem();
  paintWeaves();

  bigBand = new Band(band, { cell: 6, margin: 5, holes: true, ticks: true, knob: true, keys: true, playOnClick: true, tip: $('#bandTip') });
  miniBand = new Band($('#miniBand'), { cell: 3.4, margin: 0, rest: 0.5 });
  bands = [bigBand, miniBand];
  bands.forEach(function (b) { b.bind(); });
  function relayout() { bands.forEach(function (b) { b.layout(); b.draw(now()); }); }
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function () { relayout(); });
    bands.forEach(function (b) { ro.observe(b.c); });
  } else window.addEventListener('resize', relayout);
  relayout();

  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  var onScheme = function () { paintWeaves(); bands.forEach(function (b) { b.paint(); b.draw(now()); }); };
  if (mq.addEventListener) mq.addEventListener('change', onScheme); else if (mq.addListener) mq.addListener(onScheme);

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      textVisible = entries[entries.length - 1].isIntersecting;
    }).observe(textBox);
  } else textVisible = true;

  $('#startBtn').addEventListener('click', function () { playFrom(0); scrollToTime(0); });
  var resumeBtn = $('#resumeBtn');
  function offerResume(label, t) {
    resumeBtn.textContent = label;
    resumeBtn.hidden = false;
    resumeBtn.onclick = function () { playFrom(t); scrollToTime(t); };
  }

  var ht = hashTime();
  if (ht != null) {
    seek(ht);
    offerResume('Слушать с ' + fmt(ht), ht);
    setTimeout(function () { scrollToTime(ht); }, 60);
  } else {
    var saved = loadPos();
    if (saved > 30 && saved < duration() - 15) offerResume('Продолжить с ' + fmt(saved), saved);
    update(0);
  }
  window.addEventListener('hashchange', function () {
    var t = hashTime();
    if (t != null) { seek(t); scrollToTime(t); }
  });

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: 'Нина Терентьевна рассказывает',
        artist: 'Интервью 5 декабря 2015 года',
        artwork: [{ src: 'photos/parents.jpg', sizes: '1277x1000', type: 'image/jpeg' }]
      });
      navigator.mediaSession.setActionHandler('seekbackward', function () { seek(now() - 10); });
      navigator.mediaSession.setActionHandler('seekforward', function () { seek(now() + 10); });
    } catch (err) { /* не везде поддерживается */ }
  }
})();
