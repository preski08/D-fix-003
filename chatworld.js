/* ============================================================
   CHAT WORLD — terintegrasi di dalam Chat (gaya MLBB global)
   - Tab World di list chat
   - Feed pesan publik dari user REAL dalam radius GPS
   - Avatar kiri, bubble pesan, input bawah
   - TANPA akun bot / fake
   ============================================================ */
(function () {
  'use strict';

  var WORLD_KEY = 'dk_world_msgs';
  var PRESENCE_KEY = 'dk_cw_presence';
  var FRIENDS_KEY = 'dk_friends';
  var DEFAULT_RADIUS_KM = 25;
  var DEFAULT_LAT = -6.175392, DEFAULT_LNG = 106.827153;
  var myLat = DEFAULT_LAT, myLng = DEFAULT_LNG, gpsReady = false;
  var worldView = false;
  var pollTimer = null;

  function rd(k, d) {
    try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; }
  }
  function wr(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {
      alert('Penyimpanan penuh.');
    }
  }
  function me() {
    var s = rd('dk_session', null);
    return s && s.id ? s.id : null;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function tTime(ts) {
    var d = new Date(ts), n = new Date();
    var hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2);
    if (d.toDateString() === n.toDateString()) return hh + ':' + mm;
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + ' ' + hh + ':' + mm;
  }

  function updatePresence() {
    var u = me();
    if (!u || !gpsReady) return;
    var all = rd(PRESENCE_KEY, {});
    all[u] = { id: u, lat: myLat, lng: myLng, ts: Date.now(), online: true };
    var now = Date.now();
    Object.keys(all).forEach(function (k) {
      if (now - (all[k].ts || 0) > 45 * 60 * 1000) delete all[k];
    });
    wr(PRESENCE_KEY, all);
  }

  function getNearbyUsers(radiusKm) {
    var u = me();
    var all = rd(PRESENCE_KEY, {});
    var list = [];
    Object.keys(all).forEach(function (k) {
      var p = all[k];
      if (!p || p.id === u) return;
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
      var users = rd('dk_users', []);
      var found = users.some(function (x) { return x.id === p.id && !x.ghost; });
      if (!found) return;
      var dist = haversineKm(myLat, myLng, p.lat, p.lng);
      if (dist <= radiusKm) {
        p._dist = dist;
        list.push(p);
      }
    });
    list.sort(function (a, b) { return a._dist - b._dist; });
    return list;
  }

  function getWorldMsgs(radiusKm) {
    var all = rd(WORLD_KEY, []);
    if (!Array.isArray(all)) all = [];
    var u = me();
    var cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return all.filter(function (m) {
      if (!m || !m.ts || m.ts < cutoff) return false;
      var users = rd('dk_users', []);
      if (!users.some(function (x) { return x.id === m.from && !x.ghost; })) return false;
      if (gpsReady && m.lat != null && m.lng != null) {
        var d = haversineKm(myLat, myLng, m.lat, m.lng);
        return d <= radiusKm;
      }
      return m.from === u;
    }).sort(function (a, b) { return a.ts - b.ts; }).slice(-80);
  }

  function pushWorldMsg(text) {
    var u = me();
    if (!u || !text) return;
    var all = rd(WORLD_KEY, []);
    if (!Array.isArray(all)) all = [];
    all.push({
      id: 'W' + Date.now() + Math.random().toString(36).slice(2, 5),
      from: u,
      text: text,
      ts: Date.now(),
      lat: gpsReady ? myLat : null,
      lng: gpsReady ? myLng : null
    });
    if (all.length > 300) all = all.slice(-250);
    wr(WORLD_KEY, all);
  }

  function addFriend(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    var all = rd(FRIENDS_KEY, {});
    if (!all[fromId]) all[fromId] = {};
    all[fromId][toId] = { ts: Date.now() };
    if (!all[toId]) all[toId] = {};
    all[toId][fromId] = { ts: Date.now(), from: fromId };
    wr(FRIENDS_KEY, all);
  }

  function injectCSS() {
    if (document.getElementById('cw-styles')) return;
    var s = document.createElement('style');
    s.id = 'cw-styles';
    s.textContent =
      '.cw-tabs{display:flex;gap:0;padding:0 8px;background:rgba(255,255,255,.45);backdrop-filter:blur(20px);flex-shrink:0;border-bottom:1px solid rgba(255,255,255,.6)}' +
      '.cw-tab{flex:1;padding:12px 8px;border:none;background:none;color:#64748b;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;position:relative}' +
      '.cw-tab.on{color:#7C3AED}' +
      '.cw-tab.on::after{content:"";position:absolute;left:20%;right:20%;bottom:0;height:3px;background:linear-gradient(90deg,#a78bfa,#60a5fa);border-radius:3px 3px 0 0}' +
      '.cw-world-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(255,255,255,.4);flex-shrink:0;font-size:12px;color:#64748b;border-bottom:1px solid rgba(255,255,255,.5)}' +
      '.cw-world-bar select{background:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.9);color:#1e293b;border-radius:10px;padding:6px 10px;font-family:inherit;font-size:12px}' +
      '.cw-world-bar button{background:rgba(255,255,255,.65);border:1px solid rgba(255,255,255,.9);color:#1e293b;border-radius:10px;padding:6px 10px;font-size:12px;cursor:pointer;font-family:inherit}' +
      '.cw-msg{display:flex;gap:10px;padding:12px 14px;align-items:flex-start;margin-bottom:8px;background:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.8);border-radius:16px;backdrop-filter:blur(14px);box-shadow:0 4px 14px rgba(15,23,42,.04)}' +
      '.cw-msg:hover{background:rgba(237,233,254,.6);border-color:rgba(167,139,250,.4)}' +
      '.cw-av{width:36px;height:36px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#a78bfa,#60a5fa);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;box-shadow:0 4px 12px rgba(124,58,237,.25)}' +
      '.cw-msg-body{flex:1;min-width:0}' +
      '.cw-msg-head{display:flex;align-items:center;gap:6px;margin-bottom:2px;flex-wrap:wrap}' +
      '.cw-msg-name{color:#7C3AED;font-weight:700;font-size:13px}' +
      '.cw-msg-name.me{color:#059669}' +
      '.cw-msg-time{color:#94a3b8;font-size:11px}' +
      '.cw-msg-dist{color:#D97706;font-size:10px;font-weight:600}' +
      '.cw-msg-text{color:#1e293b;font-size:14px;line-height:1.4;word-break:break-word}' +
      '.cw-msg-act{display:flex;gap:6px;margin-top:6px}' +
      '.cw-msg-act button{background:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.9);color:#64748b;font-size:11px;padding:5px 10px;border-radius:10px;cursor:pointer;font-family:inherit;font-weight:600}' +
      '.cw-msg-act button:active{background:rgba(237,233,254,.9);color:#7C3AED}' +
      '.cw-empty-world{color:#64748b;text-align:center;padding:48px 24px;font-size:13px;line-height:1.5}' +
      '.cw-empty-world .ei{font-size:48px;margin-bottom:12px;opacity:.5}';
    document.head.appendChild(s);
  }

  function ensureTabs() {
    var ov = document.getElementById('dkc-ov');
    if (!ov) return;
    if (document.getElementById('cw-tabs')) return;
    injectCSS();
    var h = ov.querySelector('.dkc-h');
    if (!h) return;
    var tabs = document.createElement('div');
    tabs.id = 'cw-tabs';
    tabs.className = 'cw-tabs';
    tabs.innerHTML =
      '<button type="button" class="cw-tab on" id="cwTabChats" data-t="chats">Chat</button>' +
      '<button type="button" class="cw-tab" id="cwTabWorld" data-t="world">🌍 World</button>' +
      '<button type="button" class="cw-tab" id="cwTabFriends" data-t="friends">Teman</button>';
    h.parentNode.insertBefore(tabs, h.nextSibling);
    tabs.querySelectorAll('.cw-tab').forEach(function (b) {
      b.onclick = function () { switchTab(this.getAttribute('data-t')); };
    });
  }

  function switchTab(name) {
    document.querySelectorAll('.cw-tab').forEach(function (t) {
      t.classList.toggle('on', t.getAttribute('data-t') === name);
    });
    worldView = (name === 'world' || name === 'friends');
    if (name === 'chats') {
      stopPoll();
      var bar = document.getElementById('cw-world-bar');
      if (bar) bar.style.display = 'none';
      if (typeof window.dkChatDrawList === 'function') window.dkChatDrawList();
      var ib = document.getElementById('dkc-ib');
      if (ib) ib.style.display = 'none';
      var tt = document.getElementById('dkc-tt');
      if (tt) tt.innerHTML = 'Chats<small id="dkc-sub"></small>';
    } else if (name === 'world') {
      openWorldFeed();
    } else if (name === 'friends') {
      openFriendsList();
    }
  }

  function openWorldFeed() {
    ensureTabs();
    injectCSS();
    var tt = document.getElementById('dkc-tt');
    if (tt) tt.innerHTML = '🌍 World<small id="dkc-sub">radius GPS · tanpa bot</small>';
    var avh = document.getElementById('dkc-avh');
    if (avh) avh.textContent = '🌍';

    var body = document.getElementById('dkc-body');
    if (!body) return;
    var bar = document.getElementById('cw-world-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'cw-world-bar';
      bar.className = 'cw-world-bar';
      bar.innerHTML =
        '<span>Radius</span>' +
        '<select id="cwRadius">' +
          '<option value="5">5 km</option><option value="10">10 km</option>' +
          '<option value="25" selected>25 km</option><option value="50">50 km</option>' +
        '</select>' +
        '<button type="button" id="cwGpsBtn">📍 GPS</button>' +
        '<button type="button" id="cwRefreshBtn">🔄</button>';
      body.parentNode.insertBefore(bar, body);
      document.getElementById('cwGpsBtn').onclick = function () {
        requestGPS(function () { renderWorldFeed(); });
      };
      document.getElementById('cwRefreshBtn').onclick = function () { renderWorldFeed(); };
      document.getElementById('cwRadius').onchange = function () { renderWorldFeed(); };
    }
    bar.style.display = 'flex';

    var ib = document.getElementById('dkc-ib');
    if (ib) {
      ib.style.display = 'flex';
      var inp = document.getElementById('dkc-inp');
      if (inp) inp.placeholder = 'Ketik di World chat…';
    }

    if (!gpsReady) {
      requestGPS(function () { renderWorldFeed(); startPoll(); });
    } else {
      updatePresence();
      renderWorldFeed();
      startPoll();
    }
  }

  function renderWorldFeed() {
    var body = document.getElementById('dkc-body');
    if (!body) return;
    var radius = parseFloat((document.getElementById('cwRadius') || {}).value) || DEFAULT_RADIUS_KM;
    updatePresence();
    var msgs = getWorldMsgs(radius);
    var u = me();

    if (!msgs.length) {
      body.innerHTML =
        '<div class="cw-empty-world">' +
          '<div class="ei">🌍</div>' +
          '<div><b>Belum ada pesan di radius ' + radius + ' km</b></div>' +
          '<div style="margin-top:10px">Hanya user nyata yang aktif GPS.<br>Tidak ada bot / akun palsu.</div>' +
          '<div style="margin-top:14px;font-size:12px">Aktifkan GPS lalu ketik pesan di bawah.</div>' +
        '</div>';
      return;
    }

    body.innerHTML = '';
    msgs.forEach(function (m) {
      var isMe = m.from === u;
      var distTxt = '';
      if (m.lat != null && m.lng != null && gpsReady) {
        var d = haversineKm(myLat, myLng, m.lat, m.lng);
        distTxt = d < 1 ? Math.round(d * 1000) + ' m' : d.toFixed(1) + ' km';
      }
      var row = document.createElement('div');
      row.className = 'cw-msg';
      row.innerHTML =
        '<div class="cw-av">' + esc((m.from || '?').charAt(0).toUpperCase()) + '</div>' +
        '<div class="cw-msg-body">' +
          '<div class="cw-msg-head">' +
            '<span class="cw-msg-name' + (isMe ? ' me' : '') + '">' + esc(m.from) + '</span>' +
            (distTxt ? '<span class="cw-msg-dist">📍 ' + distTxt + '</span>' : '') +
            '<span class="cw-msg-time">' + tTime(m.ts) + '</span>' +
          '</div>' +
          '<div class="cw-msg-text">' + esc(m.text).replace(/\\n/g, '<br>') + '</div>' +
          (!isMe
            ? '<div class="cw-msg-act">' +
                '<button type="button" data-pm="' + esc(m.from) + '">💬 PM</button>' +
                '<button type="button" data-add="' + esc(m.from) + '">+ Teman</button>' +
              '</div>'
            : '') +
        '</div>';
      body.appendChild(row);
    });

    body.querySelectorAll('[data-pm]').forEach(function (b) {
      b.onclick = function () { openPrivateChat(this.getAttribute('data-pm')); };
    });
    body.querySelectorAll('[data-add]').forEach(function (b) {
      b.onclick = function () {
        addFriend(u, this.getAttribute('data-add'));
        this.textContent = '✓ Teman';
        this.disabled = true;
      };
    });
    setTimeout(function () { body.scrollTop = body.scrollHeight; }, 40);
  }

  function openFriendsList() {
    stopPoll();
    var bar = document.getElementById('cw-world-bar');
    if (bar) bar.style.display = 'none';
    var ib = document.getElementById('dkc-ib');
    if (ib) ib.style.display = 'none';
    var tt = document.getElementById('dkc-tt');
    if (tt) tt.innerHTML = 'Teman<small id="dkc-sub">dari World</small>';
    var body = document.getElementById('dkc-body');
    if (!body) return;
    var u = me();
    var fr = rd(FRIENDS_KEY, {});
    var mine = fr[u] || {};
    var ids = Object.keys(mine);
    if (!ids.length) {
      body.innerHTML = '<div class="cw-empty-world"><div class="ei">👥</div>Belum ada teman.<br>Add dari pesan World.</div>';
      return;
    }
    body.innerHTML = '';
    ids.forEach(function (fid) {
      var row = document.createElement('div');
      row.className = 'cw-msg';
      row.style.cursor = 'pointer';
      row.innerHTML =
        '<div class="cw-av">' + esc(fid.charAt(0).toUpperCase()) + '</div>' +
        '<div class="cw-msg-body">' +
          '<div class="cw-msg-name">' + esc(fid) + '</div>' +
          '<div class="cw-msg-time">Ketuk untuk chat pribadi</div>' +
        '</div>';
      row.onclick = function () { openPrivateChat(fid); };
      body.appendChild(row);
    });
  }

  function openPrivateChat(uid) {
    var u = me();
    if (!u || !uid || uid === u) return;
    try {
      var users = rd('dk_users', []);
      if (!users.some(function (x) { return x.id === uid && !x.ghost; })) {
        alert('Akun "' + uid + '" tidak terdaftar.');
        return;
      }
      var CONN_KEY = 'dk_connections';
      var all = rd(CONN_KEY, {});
      if (!all[u]) all[u] = {};
      if (!all[u][uid]) {
        all[u][uid] = { ts: Date.now(), fee: 0, source: 'world' };
        if (!all[uid]) all[uid] = {};
        all[uid][u] = { ts: Date.now(), fee: 0, from: u, source: 'world' };
        wr(CONN_KEY, all);
      }
    } catch (e) {}
    stopPoll();
    worldView = false;
    document.querySelectorAll('.cw-tab').forEach(function (t) {
      t.classList.toggle('on', t.getAttribute('data-t') === 'chats');
    });
    var bar = document.getElementById('cw-world-bar');
    if (bar) bar.style.display = 'none';
    if (typeof window.dkChatOpenRoom === 'function') {
      window.dkChatOpenRoom(uid);
    } else {
      var inp = document.getElementById('dkc-nwid');
      if (inp) {
        var dlg = document.getElementById('dkc-dlg');
        if (dlg) dlg.classList.add('active');
        inp.value = uid;
      }
    }
  }

  function requestGPS(cb) {
    if (!navigator.geolocation) {
      alert('Browser tidak support GPS.');
      if (cb) cb(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(function (pos) {
      myLat = pos.coords.latitude;
      myLng = pos.coords.longitude;
      gpsReady = true;
      updatePresence();
      if (cb) cb(true);
    }, function (err) {
      alert('Gagal GPS: ' + err.message + '\\nIzinkan lokasi di browser.');
      if (cb) cb(false);
    }, { enableHighAccuracy: true, timeout: 12000 });
  }

  function startPoll() {
    stopPoll();
    pollTimer = setInterval(function () {
      if (worldView && document.getElementById('cwTabWorld') &&
          document.getElementById('cwTabWorld').classList.contains('on')) {
        renderWorldFeed();
      }
    }, 4000);
  }
  function stopPoll() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function hookSend() {
    var sm = document.getElementById('dkc-sm');
    var inp = document.getElementById('dkc-inp');
    if (!sm || sm._cwHooked) return;
    sm._cwHooked = true;
    var orig = sm.onclick;
    sm.onclick = function (e) {
      var worldOn = document.getElementById('cwTabWorld') &&
        document.getElementById('cwTabWorld').classList.contains('on');
      if (worldOn && inp && inp.value.trim()) {
        pushWorldMsg(inp.value.trim());
        inp.value = '';
        inp.style.height = 'auto';
        renderWorldFeed();
        return;
      }
      if (typeof orig === 'function') return orig.call(this, e);
    };
    if (inp && !inp._cwHooked) {
      inp._cwHooked = true;
      inp.addEventListener('keydown', function (e) {
        var worldOn = document.getElementById('cwTabWorld') &&
          document.getElementById('cwTabWorld').classList.contains('on');
        if (worldOn && e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          if (inp.value.trim()) {
            pushWorldMsg(inp.value.trim());
            inp.value = '';
            inp.style.height = 'auto';
            renderWorldFeed();
          }
        }
      }, true);
    }
  }

  setInterval(function () {
    if (document.getElementById('dkc-ov')) {
      ensureTabs();
      hookSend();
    }
  }, 800);

  window.CW_open = function () {
    if (!me()) { alert('Login dulu'); return; }
    if (typeof window.dkChatOpen === 'function') window.dkChatOpen();
    setTimeout(function () {
      ensureTabs();
      switchTab('world');
    }, 300);
  };
  window.CW_close = function () {};

  window.addEventListener('storage', function (e) {
    if (e.key === WORLD_KEY || e.key === PRESENCE_KEY) {
      if (worldView) renderWorldFeed();
    }
  });

  console.log('[ChatWorld] integrated in Chat · MLBB-style · no bots ✅');
})();
