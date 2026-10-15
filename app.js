/* ============================================================
   DOMPETKU — Web3 Wallet Core (localStorage + iPaymu sandbox)
   Auth · Balance · TopUp (iPaymu) · Transfer antar-ID · QR · History · Chart
   Top-up & status menunggu konfirmasi server iPaymu.
   Transfer antar Wallet ID tetap instan (lokal).
   ============================================================ */
(function () {
  'use strict';

  // ---------- iPaymu SANDBOX CREDENTIALS (dari dashboard Integrasi) ----------
  // Ganti ke production VA + API Key + URL saat live.
  var IPAYMU = {
    va: '0000005768300255',
    apiKey: 'SANDBOXA973D2BD-D38E-4062-9C46-90F8E649E2B2',
    base: 'https://sandbox.ipaymu.com/api/v2',
    // notifyUrl dummy — status dicek via polling / Cek Status
    notifyUrl: 'https://preski08.github.io/Dompetku/notify'
  };

  // ---------- STORAGE HELPERS ----------
  function rd(k, d) {
    try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; }
  }
  function wr(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {
      alert('Penyimpanan penuh. Hapus data lama.');
    }
  }

  var USERS_KEY = 'dk_users';
  var SESSION_KEY = 'dk_session';
  var TX_KEY = 'dk_tx';
  var PENDING_KEY = 'dk_pending_topup';
  var currentUser = null;
  var chartInstance = null;
  var scanStream = null;
  var facingMode = 'environment';
  var expMode = null; // 'scan' | 'upload' | 'id'
  var expTarget = null;
  var activeTopup = null; // { trxId, amount, desc, method, referenceId }

  // ---------- BOOT ----------
  function purgeBots() {
    try {
      var us = rd('dk_users', []);
      if (Array.isArray(us) && us.some(function (u) { return u && u.ghost; })) {
        wr('dk_users', us.filter(function (u) { return u && !u.ghost; }));
      }
      var mk = rd('dk_marketplace', []);
      if (Array.isArray(mk)) {
        var c = mk.filter(function (x) { return x && String(x.id || '').indexOf('mp-demo') !== 0; });
        if (c.length !== mk.length) wr('dk_marketplace', c);
      }
    } catch (e) {}
  }

  function boot() {
    purgeBots();
    var s = rd(SESSION_KEY, null);
    if (s && s.id) {
      currentUser = s;
      showApp();
      // cek pending top-up yang mungkin sudah dibayar
      checkPendingTopups();
    } else {
      showAuth();
    }
  }

  function showAuth() {
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('app-screen').classList.remove('active');
  }
  function showApp() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    renderHeader();
    renderBalance();
    renderHistory();
    renderChart();
  }

  // ---------- AUTH ----------
  window.toggleAuth = function () {
    var login = document.getElementById('login-box');
    var reg = document.getElementById('register-box');
    if (login.style.display === 'none') {
      login.style.display = '';
      reg.style.display = 'none';
    } else {
      login.style.display = 'none';
      reg.style.display = '';
    }
  };

  window.handleRegister = function () {
    var id = (document.getElementById('reg-id').value || '').trim().toLowerCase();
    var pw = document.getElementById('reg-pw').value || '';
    if (id.length < 3) { alert('Wallet ID minimal 3 karakter'); return; }
    if (pw.length < 6) { alert('Passphrase minimal 6 karakter'); return; }
    var users = rd(USERS_KEY, []);
    if (users.some(function (u) { return u.id === id; })) {
      alert('Wallet ID sudah dipakai'); return;
    }
    users.push({ id: id, pw: pw, balance: 0, created: Date.now() });
    wr(USERS_KEY, users);
    alert('Wallet berhasil dibuat!');
    document.getElementById('login-id').value = id;
    document.getElementById('login-pw').value = pw;
    toggleAuth();
  };

  window.handleLogin = function () {
    var id = (document.getElementById('login-id').value || '').trim().toLowerCase();
    var pw = document.getElementById('login-pw').value || '';
    var users = rd(USERS_KEY, []);
    var u = users.find(function (x) { return x.id === id && x.pw === pw; });
    if (!u) { alert('Wallet ID atau passphrase salah'); return; }
    currentUser = { id: u.id };
    wr(SESSION_KEY, currentUser);
    showApp();
    checkPendingTopups();
  };

  window.handleLogout = function () {
    currentUser = null;
    wr(SESSION_KEY, null);
    showAuth();
  };

  function getUser(id) {
    var users = rd(USERS_KEY, []);
    return users.find(function (u) { return u.id === id; }) || null;
  }
  function updateBalance(id, delta) {
    var users = rd(USERS_KEY, []);
    var u = users.find(function (x) { return x.id === id; });
    if (!u) return false;
    u.balance = Math.max(0, (u.balance || 0) + delta);
    wr(USERS_KEY, users);
    return true;
  }
  function getBalance(id) {
    var u = getUser(id);
    return u ? (u.balance || 0) : 0;
  }

  // ---------- UI RENDER ----------
  function renderHeader() {
    if (!currentUser) return;
    var av = document.getElementById('avatar');
    var uid = document.getElementById('uid-display');
    var hero = document.getElementById('hero-uid');
    var puid = document.getElementById('portfolio-uid');
    if (av) av.textContent = currentUser.id.charAt(0).toUpperCase();
    if (uid) uid.textContent = currentUser.id;
    if (hero) hero.textContent = currentUser.id;
    if (puid) puid.textContent = currentUser.id;
  }

  function fmtRp(n) {
    if (typeof window.dkFmtMoney === 'function') return window.dkFmtMoney(n);
    return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
  }

  function renderBalance() {
    if (!currentUser) return;
    var el = document.getElementById('balance-display');
    if (el) el.textContent = fmtRp(getBalance(currentUser.id));
  }

  function renderHistory() {
    if (!currentUser) return;
    var list = document.getElementById('history-list');
    if (!list) return;
    var txs = (rd(TX_KEY, {})[currentUser.id] || []).slice(0, 30);
    if (!txs.length) {
      list.innerHTML = '<div class="empty-history">Belum ada transaksi</div>';
      return;
    }
    list.innerHTML = '';
    txs.forEach(function (tx) {
      var isIn = tx.type === 'in';
      var cls = tx.status === 'pending' ? 'pend' : (isIn ? 'inc' : 'exp');
      var sign = isIn ? '+' : '−';
      var d = document.createElement('div');
      d.className = 'hist-item';
      d.onclick = function () { showNota(tx); };
      d.innerHTML =
        '<div class="d"><h4>' + esc(tx.desc || (isIn ? 'Masuk' : 'Keluar')) + '</h4>' +
        '<p>' + new Date(tx.ts).toLocaleString('id-ID') + (tx.to ? ' · → ' + esc(tx.to) : '') + (tx.from ? ' · ← ' + esc(tx.from) : '') +
        (tx.trxId ? ' · #' + esc(String(tx.trxId)) : '') + '</p></div>' +
        '<div class="amt ' + cls + '">' + sign + ' ' + fmtRp(tx.amount) + '</div>';
      list.appendChild(d);
    });
  }

  function renderChart() {
    if (!currentUser) return;
    var canvas = document.getElementById('financeChart');
    if (!canvas || typeof Chart === 'undefined') return;
    var txs = rd(TX_KEY, {})[currentUser.id] || [];
    var inSum = 0, outSum = 0;
    txs.forEach(function (t) {
      if (t.status === 'pending') return;
      if (t.type === 'in') inSum += t.amount;
      else outSum += t.amount;
    });
    var total = inSum + outSum;
    var pctIn = total ? Math.round((inSum / total) * 100) : 0;
    var pctOut = total ? Math.round((outSum / total) * 100) : 0;
    var elIn = document.getElementById('pct-in');
    var elOut = document.getElementById('pct-out');
    if (elIn) elIn.textContent = pctIn + '%';
    if (elOut) elOut.textContent = pctOut + '%';

    if (chartInstance) chartInstance.destroy();
    var lblIn = (typeof window.dkT === 'function' ? window.dkT('income') : 'Pemasukan');
    var lblOut = (typeof window.dkT === 'function' ? window.dkT('expense') : 'Pengeluaran');
    chartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: [lblIn, lblOut],
        datasets: [{
          data: [inSum || 1, outSum || 1],
          backgroundColor: ['#00BA7C', '#F4212E'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { color: '#71767B' } } },
        cutout: '68%'
      }
    });
    renderMonthButtons(txs);
    populatePdfSelects();
  }

  function renderMonthButtons(txs) {
    var box = document.getElementById('month-btns');
    var sumEl = document.getElementById('month-summary');
    if (!box) return;
    var months = {};
    (txs || []).forEach(function (t) {
      if (t.status === 'pending') return;
      var d = new Date(t.ts);
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      if (!months[key]) months[key] = { in: 0, out: 0, label: d.toLocaleString('id-ID', { month: 'short', year: 'numeric' }) };
      if (t.type === 'in') months[key].in += t.amount;
      else months[key].out += t.amount;
    });
    var keys = Object.keys(months).sort().reverse().slice(0, 6);
    if (!keys.length) {
      box.innerHTML = '';
      if (sumEl) sumEl.style.display = 'none';
      return;
    }
    box.innerHTML = '';
    keys.forEach(function (k, i) {
      var b = document.createElement('button');
      b.className = 'month-btn' + (i === 0 ? ' active' : '');
      b.textContent = months[k].label;
      b.onclick = function () {
        box.querySelectorAll('.month-btn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        showMonthSummary(months[k]);
      };
      box.appendChild(b);
    });
    showMonthSummary(months[keys[0]]);
  }


  function populatePdfSelects() {
    var mEl = document.getElementById('pdf-month');
    var yEl = document.getElementById('pdf-year');
    if (!mEl || !yEl) return;
    var months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    var now = new Date();
    if (!mEl.options.length) {
      months.forEach(function (name, i) {
        var o = document.createElement('option');
        o.value = String(i + 1);
        o.textContent = name;
        if (i === now.getMonth()) o.selected = true;
        mEl.appendChild(o);
      });
    }
    if (!yEl.options.length) {
      var y = now.getFullYear();
      for (var i = y; i >= y - 5; i--) {
        var o = document.createElement('option');
        o.value = String(i);
        o.textContent = String(i);
        if (i === y) o.selected = true;
        yEl.appendChild(o);
      }
    }
  }

  window.downloadMonthPDF = function () {
    if (!currentUser) return;
    var mEl = document.getElementById('pdf-month');
    var yEl = document.getElementById('pdf-year');
    var month = parseInt((mEl && mEl.value) || (new Date().getMonth() + 1), 10);
    var year = parseInt((yEl && yEl.value) || new Date().getFullYear(), 10);
    var txs = (rd(TX_KEY, {})[currentUser.id] || []).filter(function (t) {
      if (t.status === 'pending') return false;
      var d = new Date(t.ts);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });
    var inSum = 0, outSum = 0;
    txs.forEach(function (t) {
      if (t.type === 'in') inSum += t.amount;
      else outSum += t.amount;
    });
    var net = inSum - outSum;
    var monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    var label = monthNames[month - 1] + ' ' + year;

    if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
      // fallback: printable HTML
      var w = window.open('', '_blank');
      if (!w) { alert('Izinkan popup untuk unduh PDF'); return; }
      var rows = txs.map(function (t) {
        var sign = t.type === 'in' ? '+' : '-';
        return '<tr><td>' + new Date(t.ts).toLocaleString('id-ID') + '</td><td>' +
          (t.desc || '') + '</td><td style="text-align:right">' + sign + ' ' + fmtRp(t.amount) + '</td></tr>';
      }).join('');
      w.document.write('<html><head><title>Laporan ' + label + '</title><style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:8px;font-size:12px}h1{font-size:18px}</style></head><body>');
      w.document.write('<h1>Laporan Keuangan Dompetku</h1><p>Wallet: <b>' + currentUser.id + '</b> · ' + label + '</p>');
      w.document.write('<p>Pemasukan: <b>' + fmtRp(inSum) + '</b><br>Pengeluaran: <b>' + fmtRp(outSum) + '</b><br>Netto: <b>' + fmtRp(net) + '</b></p>');
      w.document.write('<table><thead><tr><th>Waktu</th><th>Keterangan</th><th>Nominal</th></tr></thead><tbody>' + rows + '</tbody></table>');
      w.document.write('</body></html>');
      w.document.close();
      setTimeout(function () { w.print(); }, 400);
      return;
    }

    var JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    var doc = new JsPDF({ unit: 'pt', format: 'a4' });
    var y = 48;
    doc.setFontSize(16);
    doc.text('Laporan Keuangan Dompetku', 40, y); y += 22;
    doc.setFontSize(11);
    doc.text('Wallet: ' + currentUser.id, 40, y); y += 16;
    doc.text('Periode: ' + label, 40, y); y += 20;
    doc.text('Pemasukan: ' + fmtRp(inSum), 40, y); y += 14;
    doc.text('Pengeluaran: ' + fmtRp(outSum), 40, y); y += 14;
    doc.text('Netto: ' + fmtRp(net), 40, y); y += 24;
    doc.setFontSize(10);
    doc.text('Detail transaksi:', 40, y); y += 16;
    if (!txs.length) {
      doc.text('(Tidak ada transaksi di periode ini)', 40, y);
    } else {
      txs.slice(0, 40).forEach(function (t) {
        if (y > 780) { doc.addPage(); y = 48; }
        var sign = t.type === 'in' ? '+' : '-';
        var line = new Date(t.ts).toLocaleDateString('id-ID') + '  ' +
          sign + ' ' + fmtRp(t.amount) + '  ' + (t.desc || '').slice(0, 50);
        doc.text(line, 40, y);
        y += 14;
      });
    }
    doc.save('dompetku-laporan-' + year + '-' + String(month).padStart(2, '0') + '.pdf');
  };

  function showMonthSummary(m) {
    var sumEl = document.getElementById('month-summary');
    if (!sumEl || !m) return;
    var net = m.in - m.out;
    var tInc = (typeof window.dkT === 'function' ? window.dkT('income') : 'Pemasukan');
    var tExp = (typeof window.dkT === 'function' ? window.dkT('expense') : 'Pengeluaran');
    var tNet = (typeof window.dkT === 'function' ? window.dkT('net') : 'Netto');
    sumEl.style.display = '';
    sumEl.innerHTML =
      '<div class="ms-row"><span>' + tInc + '</span><span style="color:#00BA7C">' + fmtRp(m.in) + '</span></div>' +
      '<div class="ms-row"><span>' + tExp + '</span><span style="color:#F4212E">' + fmtRp(m.out) + '</span></div>' +
      '<div class="ms-row"><span>' + tNet + '</span><span style="color:' + (net >= 0 ? '#00BA7C' : '#F4212E') + '">' + fmtRp(net) + '</span></div>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- iPaymu HELPERS (signature + request) ----------
  function sha256Hex(str) {
    // Use SubtleCrypto if available, else fallback simple (for demo)
    if (window.crypto && window.crypto.subtle) {
      return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
        .then(function (buf) {
          return Array.from(new Uint8Array(buf)).map(function (b) {
            return b.toString(16).padStart(2, '0');
          }).join('');
        });
    }
    // fallback: load crypto-js if needed
    return Promise.reject(new Error('Browser tidak support Web Crypto'));
  }

  function hmacSha256Hex(key, message) {
    if (window.crypto && window.crypto.subtle) {
      return window.crypto.subtle.importKey(
        'raw', new TextEncoder().encode(key),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      ).then(function (cryptoKey) {
        return window.crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
      }).then(function (sig) {
        return Array.from(new Uint8Array(sig)).map(function (b) {
          return b.toString(16).padStart(2, '0');
        }).join('');
      });
    }
    return Promise.reject(new Error('Browser tidak support Web Crypto'));
  }

  function makeTimestamp() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
      p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function ipaymuRequest(path, body) {
    var method = 'POST';
    var bodyStr = JSON.stringify(body);
    return sha256Hex(bodyStr).then(function (bodyHash) {
      var stringToSign = method + ':' + IPAYMU.va + ':' + bodyHash + ':' + IPAYMU.apiKey;
      return hmacSha256Hex(IPAYMU.apiKey, stringToSign).then(function (signature) {
        return fetch(IPAYMU.base + path, {
          method: method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'va': IPAYMU.va,
            'signature': signature,
            'timestamp': makeTimestamp()
          },
          body: bodyStr
        }).then(function (r) { return r.json(); });
      });
    });
  }

  function checkTransaction(trxId) {
    return ipaymuRequest('/transaction', { transactionId: String(trxId) });
  }

  // ---------- TOP UP (iPaymu) ----------
  window.openTopup = function () {
    document.getElementById('topup-amount').value = '';
    document.getElementById('topup-desc').value = 'Top up saldo Dompetku';
    document.getElementById('topup-method').value = 'qris';
    onMethodChange();
    document.getElementById('topup-modal').classList.add('active');
  };
  window.closeTopup = function () {
    document.getElementById('topup-modal').classList.remove('active');
  };
  window.onMethodChange = function () {
    var m = document.getElementById('topup-method').value;
    document.getElementById('bank-field').style.display = m === 'va' ? '' : 'none';
  };

  window.submitTopup = function () {
    if (!currentUser) return;
    var amt = parseInt(document.getElementById('topup-amount').value, 10) || 0;
    var desc = (document.getElementById('topup-desc').value || 'Top up').trim();
    var method = document.getElementById('topup-method').value;
    if (amt < 10000) { alert('Minimal top up Rp 10.000 (batas iPaymu)'); return; }
    if (amt > 5000000) { alert('Maksimal top up Rp 5.000.000'); return; }

    var btn = document.getElementById('topup-btn');
    var oldText = btn.textContent;
    btn.textContent = 'Memproses...';
    btn.disabled = true;

    var refId = 'DK-' + currentUser.id + '-' + Date.now();
    var paymentMethod = method === 'qris' ? 'qris' : 'va';
    var paymentChannel = method === 'qris' ? 'mpm' : (document.getElementById('topup-bank').value || 'bca');

    var body = {
      name: currentUser.id,
      phone: '08123456789',
      email: currentUser.id + '@dompetku.local',
      amount: amt,
      notifyUrl: IPAYMU.notifyUrl,
      expired: 2,
      expiredType: 'hours',
      comments: desc + ' | wallet:' + currentUser.id,
      referenceId: refId,
      paymentMethod: paymentMethod,
      paymentChannel: paymentChannel,
      product: ['Top Up Dompetku'],
      qty: [1],
      price: [amt]
    };

    ipaymuRequest('/payment/direct', body).then(function (res) {
      btn.textContent = oldText;
      btn.disabled = false;
      if (!res || (res.Status !== 200 && !res.Success)) {
        var msg = (res && (res.Message || res.message)) || 'Gagal membuat pembayaran';
        alert('❌ iPaymu: ' + msg);
        console.error('[iPaymu]', res);
        return;
      }
      var data = res.Data || res.data || {};
      var trxId = data.TransactionId || data.transactionId;
      if (!trxId) {
        alert('Respons iPaymu tidak lengkap. Coba lagi.');
        console.error(res);
        return;
      }

      activeTopup = {
        trxId: trxId,
        amount: amt,
        desc: desc,
        method: method,
        referenceId: refId,
        userId: currentUser.id,
        paymentNo: data.PaymentNo || data.paymentNo || '',
        paymentName: data.PaymentName || data.paymentName || '',
        channel: data.Channel || data.channel || paymentChannel,
        url: data.Url || data.url || '',
        expired: data.Expired || data.expired || '',
        total: data.Total || amt,
        fee: data.Fee || 0,
        qrImage: data.QrImage || data.qrImage || data.QRImage || '',
        qrString: data.QrString || data.qrString || data.QRString || data.QrCode || data.qrCode || ''
      };

      // simpan pending
      var pending = rd(PENDING_KEY, {});
      pending[String(trxId)] = activeTopup;
      wr(PENDING_KEY, pending);

      // catat pending di history
      addTx(currentUser.id, {
        type: 'in',
        amount: amt,
        desc: desc + ' (' + method.toUpperCase() + ' · menunggu)',
        status: 'pending',
        trxId: trxId,
        referenceId: refId
      });
      renderHistory();

      closeTopup();
      showPaymentScreen(activeTopup);
    }).catch(function (err) {
      btn.textContent = oldText;
      btn.disabled = false;
      alert('Gagal hubungi iPaymu: ' + (err.message || err));
      console.error(err);
    });
  };

  function showPaymentScreen(info) {
    var body = document.getElementById('pay-body');
    var title = document.getElementById('pay-title');
    title.textContent = info.method === 'qris' ? 'Bayar via QRIS (iPaymu)' : 'Virtual Account (iPaymu)';

    var html = '';
    html += '<div class="target-box"><span class="tg-label">Trx ID</span><b>#' + esc(String(info.trxId)) + '</b></div>';
    html += '<div class="target-box"><span class="tg-label">Nominal</span><b>' + fmtRp(info.total || info.amount) + '</b></div>';
    if (info.fee) {
      html += '<div class="target-box"><span class="tg-label">Biaya</span><b>' + fmtRp(info.fee) + '</b></div>';
    }

    if (info.method === 'va' || (info.paymentNo && info.method !== 'qris')) {
      html += '<div class="target-box"><span class="tg-label">Bank / Channel</span><b>' + esc((info.channel || '').toUpperCase()) + '</b></div>';
      html += '<div class="target-box"><span class="tg-label">No. VA / Payment</span><b style="font-size:16px">' + esc(info.paymentNo || '-') + '</b></div>';
      if (info.paymentName) {
        html += '<p class="hint center">' + esc(info.paymentName) + '</p>';
      }
      html += '<p class="hint center">Transfer tepat nominal di atas. Saldo akan masuk setelah iPaymu mengonfirmasi pembayaran.</p>';
    } else {
      html += '<p class="hint center">Scan QRIS di bawah atau buka link pembayaran.</p>';
      // QRIS image from iPaymu (QrString / QrImage / Url)
      var qrImg = info.qrImage || info.QrImage || info.qrString || info.QrString || '';
      if (qrImg) {
        if (qrImg.indexOf('data:') === 0 || qrImg.indexOf('http') === 0) {
          html += '<div class="qris-img-box"><img src="' + esc(qrImg) + '" alt="QRIS" style="max-width:240px;margin:0 auto"></div>';
        } else {
          // treat as QR content string → generate with QRCode lib
          html += '<div id="qris-gen-box" class="qr-wrap"></div>';
        }
      } else if (info.url) {
        html += '<div id="qris-gen-box" class="qr-wrap"></div>';
      }
    }

    if (info.url) {
      html += '<a class="btn btn-primary" href="' + esc(info.url) + '" target="_blank" rel="noopener" style="display:block;text-align:center;margin:12px 0;text-decoration:none">Buka Halaman Pembayaran</a>';
    }

    if (info.expired) {
      html += '<p class="hint center">Berlaku hingga: <b>' + esc(info.expired) + '</b></p>';
    }

    html += '<button class="btn btn-primary" id="pay-check" style="margin-top:8px">🔄 Cek Status Pembayaran</button>';
    html += '<p class="hint center" id="pay-status" style="margin-top:10px">Status: menunggu pembayaran…</p>';
    html += '<button class="btn btn-ghost btn-sm" onclick="closePay()" style="margin-top:8px">Tutup</button>';

    body.innerHTML = html;
    document.getElementById('pay-modal').classList.add('active');

    // Generate QRIS image if needed
    var genBox = document.getElementById('qris-gen-box');
    if (genBox && window.QRCode) {
      var qrData = info.qrString || info.QrString || info.url || ('IPAYMU|' + info.trxId);
      try {
        new QRCode(genBox, { text: String(qrData), width: 200, height: 200, colorDark: '#000', colorLight: '#fff' });
      } catch (e) { console.warn('QR gen', e); }
    }

    document.getElementById('pay-check').onclick = function () {
      pollTopupStatus(info.trxId, true);
    };

    // auto-poll beberapa kali
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (tries > 12 || !document.getElementById('pay-modal').classList.contains('active')) {
        clearInterval(timer);
        return;
      }
      pollTopupStatus(info.trxId, false);
    }, 15000);
  }

  function pollTopupStatus(trxId, showAlert) {
    var stEl = document.getElementById('pay-status');
    if (stEl) stEl.textContent = 'Mengecek status di server iPaymu…';
    var btn = document.getElementById('pay-check');
    if (btn) { btn.disabled = true; btn.textContent = 'Mengecek…'; }

    checkTransaction(trxId).then(function (res) {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Cek Status Pembayaran'; }
      console.log('[iPaymu check]', res);

      var data = (res && (res.Data || res.data)) || res || {};
      // status bisa string atau code
      var status = (data.Status || data.status || data.status_code || '').toString().toLowerCase();
      var statusCode = data.status_code != null ? Number(data.status_code) : null;
      var paid = status === 'berhasil' || status === 'success' || status === 'paid' ||
        status === '1' || statusCode === 1 ||
        (data.Success === true && status !== 'pending' && status !== 'expired');

      var pending = status === 'pending' || status === '0' || statusCode === 0;
      var expired = status === 'expired' || status === '-2' || statusCode === -2;

      if (paid) {
        creditTopup(trxId);
        if (stEl) stEl.textContent = '✅ Pembayaran berhasil! Saldo sudah ditambahkan.';
        if (showAlert) alert('✅ Top up berhasil dikonfirmasi iPaymu!');
        setTimeout(closePay, 1200);
      } else if (expired) {
        if (stEl) stEl.textContent = '⏰ Transaksi kedaluwarsa. Buat top-up baru.';
        markTxStatus(trxId, 'expired');
        if (showAlert) alert('Transaksi sudah kedaluwarsa.');
      } else {
        if (stEl) stEl.textContent = '⏳ Masih menunggu pembayaran… (status: ' + (status || 'pending') + ')';
        if (showAlert) alert('Belum terbayar. Silakan selesaikan pembayaran lalu cek lagi.');
      }
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Cek Status Pembayaran'; }
      if (stEl) stEl.textContent = 'Gagal cek: ' + (err.message || err);
      if (showAlert) alert('Gagal cek status: ' + (err.message || err));
    });
  }

  function creditTopup(trxId) {
    var pending = rd(PENDING_KEY, {});
    var info = pending[String(trxId)];
    if (!info) {
      // coba dari active
      if (activeTopup && String(activeTopup.trxId) === String(trxId)) info = activeTopup;
    }
    if (!info) return;

    // hindari double credit
    var all = rd(TX_KEY, {});
    var list = all[info.userId] || [];
    var already = list.some(function (t) {
      return String(t.trxId) === String(trxId) && t.status === 'success';
    });
    if (already) {
      delete pending[String(trxId)];
      wr(PENDING_KEY, pending);
      return;
    }

    // kredit = nominal - fee iPaymu (fee real dari response)
    var fee = Number(info.fee) || 0;
    var net = Math.max(0, Number(info.amount) - fee);
    updateBalance(info.userId, net);
    // update pending tx → success
    list.forEach(function (t) {
      if (String(t.trxId) === String(trxId) && t.status === 'pending') {
        t.status = 'success';
        t.amount = net;
        t.fee = fee;
        t.desc = (info.desc || 'Top up') + ' (' + (info.method || '').toUpperCase() +
          (fee ? ' · fee ' + fee : '') + ' · iPaymu)';
      }
    });
    all[info.userId] = list;
    wr(TX_KEY, all);

    delete pending[String(trxId)];
    wr(PENDING_KEY, pending);
    activeTopup = null;

    if (currentUser && currentUser.id === info.userId) {
      renderBalance();
      renderHistory();
      renderChart();
    }
  }

  function markTxStatus(trxId, status) {
    if (!currentUser) return;
    var all = rd(TX_KEY, {});
    var list = all[currentUser.id] || [];
    list.forEach(function (t) {
      if (String(t.trxId) === String(trxId)) t.status = status;
    });
    all[currentUser.id] = list;
    wr(TX_KEY, all);
    renderHistory();
  }

  function checkPendingTopups() {
    if (!currentUser) return;
    var pending = rd(PENDING_KEY, {});
    Object.keys(pending).forEach(function (tid) {
      var info = pending[tid];
      if (info.userId !== currentUser.id) return;
      checkTransaction(tid).then(function (res) {
        var data = (res && (res.Data || res.data)) || {};
        var status = (data.Status || data.status || '').toString().toLowerCase();
        var statusCode = data.status_code != null ? Number(data.status_code) : null;
        if (status === 'berhasil' || status === 'success' || status === 'paid' || statusCode === 1) {
          creditTopup(tid);
        }
      }).catch(function () {});
    });
  }

  // ---------- EXPENSE / SEND (hanya antar-ID / QR — tanpa catatan manual) ----------
  window.openExpense = function () {
    expMode = null;
    expTarget = null;
    document.getElementById('exp-menu').style.display = '';
    document.getElementById('exp-form').style.display = 'none';
    document.getElementById('expense-modal').classList.add('active');
  };
  window.closeExpense = function () {
    document.getElementById('expense-modal').classList.remove('active');
    stopScan();
  };
  window.backToMenu = function () {
    document.getElementById('exp-menu').style.display = '';
    document.getElementById('exp-form').style.display = 'none';
    expTarget = null;
  };
  window.openExpSub = function (mode) {
    if (mode === 'manual') {
      alert('Fitur catatan pengeluaran biasa telah dihapus.\nGunakan transfer ke Wallet ID / Scan QR.');
      return;
    }
    expMode = mode;
    document.getElementById('exp-menu').style.display = 'none';
    document.getElementById('exp-form').style.display = '';
    document.getElementById('exp-target-box').style.display = 'none';
    document.getElementById('exp-id-field').style.display = mode === 'id' ? '' : 'none';
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-desc').value = 'Transfer';
    document.getElementById('exp-title').textContent =
      mode === 'id' ? 'Kirim ke ID' :
      mode === 'scan' ? 'Scan QR' : 'Upload QR';

    if (mode === 'scan') {
      document.getElementById('expense-modal').classList.remove('active');
      openScan();
    } else if (mode === 'upload') {
      document.getElementById('upload-qr').click();
    }
  };

  window.checkRecipient = function () {
    var id = (document.getElementById('exp-recipient').value || '').trim().toLowerCase();
    var st = document.getElementById('recipient-status');
    if (!id) { st.textContent = 'Isi Wallet ID'; st.style.color = '#EF4444'; return; }
    if (id === currentUser.id) { st.textContent = 'Tidak bisa kirim ke diri sendiri'; st.style.color = '#EF4444'; return; }
    var u = getUser(id);
    if (!u) { st.textContent = '✕ Wallet tidak ditemukan'; st.style.color = '#EF4444'; expTarget = null; return; }
    st.textContent = '✓ Wallet ditemukan'; st.style.color = '#10B981';
    expTarget = id;
    document.getElementById('exp-target-id').textContent = id;
    document.getElementById('exp-target-box').style.display = '';
  };

  window.submitExpense = function () {
    if (!currentUser) return;
    var amt = parseInt(document.getElementById('expense-amount').value, 10) || 0;
    var desc = (document.getElementById('expense-desc').value || '').trim() || 'Transfer';
    if (amt < 1) { alert('Nominal minimal Rp 1'); return; }
    var bal = getBalance(currentUser.id);
    if (amt > bal) { alert('Saldo tidak cukup'); return; }

    // Hanya transfer antar wallet ID (lokal, instan)
    var to = expTarget;
    if (expMode === 'id' && !to) {
      checkRecipient();
      to = expTarget;
    }
    if (!to) { alert('Pilih penerima dulu'); return; }
    if (!getUser(to)) { alert('Penerima tidak valid'); return; }

    updateBalance(currentUser.id, -amt);
    updateBalance(to, amt);
    addTx(currentUser.id, { type: 'out', amount: amt, desc: desc, to: to, status: 'success' });
    addTx(to, { type: 'in', amount: amt, desc: desc, from: currentUser.id, status: 'success' });
    closeExpense();
    renderBalance(); renderHistory(); renderChart();
    alert('✅ Berhasil kirim ' + fmtRp(amt) + ' ke ' + to);
  };

  function addTx(uid, obj) {
    var all = rd(TX_KEY, {});
    if (!all[uid]) all[uid] = [];
    obj.id = 'T' + Date.now() + Math.random().toString(36).slice(2, 5);
    obj.ts = Date.now();
    all[uid].unshift(obj);
    wr(TX_KEY, all);
  }

  // ---------- QR MY WALLET ----------
  window.showMyQR = function () {
    if (!currentUser) return;
    document.getElementById('myqr-id').textContent = currentUser.id;
    var box = document.getElementById('myqr-box');
    box.innerHTML = '';
    if (window.QRCode) {
      new QRCode(box, {
        text: 'DOMPETKU|' + currentUser.id,
        width: 200,
        height: 200,
        colorDark: '#0B141A',
        colorLight: '#ffffff'
      });
    }
    document.getElementById('myqr-modal').classList.add('active');
  };
  window.closeMyQR = function () {
    document.getElementById('myqr-modal').classList.remove('active');
  };
  window.downloadMyQR = function () {
    var canvas = document.querySelector('#myqr-box canvas');
    if (!canvas) return;
    var a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'dompetku-' + currentUser.id + '.png';
    a.click();
  };

  // ---------- SCAN QR ----------
  function openScan() {
    document.getElementById('scan-modal').classList.add('active');
    document.getElementById('scan-status').textContent = 'Menunggu kamera...';
    startCamera();
  }
  window.closeScan = function () {
    document.getElementById('scan-modal').classList.remove('active');
    stopScan();
  };
  function stopScan() {
    if (scanStream) {
      scanStream.getTracks().forEach(function (t) { t.stop(); });
      scanStream = null;
    }
  }
  function startCamera() {
    stopScan();
    var video = document.getElementById('scan-video');
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingMode },
      audio: false
    }).then(function (stream) {
      scanStream = stream;
      video.srcObject = stream;
      video.play();
      document.getElementById('scan-status').textContent = 'Arahkan ke QR Dompetku';
      requestAnimationFrame(tickScan);
    }).catch(function (e) {
      document.getElementById('scan-status').textContent = 'Kamera gagal: ' + e.message;
    });
  }
  window.switchCamera = function () {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    startCamera();
  };
  function tickScan() {
    if (!document.getElementById('scan-modal').classList.contains('active')) return;
    var video = document.getElementById('scan-video');
    if (video.readyState === video.HAVE_ENOUGH_DATA && window.jsQR) {
      var canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var code = jsQR(img.data, img.width, img.height);
      if (code && code.data) {
        handleScannedQR(code.data);
        return;
      }
    }
    requestAnimationFrame(tickScan);
  }
  function handleScannedQR(data) {
    closeScan();
    var parts = String(data).split('|');
    if (parts[0] !== 'DOMPETKU' || !parts[1]) {
      alert('QR tidak dikenali');
      openExpense();
      return;
    }
    var to = parts[1].toLowerCase();
    if (to === currentUser.id) {
      alert('Tidak bisa kirim ke diri sendiri');
      openExpense();
      return;
    }
    if (!getUser(to)) {
      alert('Wallet tujuan tidak ditemukan di jaringan lokal');
      openExpense();
      return;
    }
    expTarget = to;
    expMode = 'scan';
    document.getElementById('exp-menu').style.display = 'none';
    document.getElementById('exp-form').style.display = '';
    document.getElementById('exp-target-box').style.display = '';
    document.getElementById('exp-target-id').textContent = to;
    document.getElementById('exp-id-field').style.display = 'none';
    document.getElementById('exp-title').textContent = 'Kirim ke ' + to;
    document.getElementById('expense-modal').classList.add('active');
  }

  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'upload-qr') {
      var f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var c = document.createElement('canvas');
          c.width = img.width; c.height = img.height;
          var ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          var data = ctx.getImageData(0, 0, c.width, c.height);
          if (window.jsQR) {
            var code = jsQR(data.data, data.width, data.height);
            if (code) handleScannedQR(code.data);
            else alert('QR tidak terbaca');
          }
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(f);
    }
  });

  // ---------- NOTA / DETAIL ----------
  function showNota(tx) {
    var body = document.getElementById('pay-body');
    var title = document.getElementById('pay-title');
    title.textContent = 'Detail Transaksi';
    var isIn = tx.type === 'in';
    body.innerHTML =
      '<div class="nota-header">' +
      '<div class="nota-icon ' + (isIn ? 'inc' : 'exp') + '">' + (isIn ? '↓' : '↑') + '</div>' +
      '<div class="nota-amount ' + (isIn ? 'inc' : 'exp') + '">' + (isIn ? '+' : '−') + ' ' + fmtRp(tx.amount) + '</div>' +
      '<div class="nota-type">' + (isIn ? 'Pemasukan' : 'Pengeluaran') + '</div></div>' +
      '<div class="nota-row"><span class="lbl">Keterangan</span><span class="val">' + esc(tx.desc) + '</span></div>' +
      (tx.to ? '<div class="nota-row"><span class="lbl">Ke</span><span class="val hl">' + esc(tx.to) + '</span></div>' : '') +
      (tx.from ? '<div class="nota-row"><span class="lbl">Dari</span><span class="val hl">' + esc(tx.from) + '</span></div>' : '') +
      (tx.trxId ? '<div class="nota-row"><span class="lbl">iPaymu Trx</span><span class="val">' + esc(String(tx.trxId)) + '</span></div>' : '') +
      '<div class="nota-row"><span class="lbl">Waktu</span><span class="val">' + new Date(tx.ts).toLocaleString('id-ID') + '</span></div>' +
      '<div class="nota-row"><span class="lbl">Status</span><span class="val">' + (tx.status || 'success') + '</span></div>' +
      '<div class="nota-row"><span class="lbl">ID</span><span class="val">' + esc(tx.id) + '</span></div>';
    if (tx.status === 'pending' && tx.trxId) {
      body.innerHTML += '<button class="btn btn-primary" style="margin-top:12px" id="nota-check">🔄 Cek Status iPaymu</button>';
    }
    document.getElementById('pay-modal').classList.add('active');
    var nbtn = document.getElementById('nota-check');
    if (nbtn) {
      nbtn.onclick = function () {
        pollTopupStatus(tx.trxId, true);
      };
    }
  }
  window.closePay = function () {
    document.getElementById('pay-modal').classList.remove('active');
  };


  // ---------- KONEKSI (fee chat Go Work Rp 500) ----------
  var CONN_KEY = 'dk_connections';
  var CONN_FEE = 500;

  function getConnections(uid) {
    var all = rd(CONN_KEY, {});
    return all[uid] || {};
  }
  function hasConnection(a, b) {
    if (!a || !b) return false;
    var ca = getConnections(a);
    var cb = getConnections(b);
    return !!(ca[b] || cb[a]);
  }
  function openConnection(fromId, toId, customFee) {
    if (!fromId || !toId || fromId === toId) return { ok: false, msg: 'Invalid' };
    if (hasConnection(fromId, toId)) return { ok: true, already: true };
    var fee = (typeof customFee === 'number' && customFee > 0) ? customFee : CONN_FEE;
    var bal = getBalance(fromId);
    if (bal < fee) {
      return { ok: false, msg: 'Saldo tidak cukup. Biaya buka koneksi Rp ' + fee.toLocaleString('id-ID') };
    }
    updateBalance(fromId, -fee);
    addTx(fromId, {
      type: 'out',
      amount: fee,
      desc: 'Biaya koneksi chat · ' + toId,
      to: toId,
      status: 'success',
      kind: 'connection'
    });
    var all = rd(CONN_KEY, {});
    if (!all[fromId]) all[fromId] = {};
    all[fromId][toId] = { ts: Date.now(), fee: fee };
    if (!all[toId]) all[toId] = {};
    all[toId][fromId] = { ts: Date.now(), fee: fee, from: fromId };
    wr(CONN_KEY, all);
    if (currentUser && currentUser.id === fromId) {
      renderBalance();
      renderHistory();
      renderChart();
    }
    return { ok: true, already: false, fee: fee };
  }

  window.dkHasConnection = hasConnection;
  window.dkOpenConnection = openConnection;
  window.dkConnFee = CONN_FEE;
  window.dkGetBalance = getBalance;
  window.dkUpdateBalance = updateBalance;
  window.dkAddTx = addTx;
  window.dkFmtRp = fmtRp;
  window.dkRenderBalance = renderBalance;
  window.dkRenderHistory = renderHistory;
  window.dkRenderChart = renderChart;

  Object.defineProperty(window, 'currentUser', {
    get: function () { return currentUser; }
  });

  // ---------- INIT ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  console.log('[Dompetku] Core + iPaymu sandbox loaded ✅');
})();
