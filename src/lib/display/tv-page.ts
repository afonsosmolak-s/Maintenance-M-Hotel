/**
 * Página do painel de TV, independente do React.
 *
 * Navegadores de Smart TV (Tizen, webOS, Android TV antigos) trazem Chromium de vários anos
 * atrás e não executam o JavaScript do Next.js. Por isso esta página é HTML simples com:
 *  - JavaScript ES5 (var, function, XMLHttpRequest; sem arrow functions, sem fetch, sem template strings);
 *  - CSS com flexbox e unidades rem (sem grid, sem variáveis CSS, sem clamp).
 * As regras de segurança continuam no servidor (/api/display/*): aqui só se desenha o que o feed devolve.
 *
 * ATENÇÃO ao editar: o conteúdo de SCRIPT e STYLE não pode conter crases nem "${".
 */

export const TV_STYLE = `
html{font-size:20px}
html,body{margin:0;padding:0;height:100%;background:#000;color:#fff;overflow:hidden}
body{font-family:Manrope,Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased}
*{box-sizing:border-box}
#app{position:fixed;top:0;left:0;right:0;bottom:0;display:-webkit-flex;display:flex;-webkit-flex-direction:column;flex-direction:column}
.muted{color:#a3a3a3}
.center{-webkit-flex:1;flex:1;display:-webkit-flex;display:flex;-webkit-flex-direction:column;flex-direction:column;-webkit-align-items:center;align-items:center;-webkit-justify-content:center;justify-content:center;text-align:center;padding:2rem}
.eyebrow{font-size:.9rem;font-weight:600;text-transform:uppercase;letter-spacing:.25em;color:#a3a3a3;margin:0}
.pair-title{font-size:2.2rem;font-weight:600;letter-spacing:-.03em;margin:1.2rem 0}
.pair-code{font-family:Menlo,Consolas,monospace;font-size:6rem;font-weight:700;letter-spacing:.15em;margin:.5rem 0 1.5rem}
.pair-help{font-size:1.2rem;color:#a3a3a3;max-width:40rem;line-height:1.5;margin:0}
.pair-help b{color:#fff}
.head{display:-webkit-flex;display:flex;-webkit-align-items:flex-end;align-items:flex-end;-webkit-justify-content:space-between;justify-content:space-between;padding:1.2rem 2rem .8rem;border-bottom:1px solid #2a2a2a}
.head-left{min-width:0;-webkit-flex:1;flex:1}
.title{font-size:2rem;font-weight:600;letter-spacing:-.03em;line-height:1.15;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.head-right{display:-webkit-flex;display:flex;-webkit-align-items:flex-end;align-items:flex-end;white-space:nowrap}
.status{font-size:.95rem;color:#a3a3a3;margin-right:1.5rem}
.dot{display:inline-block;width:.6rem;height:.6rem;border-radius:50%;background:#4ade80;margin-right:.5rem}
.dot.off{background:#facc15}
.clock{font-size:2.6rem;font-weight:600;letter-spacing:-.03em;line-height:1}
.stale{display:none;background:#2a2205;color:#facc15;font-size:1.1rem;font-weight:600;padding:.5rem 2rem}
.kpis{display:-webkit-flex;display:flex;border-bottom:1px solid #2a2a2a}
.kpi{-webkit-flex:1;flex:1;padding:.8rem 1.2rem;border-right:1px solid #2a2a2a}
.kpi:last-child{border-right:0}
.kpi-v{font-size:3rem;font-weight:600;line-height:1;letter-spacing:-.03em}
.kpi-l{font-size:1rem;color:#a3a3a3;margin-top:.2rem}
.c-critical{color:#f87171}.c-overdue{color:#facc15}.c-high{color:#fb923c}.c-low{color:#a3a3a3}
.main{-webkit-flex:1;flex:1;display:-webkit-flex;display:flex;padding:1.2rem 2rem;min-height:0;overflow:hidden}
.col-urgent{width:41%;margin-right:1.5rem;min-width:0}
.col-rest{-webkit-flex:1;flex:1;min-width:0;display:-webkit-flex;display:flex;-webkit-flex-direction:column;flex-direction:column}
.col-h{font-size:1rem;font-weight:600;text-transform:uppercase;letter-spacing:.25em;margin:0 0 .8rem;color:#a3a3a3}
.col-h.urgent{color:#f87171}
.cards{display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-justify-content:space-between;justify-content:space-between;-webkit-align-content:flex-start;align-content:flex-start}
.card{background:#111;border-left:.3rem solid #2a2a2a;border-radius:2px;padding:.7rem 1rem;margin-bottom:.8rem;width:100%;overflow:hidden}
.cards.two .card{width:49.2%}
.card.critical{border-left-color:#f87171}.card.overdue{border-left-color:#facc15}
.card-top{display:-webkit-flex;display:flex;-webkit-justify-content:space-between;justify-content:space-between;-webkit-align-items:flex-start;align-items:flex-start}
.loc{font-size:1.4rem;font-weight:600;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;-webkit-flex:1;flex:1;margin-right:.8rem}
.big .loc{font-size:1.7rem}
.prio{font-size:1rem;font-weight:600;white-space:nowrap}
.bars{display:inline-block;height:.9rem;margin-right:.3rem;vertical-align:baseline}
.bars i{display:inline-block;width:.25rem;margin-right:.1rem;background:currentColor;border-radius:1px;vertical-align:bottom}
.bars i.dim{opacity:.2}
.what{font-size:1.15rem;margin:.4rem 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.3;max-height:3rem}
.big .what{font-size:1.35rem;max-height:3.6rem}
.meta{font-size:.95rem;color:#a3a3a3;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-align-items:center;align-items:center}
.meta span{margin-right:.5rem}
.meta .num{margin-left:auto;margin-right:0}
.pill{border-radius:2px;padding:.1rem .5rem;font-weight:600}
.s-pending,.s-assigned{background:#1c1c1c;color:#fff}
.s-in_progress{background:#0b1a33;color:#60a5fa}
.s-on_hold{background:#1a1033;color:#a78bfa}
.p-overdue{background:#2a2205;color:#facc15}
.p-prev{border:1px solid #2a2a2a}
.empty{-webkit-flex:1;flex:1;display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;-webkit-justify-content:center;justify-content:center;border:1px solid #2a2a2a;border-radius:2px;font-size:1.4rem;color:#a3a3a3;padding:2rem;min-height:8rem}
.more{font-size:1.4rem;font-weight:600;color:#f87171;margin:0}
.pages{margin-top:auto;text-align:right;font-size:.95rem;color:#a3a3a3;padding-top:.4rem}
.pg{display:inline-block;height:.5rem;width:.5rem;border-radius:.25rem;background:#2a2a2a;margin-left:.4rem}
.pg.on{width:1.6rem;background:#fff}
.big-empty{font-size:3rem;font-weight:600;letter-spacing:-.03em;margin:0 0 .5rem}
.demo{position:fixed;left:.6rem;bottom:.5rem;font-size:.8rem;color:#a3a3a3}
`;

