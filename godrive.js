/* ============================================================
   GO DRIVE — Dompetku (motor / mobil · jemput & antar)
   - Pilih peran: Driver (online motor/mobil) atau Penumpang
   - Titik jemput & tujuan di peta (Leaflet + OpenStreetMap)
   - Jarak via OSRM (fallback garis lurus x1.3)
   - Tarif standar Rp 3.000/km, atau nego (tawar & tawar balik)
   - ESCROW: saldo penumpang DITAHAN saat order diterima,
     baru dilepas ke driver setelah penumpang konfirmasi selesai
   - Rating hanya 1x per pesanan, setelah selesai
   - Tampilan kaca transparan (liquid glass)
   ============================================================ */
(function () {
  'use strict';

  var RATE = 3000;
  var MIN_OFFER = 1000;
  var ORDERS_KEY = 'dk_drive_orders';
  var DEFAULT_LAT = -2.2136, DEFAULT_LNG = 113.9108; // Palangkaraya

  var ST = {
    view: 'home', sel: null, draft: null, pick: 'from',
    map: null, mF: null, mT: null,
    lat: DEFAULT_LAT, lng: DEFAULT_LNG, gps: false
  };

  var STATUS = {
    tawar: 'Tawaran',
    diterima: 'Diterima',
    berjalan: 'Dalam perjalanan',
    menunggu_konfirmasi: 'Menunggu konfirmasi',
    selesai: 'Selesai',
    batal: 'Dibatalkan'
  };
  var KIND = { jemput: 'Jemput orang', antar: 'Antar makanan/barang' };

  /* ---------- helpers ---------- */
  function rd(k, d) {
    try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; }
  }
  function wr(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) {
      alert('Penyimpanan penuh.'); return false;
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
  function rp(n) {
    if (typeof window.dkFmtMoney === 'function') return window.dkFmtMoney(n);
    return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
  }
  function bal(u) { return typeof window.dkGetBalance === 'function' ? window.dkGetBalance(u) : 0; }
  function hav(lat1, lng1, lat2, lng2) {
    var R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function priceOf(km) { return Math.round(km * RATE); }
  function newDraft() { return { kind: 'jemput', vehicle: 'motor', from: null, to: null, km: null }; }

  function getOrders() {
    var a = rd(ORDERS_KEY, []);
    return Array.isArray(a) ? a : [];
  }
  function saveOrders(a) { return wr(ORDERS_KEY, a); }
  function findOrder(id) {
    return getOrders().filter(function (x) { return x.id === id; })[0] || null;
  }
  function updOrder(o) {
    var a = getOrders();
    for (var i = 0; i < a.length; i++) if (a[i].id === o.id) { a[i] = o; break; }
    saveOrders(a);
  }
  function profile() {
    return rd('dk_drive_profile_' + me(), { vehicle: 'motor', online: false });
  }
  function saveProfile(p) { wr('dk_drive_profile_' + me(), p); }
  function avgRating(uid) {
    var rs = getOrders().filter(function (o) { return o.driver === uid && o.rating; });
    if (!rs.length) return { avg: 0, n: 0 };
    var s = 0; rs.forEach(function (o) { s += o.rating; });
    return { avg: s / rs.length, n: rs.length };
  }
  function refreshMoney() {
    if (window.dkRenderBalance) window.dkRenderBalance();
    if (window.dkRenderHistory) window.dkRenderHistory();
    if (window.dkRenderChart) window.dkRenderChart();
  }

  /* ---------- saldo: escrow ---------- */
  // Tahan saldo penumpang. Return null jika sukses, atau pesan error.
  function hold(o) {
    if (bal(o.passenger) < o.price) {
      return 'Saldo penumpang tidak cukup untuk ditahan (' + rp(o.price) + ').';
    }
    window.dkUpdateBalance(o.passenger, -o.price);
    window.dkAddTx(o.passenger, { type: 'out', amount: o.price, desc: 'Ditahan (escrow) Go Drive #' + o.id, to: 'escrow', status: 'success' });
    o.hold = o.price;
    return null;
  }
  // Lepas saldo tertahan ke driver.
  function release(o) {
    window.dkUpdateBalance(o.driver, o.hold);
    window.dkAddTx(o.driver, { type: 'in', amount: o.hold, desc: 'Pendapatan Go Drive #' + o.id, from: o.passenger, status: 'success' });
    o.hold = 0;
  }
  // Kembalikan saldo tertahan ke penumpang.
  function refund(o) {
    window.dkUpdateBalance(o.passenger, o.hold);
    window.dkAddTx(o.passenger, { type: 'in', amount: o.hold, desc: 'Refund Go Drive #' + o.id, from: 'escrow', status: 'success' });
    o.hold = 0;
  }

  /* ---------- jarak ---------- */
  function routeKm(a, b, cb) {
    var hv = hav(a.lat, a.lng, b.lat, b.lng) * 1.3;
    if (typeof fetch !== 'function') { cb(hv); return; }
    var url = 'https://router.project-osrm.org/route/v1/driving/' +
      a.lng + ',' + a.lat + ';' + b.lng + ',' + b.lat + '?overview=false';
    fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      cb(j && j.routes && j.routes[0] ? j.routes[0].distance / 1000 : hv);
    }).catch(function () { cb(hv); });
  }

  /* ---------- aksi order ---------- */
  function act(a, id, arg) {
    var o = findOrder(id);
    if (!o) { alert('Pesanan tidak ditemukan.'); return; }
    var u = me(), isP = o.passenger === u;

    if (a === 'accept') {
      if (o.status !== 'tawar' || o.offeredBy === u) return;
      if (!isP) o.driver = u;
      var err = hold(o);
      if (err) { alert(err); return; }
      o.status = 'diterima';
    } else if (a === 'counter') {
      if (o.status !== 'tawar' || o.offeredBy === u) return;
      var v = parseInt(arg, 10);
      if (!(v >= MIN_OFFER)) { alert('Tawaran minimal ' + rp(MIN_OFFER)); return; }
      if (!isP) o.driver = u;
      o.price = v;
      o.offeredBy = u;
    } else if (a === 'cancel') {
      if (o.status === 'tawar' && isP) o.status = 'batal';
      else if (o.status === 'diterima' && (isP || o.driver === u)) { refund(o); o.status = 'batal'; }
      else return;
    } else if (a === 'pickup') {
      if (o.driver !== u || o.status !== 'diterima') return;
      o.status = 'berjalan';
    } else if (a === 'finish') {
      if (o.driver !== u || o.status !== 'berjalan') return;
      o.status = 'menunggu_konfirmasi';
    } else if (a === 'release') {
      if (!isP || o.status !== 'menunggu_konfirmasi') return;
      release(o);
      o.status = 'selesai';
    } else if (a === 'rate') {
      var n = parseInt(arg, 10);
      if (!isP || o.status !== 'selesai' || o.rating || !(n >= 1 && n <= 5)) return;
      o.rating = n; // sekali saja
    } else {
      return;
    }

    o.updatedAt = Date.now();
    updOrder(o);
    refreshMoney();
    render();
  }

  function sendOrder() {
    var u = me(), d = ST.draft;
    if (!d.from || !d.to) { alert('Pilih titik jemput dan tujuan di peta.'); return; }
    if (d.km == null) { alert('Jarak sedang dihitung, tunggu sebentar.'); return; }
    var fl = (document.getElementById('gdFromLbl').value || '').trim();
    var tl = (document.getElementById('gdToLbl').value || '').trim();
    var nego = parseInt(document.getElementById('gdNego').value, 10) || 0;
    if (nego && nego < MIN_OFFER) { alert('Tawaran minimal ' + rp(MIN_OFFER)); return; }
    var price = nego || priceOf(d.km);

    var o = {
      id: 'GD' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5).toUpperCase(),
      passenger: u, driver: null,
      kind: d.kind, vehicle: d.vehicle,
      from: { lat: d.from.lat, lng: d.from.lng, label: fl },
      to: { lat: d.to.lat, lng: d.to.lng, label: tl },
      km: d.km, price: price,
      offeredBy: 'passenger', status: 'tawar',
      hold: 0, rating: null,
      createdAt: Date.now(), updatedAt: Date.now()
    };
    var a = getOrders();
    a.unshift(o);
    if (!saveOrders(a)) return;
    ST.draft = newDraft();
    ST.sel = o.id;
    ST.view = 'order';
    render();
  }

  function openChat(uid) {
    if (!uid) return;
    closeGD();
    if (typeof window.dkChatOpen === 'function') window.dkChatOpen();
    setTimeout(function () {
      if (typeof window.dkChatOpenRoom === 'function') window.dkChatOpenRoom(uid);
    }, 250);
  }

  /* ---------- peta ---------- */
  function injectLeaflet(cb) {
    if (window.L && window.L.map) { cb(); return; }
    if (!document.getElementById('gd-leaflet-css')) {
      var l = document.createElement('link');
      l.id = 'gd-leaflet-css'; l.rel = 'stylesheet';
      l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(l);
    }
    var s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  function destroyMap() {
    if (ST.map) { try { ST.map.remove(); } catch (e) {} }
    ST.map = null; ST.mF = null; ST.mT = null;
  }

  function initMap() {
    var el = document.getElementById('gdMap');
    if (!el || !window.L) return;
    var c = ST.gps ? [ST.lat, ST.lng] : [DEFAULT_LAT, DEFAULT_LNG];
    ST.map = L.map(el).setView(c, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(ST.map);
    ST.map.on('click', function (e) { setPoint(ST.pick, e.latlng.lat, e.latlng.lng); });
    var d = ST.draft;
    if (d.from) ST.mF = L.marker([d.from.lat, d.from.lng]).addTo(ST.map);
    if (d.to) ST.mT = L.marker([d.to.lat, d.to.lng]).addTo(ST.map);
    setTimeout(function () { if (ST.map) ST.map.invalidateSize(); }, 150);
  }

  function setPoint(kind, lat, lng) {
    var d = ST.draft;
    if (!ST.map) return;
    d[kind] = { lat: lat, lng: lng };
    var key = kind === 'from' ? 'mF' : 'mT';
    if (ST[key]) ST[key].setLatLng([lat, lng]);
    else ST[key] = L.marker([lat, lng]).addTo(ST.map);

    if (kind === 'from' && !d.to) {
      ST.pick = 'to';
      seg('pick', 'to');
    }
    if (d.from && d.to) {
      d.km = null;
      updateSum('Menghitung jarak…');
      routeKm(d.from, d.to, function (km) {
        d.km = Math.max(0.1, Math.ceil(km * 10) / 10);
        updateSum();
      });
    } else {
      updateSum();
    }
  }

  function updateSum(msg) {
    var el = document.getElementById('gdSum');
    if (!el) return;
    var d = ST.draft;
    if (msg) { el.innerHTML = msg; return; }
    if (!d.from || !d.to) { el.innerHTML = 'Pilih <b>titik jemput</b> dan <b>tujuan</b> di peta.'; return; }
    if (d.km == null) { el.innerHTML = 'Menghitung jarak…'; return; }
    el.innerHTML = 'Jarak ~ <b>' + d.km + ' km</b><br>Tarif standar: <b>' + rp(priceOf(d.km)) +
      '</b> <span class="gd-mut">(' + rp(RATE) + '/km)</span>';
  }

  function seg(grp, val) {
    document.querySelectorAll('[data-grp="' + grp + '"]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-v') === val);
    });
  }

  /* ---------- VIEWS ---------- */
  function listItem(o) {
    return '<div class="gd-card gd-row" data-act="open" data-id="' + esc(o.id) + '" style="cursor:pointer">' +
      '<div><b>' + KIND[o.kind] + ' · ' + (o.vehicle === 'mobil' ? '🚗 Mobil' : '🛵 Motor') + '</b>' +
      '<div class="gd-mut">' + esc((o.from && o.from.label) || 'Jemput') + ' → ' + esc((o.to && o.to.label) || 'Tujuan') + '</div></div>' +
      '<div class="gd-right"><b>' + rp(o.price) + '</b><br><span class="gd-badge">' + STATUS[o.status] + '</span></div></div>';
  }

  function vHome() {
    var u = me();
    var mine = getOrders().filter(function (o) { return o.passenger === u || o.driver === u; });
    return '<div class="gd-top"><div class="gd-title">🛵 Go Drive</div>' +
      '<button class="gd-glass gd-back" data-act="close" type="button">✕</button></div>' +
      '<div class="gd-card"><div class="gd-h1">Jemput & antar, motor atau mobil</div>' +
      '<div class="gd-mut">Tarif ' + rp(RATE) + '/km atau nego bebas.</div>' +
      '<div class="gd-mut" style="margin-top:6px">🔒 Saldo penumpang ditahan sampai pesanan selesai dikonfirmasi.</div></div>' +
      '<button class="gd-glass gd-big" data-act="go" data-v="passenger" type="button"><span class="gd-ico">🙋</span>' +
        '<div><b>Saya Penumpang</b><small>Pesan jemput orang atau antar makanan/barang</small></div></button>' +
      '<button class="gd-glass gd-big" data-act="go" data-v="driver" type="button"><span class="gd-ico">🧑‍✈️</span>' +
        '<div><b>Saya Driver</b><small>Online dengan motor atau mobil, terima order</small></div></button>' +
      '<div class="gd-sec">Pesanan saya</div>' +
      (mine.length ? mine.map(listItem).join('') : '<div class="gd-card gd-mut">Belum ada pesanan.</div>');
  }

  function vDriver() {
    var u = me(), p = profile(), av = avgRating(u);
    var all = getOrders();
    var active = all.filter(function (o) {
      return o.driver === u && ['diterima', 'berjalan', 'menunggu_konfirmasi'].indexOf(o.status) >= 0;
    });
    var open = p.online ? all.filter(function (o) {
      return o.status === 'tawar' && o.passenger !== u && o.vehicle === p.vehicle && o.offeredBy === 'passenger';
    }) : [];

    var h = '<div class="gd-top"><button class="gd-glass gd-back" data-act="go" data-v="home" type="button">←</button>' +
      '<div class="gd-title">Mode Driver</div></div>' +
      '<div class="gd-card"><div class="gd-row">' +
        '<button class="gd-glass ' + (p.online ? 'pri' : '') + '" data-act="online" type="button">' + (p.online ? '🟢 Online' : '⚪ Offline') + '</button>' +
        '<div class="gd-right">⭐ ' + (av.n ? av.avg.toFixed(1) + ' (' + av.n + ')' : 'Belum ada rating') + '</div></div>' +
      '<div class="gd-seg">' +
        '<button class="gd-glass' + (p.vehicle === 'motor' ? ' on' : '') + '" data-act="veh" data-grp="veh" data-v="motor" type="button">🛵 Motor</button>' +
        '<button class="gd-glass' + (p.vehicle === 'mobil' ? ' on' : '') + '" data-act="veh" data-grp="veh" data-v="mobil" type="button">🚗 Mobil</button>' +
      '</div></div>';

    if (active.length) {
      h += '<div class="gd-sec">Pesanan aktif</div>' + active.map(function (o) {
        return '<div class="gd-card">' + listItem(o) + '</div>';
      }).join('');
    }

    h += '<div class="gd-sec">Order masuk (' + esc(p.vehicle) + ')</div>';
    if (!p.online) {
      h += '<div class="gd-card gd-mut">Aktifkan Online untuk menerima order.</div>';
    } else if (!open.length) {
      h += '<div class="gd-card gd-mut">Belum ada order di kendaraan ini.</div>';
    } else {
      h += open.map(function (o) {
        return '<div class="gd-card">' +
          '<b>' + KIND[o.kind] + '</b> · ' + (o.vehicle === 'mobil' ? '🚗' : '🛵') + ' · ' + o.km + ' km' +
          '<div class="gd-mut">' + esc((o.from && o.from.label) || 'Titik jemput') + ' → ' + esc((o.to && o.to.label) || 'Tujuan') + '</div>' +
          '<div class="gd-big-price" style="font-size:18px">' + rp(o.price) + '</div>' +
          '<div class="gd-seg">' +
            '<button class="gd-glass pri" data-act="accept" data-id="' + esc(o.id) + '" type="button">✅ Terima</button>' +
            '<button class="gd-glass" data-act="counter" data-id="' + esc(o.id) + '" type="button">🔁 Tawar balik</button>' +
          '</div></div>';
      }).join('');
    }
    return h;
  }

  function vPassenger() {
    var d = ST.draft;
    return '<div class="gd-top"><button class="gd-glass gd-back" data-act="go" data-v="home" type="button">←</button>' +
      '<div class="gd-title">Pesan Go Drive</div></div>' +
      '<div class="gd-card">' +
        '<div class="gd-lbl">Layanan</div>' +
        '<div class="gd-seg">' +
          '<button class="gd-glass' + (d.kind === 'jemput' ? ' on' : '') + '" data-act="kind" data-grp="kind" data-v="jemput" type="button">🙋 Jemput orang</button>' +
          '<button class="gd-glass' + (d.kind === 'antar' ? ' on' : '') + '" data-act="kind" data-grp="kind" data-v="antar" type="button">🍱 Antar makanan/barang</button>' +
        '</div>' +
        '<div class="gd-lbl">Kendaraan</div>' +
        '<div class="gd-seg">' +
          '<button class="gd-glass' + (d.vehicle === 'motor' ? ' on' : '') + '" data-act="pveh" data-grp="pveh" data-v="motor" type="button">🛵 Motor</button>' +
          '<button class="gd-glass' + (d.vehicle === 'mobil' ? ' on' : '') + '" data-act="pveh" data-grp="pveh" data-v="mobil" type="button">🚗 Mobil</button>' +
        '</div>' +
        '<div class="gd-lbl">Titik di peta (ketuk peta)</div>' +
        '<div class="gd-seg">' +
          '<button class="gd-glass' + (ST.pick === 'from' ? ' on' : '') + '" data-act="pick" data-grp="pick" data-v="from" type="button">📍 Titik jemput</button>' +
          '<button class="gd-glass' + (ST.pick === 'to' ? ' on' : '') + '" data-act="pick" data-grp="pick" data-v="to" type="button">🏁 Tujuan</button>' +
        '</div>' +
        '<div id="gdMap"></div>' +
        '<input class="gd-in" id="gdFromLbl" placeholder="Patokan jemput (mis. depan Indomaret)" maxlength="80">' +
        '<input class="gd-in" id="gdToLbl" placeholder="Patokan tujuan" maxlength="80">' +
        '<div class="gd-sum" id="gdSum"></div>' +
        '<div class="gd-lbl">Nego (opsional, min ' + rp(MIN_OFFER) + ')</div>' +
        '<input class="gd-in" id="gdNego" type="number" inputmode="numeric" placeholder="Kosongkan = tarif standar">' +
        '<button class="gd-glass pri gd-wide" data-act="send" type="button">Kirim Pesanan</button>' +
        '<p class="gd-mut" style="margin-top:8px">Saldo Anda ditahan saat driver menerima, dan baru dilepas setelah Anda konfirmasi selesai.</p>' +
      '</div>';
  }

  function vOrder() {
    var o = findOrder(ST.sel);
    var back = '<div class="gd-top"><button class="gd-glass gd-back" data-act="go" data-v="home" type="button">←</button>' +
      '<div class="gd-title">Detail Pesanan</div></div>';
    if (!o) return back + '<div class="gd-card gd-mut">Pesanan tidak ditemukan.</div>';

    var u = me(), isP = o.passenger === u, isD = !isP && o.driver === u;
    var acts = '', info = '';
    function btn(a, lbl, cls) {
      return '<button class="gd-glass ' + (cls || '') + ' gd-wide" data-act="' + a + '" data-id="' + esc(o.id) + '" type="button">' + lbl + '</button>';
    }

    if (o.status === 'tawar') {
      if (isP) {
        if (o.offeredBy === 'driver') acts += btn('accept', '✅ Setuju ' + rp(o.price), 'pri') + btn('counter', '🔁 Tawar balik');
        else info = 'Menunggu respons driver…';
        acts += btn('cancel', '❌ Batalkan');
      } else {
        if (o.offeredBy === 'passenger') acts += btn('accept', '✅ Terima ' + rp(o.price), 'pri') + btn('counter', '🔁 Tawar balik');
        else info = 'Menunggu respons penumpang…';
      }
    } else if (o.status === 'diterima') {
      if (isD) acts += btn('pickup', '🛵 Mulai jalan', 'pri') + btn('cancel', '❌ Batalkan (saldo dikembalikan)');
      else if (isP) { info = 'Driver sedang menuju lokasi.'; acts += btn('cancel', '❌ Batalkan (saldo dikembalikan)'); }
    } else if (o.status === 'berjalan') {
      if (isD) acts += btn('finish', '🏁 Sudah sampai / selesai', 'pri');
      else if (isP) info = 'Sedang dalam perjalanan.';
    } else if (o.status === 'menunggu_konfirmasi') {
      if (isP) acts += btn('release', '🔓 Konfirmasi selesai & lepas saldo', 'pri');
      else if (isD) info = 'Menunggu penumpang mengonfirmasi.';
    } else if (o.status === 'selesai') {
      if (isP && !o.rating) {
        info = '<div class="gd-lbl">Beri rating driver (sekali saja)</div><div class="gd-stars">' +
          [1, 2, 3, 4, 5].map(function (n) {
            return '<button class="gd-glass gd-star" data-act="rate" data-id="' + esc(o.id) + '" data-v="' + n + '" type="button">★</button>';
          }).join('') + '</div>';
      } else if (isP) {
        info = '⭐ Rating Anda: ' + o.rating + ' dari 5';
      }
    }

    if (o.driver && (isP || isD)) {
      acts += '<button class="gd-glass gd-wide" data-act="chat" data-uid="' + esc(isP ? o.driver : o.passenger) + '" type="button">💬 Chat</button>';
    }

    var holdTxt = o.hold > 0 ? '🔒 Ditahan (escrow): ' + rp(o.hold)
      : (o.status === 'selesai' ? '✅ Saldo sudah dilepas ke driver' : '');

    return back +
      '<div class="gd-card">' +
        '<div class="gd-h2">' + KIND[o.kind] + ' · ' + (o.vehicle === 'mobil' ? '🚗 Mobil' : '🛵 Motor') + '</div>' +
        '<span class="gd-badge">' + STATUS[o.status] + '</span>' +
        '<div class="gd-lbl">Jemput</div><div>' + esc((o.from && o.from.label) || '-') +
          ' <span class="gd-mut">(' + o.from.lat.toFixed(5) + ', ' + o.from.lng.toFixed(5) + ')</span></div>' +
        '<div class="gd-lbl">Tujuan</div><div>' + esc((o.to && o.to.label) || '-') +
          ' <span class="gd-mut">(' + o.to.lat.toFixed(5) + ', ' + o.to.lng.toFixed(5) + ')</span></div>' +
        '<div class="gd-lbl">Jarak</div><div>' + o.km + ' km</div>' +
        '<div class="gd-lbl">Harga</div><div class="gd-big-price">' + rp(o.price) + '</div>' +
        (holdTxt ? '<div class="gd-mut" style="margin-top:4px">' + holdTxt + '</div>' : '') +
        '<div class="gd-mut" style="margin-top:4px">Penawaran terakhir: ' + (o.offeredBy === 'passenger' ? 'Penumpang' : 'Driver') + '</div>' +
        (info ? '<div style="margin-top:10px">' + info + '</div>' : '') +
        '<div class="gd-acts">' + acts + '</div>' +
        '<a class="gd-glass gd-wide" style="text-decoration:none;margin-top:10px" target="_blank" rel="noopener" ' +
          'href="https://www.google.com/maps/dir/' + o.from.lat + ',' + o.from.lng + '/' + o.to.lat + ',' + o.to.lng + '">🗺️ Buka rute di Google Maps</a>' +
      '</div>';
  }

  function render() {
    var b = document.getElementById('gdBody');
    if (!b) return;
    destroyMap();
    var h;
    if (ST.view === 'driver') h = vDriver();
    else if (ST.view === 'passenger') h = vPassenger();
    else if (ST.view === 'order') h = vOrder();
    else h = vHome();
    b.innerHTML = h;
    if (ST.view === 'passenger') {
      injectLeaflet(function () { initMap(); updateSum(); });
      updateSum();
    }
  }

  /* ---------- DOM / CSS ---------- */
  function injectCSS() {
    if (document.getElementById('gd-styles')) return;
    var s = document.createElement('style');
    s.id = 'gd-styles';
    s.textContent = `
      .gd-ov{display:none;position:fixed;inset:0;z-index:99998;overflow-y:auto;color:#1e293b;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;
        background:
          radial-gradient(ellipse 90% 60% at 10% 0%,rgba(167,139,250,.28),transparent 55%),
          radial-gradient(ellipse 70% 50% at 95% 15%,rgba(96,165,250,.22),transparent 50%),
          radial-gradient(ellipse 60% 45% at 50% 100%,rgba(52,211,153,.18),transparent 50%),
          linear-gradient(165deg,#eef2ff 0%,#e0f2fe 45%,#f0fdf4 100%)}
      .gd-ov.gd-open{display:block}
      .gd-app{max-width:480px;margin:0 auto;padding:calc(14px + env(safe-area-inset-top)) 14px 40px;display:flex;flex-direction:column;gap:12px}
      .gd-top{display:flex;align-items:center;gap:10px}
      .gd-title{flex:1;font-size:18px;font-weight:800}
      .gd-h1{font-size:18px;font-weight:800;margin-bottom:4px}
      .gd-h2{font-weight:800;font-size:16px;margin-bottom:6px}
      .gd-card{background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.6);border-radius:22px;padding:14px;
        backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);
        box-shadow:0 10px 30px rgba(15,23,42,.07),inset 0 1px 0 rgba(255,255,255,.7)}
      .gd-glass{background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.6);color:#1e293b;border-radius:18px;
        padding:12px 14px;font:inherit;font-weight:700;font-size:14px;cursor:pointer;
        backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
        box-shadow:0 8px 22px rgba(15,23,42,.08),inset 0 1px 0 rgba(255,255,255,.7);
        display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all .18s}
      .gd-glass:active{transform:scale(.97)}
      .gd-glass.pri{background:linear-gradient(135deg,rgba(167,139,250,.6),rgba(52,211,153,.5));color:#fff;
        text-shadow:0 1px 2px rgba(0,0,0,.15);border-color:rgba(255,255,255,.75)}
      .gd-glass.on{background:rgba(255,255,255,.55);border-color:rgba(167,139,250,.6);
        box-shadow:0 0 0 2px rgba(167,139,250,.35),0 8px 22px rgba(15,23,42,.08)}
      .gd-glass.gd-back{width:42px;height:42px;padding:0;border-radius:14px}
      .gd-big{width:100%;justify-content:flex-start;padding:16px;border-radius:24px;text-align:left}
      .gd-big b{display:block;font-size:15px}
      .gd-big small{display:block;color:#64748b;font-weight:500;font-size:12px;margin-top:2px}
      .gd-ico{font-size:28px;width:50px;height:50px;border-radius:16px;display:flex;align-items:center;justify-content:center;
        background:rgba(255,255,255,.35);flex-shrink:0}
      .gd-wide{width:100%;margin-top:8px}
      .gd-seg{display:flex;gap:8px;margin:8px 0;flex-wrap:wrap}
      .gd-seg>.gd-glass{flex:1;min-width:120px}
      .gd-row{display:flex;justify-content:space-between;align-items:center;gap:10px}
      .gd-right{text-align:right}
      .gd-mut{color:#64748b;font-size:12px;line-height:1.45}
      .gd-lbl{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.6px;font-weight:700;margin:10px 0 4px}
      .gd-sec{font-weight:800;font-size:14px;margin-top:6px}
      .gd-badge{display:inline-block;font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px;
        background:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.8);color:#047857}
      .gd-in{width:100%;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.8);
        background:rgba(255,255,255,.35);color:#1e293b;font:inherit;font-size:14px;margin-bottom:8px;box-sizing:border-box}
      #gdMap{height:220px;border-radius:18px;overflow:hidden;margin:8px 0;border:1px solid rgba(255,255,255,.7)}
      .gd-sum{background:rgba(255,255,255,.3);border-radius:14px;padding:10px 12px;font-size:13px;line-height:1.5;margin-bottom:8px}
      .gd-big-price{font-size:22px;font-weight:800;color:#059669}
      .gd-acts{display:flex;flex-direction:column}
      .gd-stars{display:flex;gap:6px;justify-content:center}
      .gd-star{font-size:22px;padding:8px 12px;color:#D97706}
      #gd-topbar-btn{background:rgba(224,231,255,.7)!important;border-color:rgba(129,140,248,.45)!important;color:#4F46E5}
      #gd-topbar-btn svg{stroke:#4F46E5;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}
      #gd-topbar-btn .lbl{color:#4F46E5}
    `;
    document.head.appendChild(s);
  }

  function injectModal() {
    if (document.getElementById('gdOv')) return;
    var ov = document.createElement('div');
    ov.className = 'gd-ov';
    ov.id = 'gdOv';
    ov.innerHTML = '<div class="gd-app" id="gdBody"></div>';
    document.body.appendChild(ov);
    document.getElementById('gdBody').addEventListener('click', onClick);
  }

  function onClick(ev) {
    var el = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!el) return;
    var a = el.getAttribute('data-act');
    var v = el.getAttribute('data-v');
    var id = el.getAttribute('data-id');
    var grp = el.getAttribute('data-grp');

    if (a === 'close') closeGD();
    else if (a === 'go') {
      ST.view = v;
      if (v === 'passenger' && !ST.draft) ST.draft = newDraft();
      if (v === 'passenger') ST.pick = 'from';
      render();
    }
    else if (a === 'open') { ST.sel = id; ST.view = 'order'; render(); }
    else if (a === 'online') { var p = profile(); p.online = !p.online; saveProfile(p); render(); }
    else if (a === 'veh') { var p2 = profile(); p2.vehicle = v; saveProfile(p2); render(); }
    else if (a === 'kind') { ST.draft.kind = v; seg(grp, v); }
    else if (a === 'pveh') { ST.draft.vehicle = v; seg(grp, v); }
    else if (a === 'pick') { ST.pick = v; seg(grp, v); }
    else if (a === 'send') sendOrder();
    else if (a === 'counter') {
      var val = prompt('Tawaran harga baru (Rp), min ' + rp(MIN_OFFER) + ':');
      if (val) act('counter', id, val);
    }
    else if (a === 'chat') openChat(el.getAttribute('data-uid'));
    else if (['accept', 'cancel', 'pickup', 'finish', 'release', 'rate'].indexOf(a) >= 0) act(a, id, v);
  }

  function seg2(grp, val) { seg(grp, val); }

  function openGD() {
    if (!me()) { alert('Login dulu untuk memakai Go Drive.'); return; }
    injectCSS();
    injectModal();
    ST.view = 'home';
    document.getElementById('gdOv').classList.add('gd-open');
    render();
    getGPS();
  }
  function closeGD() {
    destroyMap();
    var ov = document.getElementById('gdOv');
    if (ov) ov.classList.remove('gd-open');
  }

  function getGPS() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(function (p) {
      ST.lat = p.coords.latitude; ST.lng = p.coords.longitude; ST.gps = true;
    }, function () {}, { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 });
  }

  function injectButton() {
    if (document.getElementById('gd-topbar-btn')) return true;
    var c = document.querySelector('.header-actions');
    if (!c) return false;
    var b = document.createElement('button');
    b.id = 'gd-topbar-btn';
    b.type = 'button';
    b.title = 'Go Drive';
    b.innerHTML =
      '<svg viewBox="0 0 24 24" width="17" height="17"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/>' +
      '<path d="M6 17h4l3-6h4l2 3M9 11l2-4h3"/></svg><span class="lbl">Drive</span>';
    b.onclick = openGD;
    c.insertBefore(b, c.lastElementChild);
    return true;
  }

  function boot() {
    injectCSS();
    injectButton();
    setInterval(function () {
      if (me()) injectButton();
      else { var b = document.getElementById('gd-topbar-btn'); if (b) b.remove(); }
    }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  console.log('[GoDrive] motor/mobil · escrow · rate Rp 3.000/km ✅');
})();