export const TV_SCRIPT = `
(function () {
  var PRODUCT = __PRODUCT__;
  var DEMO = location.search.indexOf('demo=1') >= 0;
  var FEED_MS = 20000, MAX_BACKOFF_MS = 120000, STALE_MS = 120000, PAIR_MS = 3000;
  var URGENT_SLOTS = 5, REST_PER_PAGE = 6, LIST_PER_PAGE = 8;
  var PRIORITY = { critical: ['Crítica', 4], high: ['Alta', 3], medium: ['Média', 2], low: ['Baixa', 1] };
  var STATUS = { pending: 'Pendente', assigned: 'Atribuída', in_progress: 'Em andamento', on_hold: 'Aguardando material' };

  var app = document.getElementById('app');
  var state = { mode: 'boot', code: null, feed: null, lastSuccess: null, etag: null, failures: 0, page: 0, startedAt: new Date().getTime() };
  var timer = null, rotation = null;

  function now() { return new Date().getTime(); }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n, size) { var s = String(n); while (s.length < size) s = '0' + s; return s; }
  // Hora de Brasília (UTC-3, sem horário de verão), calculada à mão: TVs antigas não têm formatação por fuso.
  function spHour(ms) { return new Date(ms - 10800000).getUTCHours(); }
  function hhmm(ms) { var d = new Date(ms - 10800000); return pad(d.getUTCHours(), 2) + ':' + pad(d.getUTCMinutes(), 2); }
  function elapsed(iso) {
    var minutes = Math.floor((now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return 'agora';
    if (minutes < 60) return 'há ' + minutes + ' min';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return 'há ' + hours + ' h';
    return 'há ' + Math.floor(hours / 24) + ' d';
  }
  function fit() {
    var size = Math.max(14, Math.min(64, window.innerWidth * 0.0105));
    document.documentElement.style.fontSize = size + 'px';
  }

  function request(method, url, headers, done) {
    var xhr = new XMLHttpRequest();
    var finished = false;
    function finish(status) {
      if (finished) return;
      finished = true;
      var body = null;
      try { body = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch (e) { body = null; }
      done(status, body, xhr);
    }
    xhr.open(method, url, true);
    for (var key in headers) { if (headers.hasOwnProperty(key)) xhr.setRequestHeader(key, headers[key]); }
    xhr.onreadystatechange = function () { if (xhr.readyState === 4) finish(xhr.status); };
    xhr.onerror = function () { finish(0); };
    setTimeout(function () { if (!finished) { try { xhr.abort(); } catch (e) {} finish(0); } }, 15000);
    xhr.send(null);
  }
  function schedule(fn, ms) { clearTimeout(timer); timer = setTimeout(fn, ms); }

  function succeeded() { state.failures = 0; state.lastSuccess = now(); updateStatus(); }

  function loadFeed() {
    var headers = { 'Cache-Control': 'no-cache' };
    if (state.etag) headers['If-None-Match'] = state.etag;
    request('GET', '/api/display/feed', headers, function (status, body, xhr) {
      if (status === 401) return startPairing();
      if (status === 304) {
        succeeded();
      } else if (status === 200 && body && body.items) {
        state.etag = xhr.getResponseHeader('ETag');
        state.feed = body;
        state.mode = 'live';
        succeeded();
        render();
      } else {
        // Sem rede ou servidor indisponível: mantém o último ecrã e tenta de novo, esperando cada vez mais.
        state.failures += 1;
        updateStatus();
        return schedule(loadFeed, Math.min(FEED_MS * Math.pow(2, state.failures), MAX_BACKOFF_MS));
      }
      schedule(loadFeed, FEED_MS);
    });
  }

  function startPairing() {
    state.mode = 'pairing'; state.feed = null; state.etag = null; state.code = null;
    render();
    request('POST', '/api/display/pair', {}, function (status, body) {
      if (status === 200 && body && body.code) {
        state.code = body.code;
        render();
        schedule(pollPairing, PAIR_MS);
      } else {
        schedule(startPairing, 10000);
      }
    });
  }

  function pollPairing() {
    request('GET', '/api/display/pair', { 'Cache-Control': 'no-cache' }, function (status, body) {
      if (status === 200 && body) {
        if (body.status === 'paired') return loadFeed();
        if (body.status === 'waiting') return schedule(pollPairing, PAIR_MS);
        return startPairing(); // expirado ou inválido: novo código
      }
      schedule(pollPairing, PAIR_MS * 3);
    });
  }

  // ------------------------------------------------------------------ desenho
  function bars(level) {
    var html = '<span class="bars">';
    for (var i = 1; i <= 4; i++) html += '<i class="' + (i > level ? 'dim' : '') + '" style="height:' + (25 * i) + '%"></i>';
    return html + '</span>';
  }
  function card(item, big) {
    var p = PRIORITY[item.priority] || PRIORITY.medium;
    var cls = 'card' + (big ? ' big' : '') + (item.priority === 'critical' ? ' critical' : item.overdue ? ' overdue' : '');
    var pc = item.priority === 'critical' ? 'c-critical' : item.priority === 'high' ? 'c-high' : item.priority === 'low' ? 'c-low' : '';
    return '<div class="' + cls + '">' +
      '<div class="card-top"><div class="loc">' + esc(item.location || '—') + '</div>' +
      '<div class="prio ' + pc + '">' + bars(p[1]) + esc(p[0]) + '</div></div>' +
      '<div class="what">' + esc(item.title) + '</div>' +
      '<div class="meta"><span class="pill s-' + esc(item.status) + '">' + esc(STATUS[item.status] || item.status) + '</span>' +
      (item.overdue ? '<span class="pill p-overdue">Atrasada</span>' : '') +
      (item.preventive ? '<span class="pill p-prev">Preventiva</span>' : '') +
      '<span>' + esc(item.assignee || 'Sem responsável') + '</span><span>·</span><span>' + esc(elapsed(item.openedAt)) + '</span>' +
      '<span class="num">#' + pad(item.number, 4) + '</span></div></div>';
  }
  function pagesOf(items, perPage) {
    var pages = [];
    for (var i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
    return pages.length ? pages : [[]];
  }
  function dots(page, total) {
    if (total <= 1) return '';
    var html = '<div class="pages">';
    for (var i = 0; i < total; i++) html += '<span class="pg' + (i === page ? ' on' : '') + '"></span>';
    return html + ' &nbsp;' + (page + 1) + '/' + total + '</div>';
  }
  function kpi(label, value, tone) {
    return '<div class="kpi"><div class="kpi-v ' + (value && tone ? tone : '') + '">' + value + '</div><div class="kpi-l">' + label + '</div></div>';
  }

  function split(items) {
    var urgent = [], rest = [];
    for (var i = 0; i < items.length; i++) (items[i].priority === 'critical' || items[i].overdue ? urgent : rest).push(items[i]);
    return { urgent: urgent, rest: rest };
  }

  function renderRotating() {
    var feed = state.feed;
    var target = document.getElementById('rotating');
    if (!feed || !target) return;
    var isList = feed.layout === 'list';
    var pages = pagesOf(isList ? feed.items : split(feed.items).rest, isList ? LIST_PER_PAGE : REST_PER_PAGE);
    if (state.page >= pages.length) state.page = 0;
    var html = '<div class="cards two">';
    for (var i = 0; i < pages[state.page].length; i++) html += card(pages[state.page][i], false);
    target.innerHTML = html + '</div>' + dots(state.page, pages.length);
    target.setAttribute('data-pages', String(pages.length));
  }

  function render() {
    clearInterval(rotation);
    if (state.mode === 'boot') {
      app.innerHTML = '<div class="center muted" style="font-size:1.5rem">Carregando…</div>';
      return;
    }
    if (state.mode === 'pairing') {
      var code = state.code;
      app.innerHTML = '<div class="center"><p class="eyebrow">' + esc(PRODUCT) + '</p>' +
        '<h1 class="pair-title">Parear esta TV</h1>' +
        (code ? '<p class="pair-code">' + esc(code.slice(0, 3)) + '-' + esc(code.slice(3)) + '</p>'
              : '<p class="muted" style="font-size:1.4rem">Gerando código…</p>') +
        '<p class="pair-help">No aplicativo, abra <b>TV</b> no menu do estabelecimento, toque em <b>Parear TV</b> e digite este código. ' +
        'Ele vale por 10 minutos e é renovado automaticamente.</p></div>';
      return;
    }

    var feed = state.feed, c = feed.counts, parts = split(feed.items), isList = feed.layout === 'list';
    var html = '<div class="head"><div class="head-left">' +
      (feed.establishment ? '<p class="eyebrow">' + esc(feed.establishment) + '</p>' : '') +
      '<h1 class="title">' + esc(feed.display) + '</h1></div>' +
      '<div class="head-right"><div class="status"><span class="dot" id="dot"></span><span id="status"></span></div>' +
      '<div class="clock" id="clock"></div></div></div>' +
      '<div class="stale" id="stale"></div>' +
      '<div class="kpis">' + kpi('Críticas', c.critical, 'c-critical') + kpi('Atrasadas', c.overdue, 'c-overdue') +
      kpi('Em andamento', c.inProgress, '') + kpi('Pendentes', c.pending, '') + kpi('Aguardando material', c.onHold, '') + '</div>';

    if (!feed.items.length) {
      html += '<div class="center"><p class="big-empty">Sem pendências</p><p class="muted" style="font-size:1.3rem;margin:0">Nenhuma ocorrência aberta neste painel.</p></div>';
    } else if (isList) {
      html += '<div class="main"><div class="col-rest" id="rotating"></div></div>';
    } else {
      html += '<div class="main"><div class="col-urgent"><h2 class="col-h urgent">Urgente</h2>';
      if (!parts.urgent.length) {
        html += '<div class="empty">Nada crítico ou atrasado</div>';
      } else {
        for (var i = 0; i < parts.urgent.length && i < URGENT_SLOTS; i++) html += card(parts.urgent[i], true);
        if (parts.urgent.length > URGENT_SLOTS) html += '<p class="more">+' + (parts.urgent.length - URGENT_SLOTS) + ' urgentes</p>';
      }
      html += '</div><div class="col-rest"><h2 class="col-h">Demais (' + parts.rest.length + ')</h2>' +
        (parts.rest.length ? '<div class="col-rest" id="rotating"></div>' : '<div class="empty">Nenhuma outra pendência</div>') + '</div></div>';
    }
    if (DEMO) html += '<div class="demo">Demonstração — dados fictícios</div>';
    app.innerHTML = html;

    renderRotating();
    updateStatus();
    rotation = setInterval(function () {
      var target = document.getElementById('rotating');
      var total = target ? Number(target.getAttribute('data-pages')) : 1;
      if (total > 1) { state.page = (state.page + 1) % total; renderRotating(); }
    }, Math.max(6, Number(feed.rotationSeconds) || 12) * 1000);
  }

  function updateStatus() {
    var clock = document.getElementById('clock');
    if (clock) clock.innerHTML = hhmm(now());
    var isStale = state.mode === 'live' && state.lastSuccess !== null && now() - state.lastSuccess > STALE_MS;
    var status = document.getElementById('status');
    if (status) status.innerHTML = state.lastSuccess ? 'Atualizado ' + hhmm(state.lastSuccess) : 'Atualizando…';
    var dot = document.getElementById('dot');
    if (dot) dot.className = 'dot' + (isStale ? ' off' : '');
    var stale = document.getElementById('stale');
    if (stale) {
      stale.style.display = isStale ? 'block' : 'none';
      stale.innerHTML = 'Sem ligação ao servidor — mostrando dados de ' + (state.lastSuccess ? hhmm(state.lastSuccess) : '—') + '. Tentando reconectar.';
    }
  }

  function demoFeed() {
    function ago(hours) { return new Date(now() - hours * 3600000).toISOString(); }
    var titles = ['Lâmpada queimada no corredor', 'Chuveiro com baixa pressão', 'Controle da TV sem pilha', 'Limpar filtros do ar', 'Porta rangendo'];
    var prios = ['medium', 'low', 'high', 'medium'], stats = ['pending', 'in_progress', 'on_hold', 'assigned'];
    var items = [
      { number: 42, title: 'Banheira de hidromassagem com vazamento no ralo', priority: 'critical', status: 'in_progress', openedAt: ago(3), overdue: false, preventive: false, location: 'Bloco A › Suíte 12', assignee: 'João' },
      { number: 44, title: 'Disjuntor desarmando', priority: 'critical', status: 'pending', openedAt: ago(0.5), overdue: false, preventive: false, location: 'Área técnica › Quadro geral', assignee: null },
      { number: 39, title: 'Ar-condicionado não liga', priority: 'high', status: 'assigned', openedAt: ago(30), overdue: true, preventive: false, location: 'Bloco B › Suíte 21', assignee: 'Carlos' }
    ];
    for (var i = 0; i < 11; i++) {
      items.push({ number: 45 + i, title: titles[i % 5], priority: prios[i % 4], status: stats[i % 4], openedAt: ago(2 + i * 5), overdue: false,
        preventive: i % 5 === 3, location: 'Bloco ' + (i % 2 ? 'A' : 'B') + ' › Suíte ' + (10 + i), assignee: i % 3 ? 'Marcos' : null });
    }
    return { establishment: 'Motel Exemplo', display: 'Sala de manutenção', layout: location.search.indexOf('layout=list') >= 0 ? 'list' : 'urgent_rotation',
      rotationSeconds: 12, counts: { critical: 2, overdue: 1, inProgress: 4, pending: 7, onHold: 3, total: items.length }, items: items };
  }

  // ------------------------------------------------------------------ arranque
  fit();
  window.onresize = fit;
  render();

  // Mantém o ecrã ligado quando o navegador permite; o modo quiosque do dispositivo cobre o resto.
  function keepAwake() {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        var pending = navigator.wakeLock.request('screen');
        if (pending && pending['catch']) pending['catch'](function () {});
      }
    } catch (e) {}
  }
  keepAwake();
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') keepAwake(); });

  setInterval(function () {
    updateStatus();
    // Recarga diária às 4h, para limpar memória de navegadores de TV que ficam ligados semanas.
    if (spHour(now()) === 4 && now() - state.startedAt > 3600000) location.reload();
  }, 15000);

  if (DEMO) {
    state.feed = demoFeed(); state.mode = 'live'; state.lastSuccess = now();
    if (location.search.indexOf('tela=codigo') >= 0) { state.mode = 'pairing'; state.code = 'K7P4QX'; }
    if (location.search.indexOf('tela=offline') >= 0) state.lastSuccess = now() - 300000;
    render();
  } else {
    loadFeed();
  }
})();
`;

export function renderTvPage(productName: string): string {
  // JSON dentro de <script>: "<" escapado para um "</script>" no texto não fechar a tag.
  const script = TV_SCRIPT.replace("__PRODUCT__", () => JSON.stringify(productName).replace(/</g, "\\u003c"));
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#000000">
<title>Painel de manutenção</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap">
<style>${TV_STYLE}</style>
</head>
<body>
<div id="app"><div class="center muted" style="font-size:1.5rem">Carregando…</div></div>
<noscript><div class="center">Este painel precisa de JavaScript ativado no navegador da TV.</div></noscript>
<script>${script}</script>
</body>
</html>`;
}
