/* Dompetku BTC wallet — non-custodial (PBKDF2 + AES-GCM).
 * Library dimuat dinamis (multi-CDN) agar tidak gagal diam di mobile / GitHub Pages.
 * Referensi API: Blockstream Esplora, CoinGecko, BIP84 native segwit.
 */
(function () {
  'use strict';

  const ESPLORA = 'https://blockstream.info/api';
  const KEY = 'dk_btc_wallet_v1';
  const TXKEY = 'dk_btc_local_tx_v1';

  let bip39 = null, BIP32 = null, bitcoin = null, ecc = null;
  let libsReady = false;
  let libsError = null;
  let libsLoading = null;

  let wallet = null;
  let password = null;
  let feeRate = 5;
  let btcPrice = { idr: 0, usd: 0, cny: 0, krw: 0, thb: 0, sar: 0, inr: 0 };
  let balanceSats = 0;
  let utxos = [];
  let history = [];

  const $ = id => document.getElementById(id);
  const satToBtc = sats => (Number(sats || 0) / 1e8);
  const fmtBtc = sats => satToBtc(sats).toFixed(8) + ' BTC';
  const currency = () => (localStorage.getItem('dk_currency') || 'IDR').toLowerCase();
  const locale = () => ({
    id: 'id-ID', en: 'en-US', zh: 'zh-CN', ko: 'ko-KR',
    th: 'th-TH', ar: 'ar-SA', hi: 'hi-IN'
  }[localStorage.getItem('dk_lang') || 'id'] || 'id-ID');
  const money = n => {
    const c = currency().toUpperCase();
    try {
      return new Intl.NumberFormat(locale(), {
        style: 'currency', currency: c, maximumFractionDigits: 2
      }).format(n);
    } catch (_) {
      return c + ' ' + Number(n || 0).toLocaleString(locale());
    }
  };
  const fiat = sats => money(satToBtc(sats) * (btcPrice[currency()] || btcPrice.idr || 0));
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

  /* ---------- Load crypto libraries (multi-CDN fallback) ---------- */
  const CDN_SETS = [
    {
      bip39: 'https://esm.sh/bip39@3.1.0',
      bip32: 'https://esm.sh/bip32@4.0.0',
      ecc: 'https://esm.sh/tiny-secp256k1@2.2.3',
      bitcoin: 'https://esm.sh/bitcoinjs-lib@6.1.7'
    },
    {
      bip39: 'https://cdn.jsdelivr.net/npm/bip39@3.1.0/+esm',
      bip32: 'https://cdn.jsdelivr.net/npm/bip32@4.0.0/+esm',
      ecc: 'https://cdn.jsdelivr.net/npm/tiny-secp256k1@2.2.3/+esm',
      bitcoin: 'https://cdn.jsdelivr.net/npm/bitcoinjs-lib@6.1.7/+esm'
    },
    {
      bip39: 'https://unpkg.com/bip39@3.1.0?module',
      bip32: 'https://unpkg.com/bip32@4.0.0?module',
      ecc: 'https://unpkg.com/tiny-secp256k1@2.2.3?module',
      bitcoin: 'https://unpkg.com/bitcoinjs-lib@6.1.7?module'
    }
  ];

  async function tryLoadSet(set) {
    const [m1, m2, m3, m4] = await Promise.all([
      import(set.bip39),
      import(set.bip32),
      import(set.ecc),
      import(set.bitcoin)
    ]);
    bip39 = m1;
    ecc = m3.default || m3;
    const bip32Mod = m2;
    bitcoin = m4;
    if (typeof bitcoin.initEccLib === 'function') bitcoin.initEccLib(ecc);
    const factory = bip32Mod.BIP32Factory || (bip32Mod.default && bip32Mod.default.BIP32Factory);
    if (!factory) throw new Error('BIP32Factory tidak ditemukan');
    BIP32 = factory(ecc);
    if (!bip39.generateMnemonic || !bitcoin.payments) {
      throw new Error('Library BTC tidak lengkap');
    }
  }

  function ensureLibs() {
    if (libsReady) return Promise.resolve(true);
    if (libsLoading) return libsLoading;
    libsLoading = (async () => {
      let lastErr = null;
      for (let i = 0; i < CDN_SETS.length; i++) {
        try {
          await tryLoadSet(CDN_SETS[i]);
          libsReady = true;
          libsError = null;
          console.log('[DKBTC] libraries ready via CDN set', i + 1);
          return true;
        } catch (e) {
          lastErr = e;
          console.warn('[DKBTC] CDN set', i + 1, 'gagal:', e.message || e);
        }
      }
      libsError = lastErr ? (lastErr.message || String(lastErr)) : 'Gagal memuat library Bitcoin';
      libsReady = false;
      throw new Error(libsError);
    })().finally(() => { libsLoading = null; });
    return libsLoading;
  }

  /* ---------- i18n labels ---------- */
  function applyLang() {
    const lang = localStorage.getItem('dk_lang') || 'id';
    const dict = {
      id: {
        title: 'Dompet Bitcoin', lock: 'Buat atau buka dompet Bitcoin pribadi Anda.',
        pass: 'Kata sandi dompet Bitcoin', unlock: 'Buat / Buka Dompet',
        balance: 'Saldo Bitcoin', receive: 'Terima', send: 'Kirim BTC', refresh: 'Perbarui',
        receiveHead: 'Alamat penerimaan BTC', sendHead: 'Kirim Bitcoin', history: 'Riwayat Bitcoin',
        destination: 'Alamat BTC tujuan', amount: 'Jumlah BTC',
        fee: 'Estimasi biaya jaringan (target ±30 menit)', total: 'Total perkiraan',
        submit: 'Tinjau & Kirim BTC', lockBtn: 'Kunci dompet', network: 'Bitcoin Mainnet'
      },
      en: {
        title: 'Bitcoin Wallet', lock: 'Create or unlock your personal Bitcoin wallet.',
        pass: 'Bitcoin wallet password', unlock: 'Create / Unlock Wallet',
        balance: 'Bitcoin balance', receive: 'Receive', send: 'Send BTC', refresh: 'Refresh',
        receiveHead: 'BTC receiving address', sendHead: 'Send Bitcoin', history: 'Bitcoin history',
        destination: 'Recipient BTC address', amount: 'BTC amount',
        fee: 'Estimated network fee (target ±30 min)', total: 'Estimated total',
        submit: 'Review & Send BTC', lockBtn: 'Lock wallet', network: 'Bitcoin Mainnet'
      },
      zh: {
        title: '比特币钱包', lock: '创建或解锁您的个人比特币钱包。',
        pass: '比特币钱包密码', unlock: '创建 / 解锁钱包',
        balance: '比特币余额', receive: '收款', send: '发送 BTC', refresh: '刷新',
        receiveHead: 'BTC 收款地址', sendHead: '发送比特币', history: '比特币记录',
        destination: '收款 BTC 地址', amount: 'BTC 数量',
        fee: '预计网络费用（约 30 分钟）', total: '预计总额',
        submit: '确认并发送 BTC', lockBtn: '锁定钱包', network: '比特币主网'
      },
      ko: {
        title: '비트코인 지갑', lock: '개인 비트코인 지갑을 만들거나 잠금 해제하세요.',
        pass: '비트코인 지갑 비밀번호', unlock: '지갑 만들기 / 잠금 해제',
        balance: '비트코인 잔액', receive: '받기', send: 'BTC 보내기', refresh: '새로고침',
        receiveHead: 'BTC 받기 주소', sendHead: '비트코인 보내기', history: '비트코인 내역',
        destination: '받는 BTC 주소', amount: 'BTC 금액',
        fee: '예상 네트워크 수수료(약 30분)', total: '예상 합계',
        submit: '검토 후 BTC 보내기', lockBtn: '지갑 잠그기', network: '비트코인 메인넷'
      },
      th: {
        title: 'กระเป๋า Bitcoin', lock: 'สร้างหรือปลดล็อกกระเป๋า Bitcoin ส่วนตัว',
        pass: 'รหัสผ่านกระเป๋า Bitcoin', unlock: 'สร้าง / ปลดล็อกกระเป๋า',
        balance: 'ยอด Bitcoin', receive: 'รับ', send: 'ส่ง BTC', refresh: 'รีเฟรช',
        receiveHead: 'ที่อยู่รับ BTC', sendHead: 'ส่ง Bitcoin', history: 'ประวัติ Bitcoin',
        destination: 'ที่อยู่ BTC ผู้รับ', amount: 'จำนวน BTC',
        fee: 'ค่าธรรมเนียมเครือข่ายโดยประมาณ', total: 'ยอดรวมโดยประมาณ',
        submit: 'ตรวจสอบและส่ง BTC', lockBtn: 'ล็อกกระเป๋า', network: 'Bitcoin Mainnet'
      },
      ar: {
        title: 'محفظة بيتكوين', lock: 'أنشئ محفظة بيتكوين أو افتحها.',
        pass: 'كلمة مرور محفظة بيتكوين', unlock: 'إنشاء / فتح المحفظة',
        balance: 'رصيد بيتكوين', receive: 'استلام', send: 'إرسال BTC', refresh: 'تحديث',
        receiveHead: 'عنوان استلام BTC', sendHead: 'إرسال بيتكوين', history: 'سجل بيتكوين',
        destination: 'عنوان BTC للمستلم', amount: 'كمية BTC',
        fee: 'رسوم الشبكة المقدرة', total: 'الإجمالي المقدر',
        submit: 'مراجعة وإرسال BTC', lockBtn: 'قفل المحفظة', network: 'شبكة Bitcoin الرئيسية'
      },
      hi: {
        title: 'बिटकॉइन वॉलेट', lock: 'अपना निजी बिटकॉइन वॉलेट बनाएं या खोलें।',
        pass: 'बिटकॉइन वॉलेट पासवर्ड', unlock: 'वॉलेट बनाएं / खोलें',
        balance: 'बिटकॉइन बैलेंस', receive: 'प्राप्त करें', send: 'BTC भेजें', refresh: 'रिफ्रेश',
        receiveHead: 'BTC प्राप्ति पता', sendHead: 'बिटकॉइन भेजें', history: 'बिटकॉइन इतिहास',
        destination: 'प्राप्तकर्ता BTC पता', amount: 'BTC राशि',
        fee: 'अनुमानित नेटवर्क शुल्क', total: 'अनुमानित कुल',
        submit: 'जांचें और BTC भेजें', lockBtn: 'वॉलेट लॉक करें', network: 'Bitcoin Mainnet'
      }
    };
    const d = dict[lang] || dict.id;
    const put = (id, value) => { const e = $(id); if (e) e.textContent = value; };
    put('btc-password-label', d.pass);
    put('btc-wallet-label', d.balance);
    put('btc-receive-label', d.receive);
    put('btc-send-label', d.send);
    put('btc-refresh-label', d.refresh);
    put('btc-receive-heading', d.receiveHead);
    put('btc-send-heading', d.sendHead);
    put('btc-history-heading', d.history);
    put('btc-send-submit', d.submit);
    const modal = $('btc-modal');
    if (modal) {
      const h = modal.querySelector('.modal-head h3');
      if (h) h.innerHTML = '<span class="btc-mark">₿</span> ' + d.title;
      const p = $('btc-lock-title');
      if (p && !localStorage.getItem(KEY)) p.textContent = d.lock;
    }
    const labels = document.querySelectorAll('#btc-send-panel .field label');
    if (labels[0]) labels[0].textContent = d.destination;
    if (labels[1]) labels[1].textContent = d.amount;
    const lockBtn = $('btc-wallet-panel') &&
      $('btc-wallet-panel').querySelector('button[onclick*="lock()"]');
    if (lockBtn) lockBtn.textContent = d.lockBtn;
    const network = $('btc-wallet-panel') &&
      $('btc-wallet-panel').querySelector('.btc-network-pill');
    if (network) network.textContent = d.network;
  }

  function alertMsg(message, kind) {
    const el = $('btc-alert');
    if (!el) return;
    el.hidden = !message;
    el.className = 'btc-alert' + (kind ? ' ' + kind : '');
    el.textContent = message || '';
  }

  function localTxs() {
    try { return JSON.parse(localStorage.getItem(TXKEY) || '[]'); } catch (_) { return []; }
  }
  function saveLocalTx(tx) {
    const a = localTxs();
    a.unshift(tx);
    localStorage.setItem(TXKEY, JSON.stringify(a.slice(0, 100)));
  }

  function hex(buf) {
    return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  function bytes(s) { return new TextEncoder().encode(s); }
  function fromHex(s) {
    return new Uint8Array((s.match(/.{1,2}/g) || []).map(x => parseInt(x, 16)));
  }

  async function deriveAes(pass, salt, iterations) {
    iterations = iterations || 310000;
    const material = await crypto.subtle.importKey(
      'raw', bytes(pass), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptWallet(mnemonic, pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveAes(pass, salt);
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, bytes(mnemonic)
    );
    return {
      v: 1, salt: hex(salt), iv: hex(iv), cipher: hex(cipher),
      iterations: 310000, createdAt: Date.now()
    };
  }

  async function decryptWallet(record, pass) {
    const key = await deriveAes(pass, fromHex(record.salt), record.iterations || 310000);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromHex(record.iv) },
      key,
      fromHex(record.cipher)
    );
    return new TextDecoder().decode(plain);
  }

  function derive(mnemonic) {
    if (!libsReady) throw new Error('Library BTC belum siap');
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = BIP32.fromSeed(seed, bitcoin.networks.bitcoin);
    const child = root.derivePath("m/84'/0'/0'/0/0");
    const payment = bitcoin.payments.p2wpkh({
      pubkey: child.publicKey,
      network: bitcoin.networks.bitcoin
    });
    if (!payment.address || !child.privateKey) {
      throw new Error('Gagal membuat alamat Bitcoin.');
    }
    return {
      address: payment.address,
      privateKey: child.privateKey,
      publicKey: child.publicKey,
      keyPair: child,
      path: "m/84'/0'/0'/0/0"
    };
  }

  async function getJson(url, opts) {
    const res = await fetch(url, opts);
    if (!res.ok) {
      throw new Error('Layanan blockchain merespons ' + res.status + '. Coba lagi nanti.');
    }
    return res.json();
  }

  async function loadMarket() {
    try {
      const p = await getJson(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=idr,usd,cny,krw,thb,sar,inr'
      );
      btcPrice = p.bitcoin || btcPrice;
    } catch (_) { /* optional */ }
  }

  async function loadFees() {
    try {
      const f = await getJson(ESPLORA + '/fee-estimates');
      feeRate = Number(f['30'] || f['6'] || f['3'] || 5);
    } catch (_) {
      feeRate = 5;
    }
    const e = $('btc-fee');
    if (e) e.textContent = feeRate.toFixed(1) + ' sat/vB (estimasi)';
    updateTotal();
  }

  async function loadChain() {
    if (!wallet) return;
    const [addr, hist, us] = await Promise.all([
      getJson(ESPLORA + '/address/' + wallet.address),
      getJson(ESPLORA + '/address/' + wallet.address + '/txs'),
      getJson(ESPLORA + '/address/' + wallet.address + '/utxo')
    ]);
    balanceSats =
      (Number(addr.chain_stats && addr.chain_stats.funded_txo_sum || 0) -
        Number(addr.chain_stats && addr.chain_stats.spent_txo_sum || 0)) +
      (Number(addr.mempool_stats && addr.mempool_stats.funded_txo_sum || 0) -
        Number(addr.mempool_stats && addr.mempool_stats.spent_txo_sum || 0));
    utxos = us;
    history = hist;
    renderBalance();
    renderHistory();
  }

  function renderBalance() {
    const b = $('btc-balance'), f = $('btc-fiat'), c = $('btc-change');
    if (b) b.textContent = fmtBtc(balanceSats);
    if (f) {
      f.textContent = btcPrice[currency()]
        ? '≈ ' + fiat(balanceSats)
        : 'Kurs fiat belum tersedia';
    }
    if (c) c.textContent = 'Saldo dibaca dari jaringan Bitcoin Mainnet';
  }

  function renderHistory() {
    const el = $('btc-history'), status = $('btc-history-status');
    if (!el) return;
    const all = history.slice(0, 20);
    if (status) status.textContent = all.length + ' transaksi';
    if (!all.length) {
      el.innerHTML = '<div class="empty-history">Belum ada transaksi di alamat ini.</div>';
      return;
    }
    const own = wallet.address;
    el.innerHTML = all.map(tx => {
      const v = (tx.vout || [])
        .filter(o => o.scriptpubkey_address === own)
        .reduce((a, o) => a + Number(o.value || 0), 0);
      const spent = (tx.vin || []).some(i =>
        i.prevout && i.prevout.scriptpubkey_address === own
      );
      const incoming = v > 0 && !spent;
      const value = incoming
        ? v
        : Math.max(0, (tx.vin || [])
          .filter(i => i.prevout && i.prevout.scriptpubkey_address === own)
          .reduce((a, i) => a + Number(i.prevout.value || 0), 0) - v);
      const confirmed = !!(tx.status && tx.status.confirmed);
      const time = tx.status && tx.status.block_time
        ? new Date(tx.status.block_time * 1000).toLocaleString(locale())
        : 'Menunggu konfirmasi';
      const txid = tx.txid || '';
      return '<button class="btc-history-item" type="button" data-txid="' +
        escapeHtml(txid) + '">' +
        '<span class="btc-history-icon">' + (incoming ? '↓' : '↑') + '</span>' +
        '<span class="btc-history-info"><b>' + (incoming ? 'BTC masuk' : 'BTC keluar') +
        '</b><small>' + escapeHtml(time) + ' · ' +
        (confirmed ? 'Terkonfirmasi' : 'Belum terkonfirmasi') +
        '</small></span>' +
        '<span class="btc-history-amount ' + (incoming ? 'positive' : 'negative') + '">' +
        (incoming ? '+' : '−') + satToBtc(value).toFixed(8) + ' BTC</span></button>';
    }).join('');
    el.querySelectorAll('[data-txid]').forEach(btn => {
      btn.addEventListener('click', () => showTx(btn.dataset.txid));
    });
  }

  async function showTx(txid) {
    try {
      const tx = await getJson(ESPLORA + '/tx/' + txid);
      const fee = tx.fee == null ? 'Tidak tersedia' : tx.fee + ' sats';
      const status = tx.status && tx.status.confirmed
        ? 'Terkonfirmasi' : 'Belum terkonfirmasi';
      alertMsg(
        'Detail transaksi\\nID: ' + txid +
        '\\nStatus: ' + status +
        '\\nBiaya miner: ' + fee +
        '\\nLihat: https://blockstream.info/tx/' + txid,
        'success'
      );
    } catch (e) {
      alertMsg(e.message, 'error');
    }
  }

  function renderQr() {
    const el = $('btc-qr');
    if (!el || !wallet) return;
    el.innerHTML = '';
    if (window.QRCode) {
      new window.QRCode(el, {
        text: wallet.address,
        width: 190,
        height: 190,
        colorDark: '#111827',
        colorLight: '#ffffff',
        correctLevel: (window.QRCode.CorrectLevel && window.QRCode.CorrectLevel.M) || 0
      });
    } else {
      el.textContent = 'QR tidak tersedia. Salin alamat di bawah.';
    }
    const a = $('btc-address');
    if (a) a.textContent = wallet.address;
  }

  function updateTotal() {
    const amt = Number(($('btc-amount') && $('btc-amount').value) || 0);
    const sats = Math.round(amt * 1e8);
    const est = Math.ceil(vbytesEstimate(utxos.length || 1, 2) * feeRate);
    const fee = $('btc-fee');
    if (fee) fee.textContent = est + ' sats (' + feeRate.toFixed(1) + ' sat/vB)';
    const total = $('btc-total');
    if (total) total.textContent = amt > 0 ? fmtBtc(sats + est) : '—';
  }

  function vbytesEstimate(inputs, outputs) {
    return 10 + inputs * 68 + outputs * 31;
  }

  function hideSubpanels() {
    ['btc-receive-panel', 'btc-send-panel'].forEach(id => {
      if ($(id)) $(id).hidden = true;
    });
  }

  function showReceive() {
    hideSubpanels();
    if ($('btc-receive-panel')) $('btc-receive-panel').hidden = false;
    renderQr();
  }

  function showSend() {
    hideSubpanels();
    if ($('btc-send-panel')) $('btc-send-panel').hidden = false;
    loadFees();
  }

  /* ---------- Public API ---------- */
  function open() {
    applyLang();
    const m = $('btc-modal');
    if (!m) {
      alert('Modal BTC belum siap. Muat ulang halaman.');
      return;
    }
    m.classList.add('active');
    m.style.display = 'block';
    const saved = localStorage.getItem(KEY);
    if ($('btc-lock-panel')) $('btc-lock-panel').hidden = false;
    if ($('btc-wallet-panel')) $('btc-wallet-panel').hidden = true;
    if ($('btc-recovery-panel')) $('btc-recovery-panel').hidden = true;
    if ($('btc-password')) $('btc-password').value = '';
    alertMsg('');

    // Preload libs while user types password
    ensureLibs().then(() => {
      if ($('btc-unlock-btn')) {
        $('btc-unlock-btn').disabled = false;
        $('btc-unlock-btn').textContent = saved ? 'Buka Dompet' : 'Buat Dompet BTC';
      }
    }).catch(err => {
      alertMsg(
        'Gagal memuat modul Bitcoin: ' + (err.message || err) +
        '\\n\\nCoba: hard refresh (Ctrl+Shift+R), koneksi stabil, atau browser lain.',
        'error'
      );
      if ($('btc-unlock-btn')) {
        $('btc-unlock-btn').textContent = 'Coba Muat Ulang Modul';
        $('btc-unlock-btn').onclick = function () {
          libsError = null;
          libsReady = false;
          open();
        };
      }
    });

    if ($('btc-lock-title')) {
      $('btc-lock-title').textContent = saved
        ? 'Masukkan kata sandi untuk membuka dompet BTC.'
        : 'Buat dompet BTC baru. Kata sandi akan mengenkripsi recovery phrase di perangkat ini.';
    }
    if ($('btc-unlock-btn') && !libsError) {
      $('btc-unlock-btn').textContent = saved ? 'Buka Dompet' : 'Buat Dompet BTC';
      $('btc-unlock-btn').onclick = function () { unlock(); };
    }
    if ($('btc-password')) $('btc-password').focus();
  }

  function close() {
    const m = $('btc-modal');
    if (m) {
      m.classList.remove('active');
      m.style.display = 'none';
    }
    lock(false);
  }

  async function unlock() {
    const pass = ($('btc-password') && $('btc-password').value) || '';
    if (!pass || pass.length < 10) {
      alertMsg('Gunakan kata sandi dompet minimal 10 karakter.', 'error');
      return;
    }

    alertMsg('Memuat library Bitcoin…', '');
    if ($('btc-unlock-btn')) {
      $('btc-unlock-btn').disabled = true;
      $('btc-unlock-btn').textContent = 'Memuat…';
    }

    try {
      await ensureLibs();
    } catch (e) {
      alertMsg(
        'Modul Bitcoin gagal dimuat: ' + (e.message || e) +
        '\\nPeriksa koneksi internet lalu coba lagi.',
        'error'
      );
      if ($('btc-unlock-btn')) {
        $('btc-unlock-btn').disabled = false;
        $('btc-unlock-btn').textContent = 'Coba Lagi';
      }
      return;
    }

    const saved = localStorage.getItem(KEY);
    try {
      let mnemonic;
      if (saved) {
        mnemonic = await decryptWallet(JSON.parse(saved), pass);
      } else {
        mnemonic = bip39.generateMnemonic(128);
        const rec = await encryptWallet(mnemonic, pass);
        localStorage.setItem(KEY, JSON.stringify(rec));
        const panel = $('btc-recovery-panel');
        if ($('btc-recovery-words')) {
          $('btc-recovery-words').innerHTML = mnemonic.split(' ').map((w, i) =>
            '<span>' + (i + 1) + '. ' + escapeHtml(w) + '</span>'
          ).join('');
        }
        if ($('btc-recovery-confirm')) $('btc-recovery-confirm').checked = false;
        if ($('btc-lock-panel')) $('btc-lock-panel').hidden = true;
        if ($('btc-wallet-panel')) $('btc-wallet-panel').hidden = true;
        if (panel) panel.hidden = false;
        password = pass;
        const w = derive(mnemonic);
        wallet = Object.assign({}, w, { mnemonic: mnemonic });
        alertMsg('Catat recovery phrase secara offline sebelum menggunakan dompet ini.', 'success');
        if ($('btc-unlock-btn')) {
          $('btc-unlock-btn').disabled = false;
          $('btc-unlock-btn').textContent = 'Buat Dompet BTC';
        }
        return;
      }
      wallet = Object.assign({}, derive(mnemonic), { mnemonic: mnemonic });
      password = pass;
      if ($('btc-lock-panel')) $('btc-lock-panel').hidden = true;
      if ($('btc-wallet-panel')) $('btc-wallet-panel').hidden = false;
      if ($('btc-recovery-panel')) $('btc-recovery-panel').hidden = true;
      if ($('btc-password')) $('btc-password').value = '';
      hideSubpanels();
      renderBalance();
      renderQr();
      await Promise.all([loadMarket(), loadFees()]);
      renderBalance();
      await loadChain();
      alertMsg('Dompet terbuka. Periksa alamat dan simpan recovery phrase dengan aman.', 'success');
    } catch (e) {
      alertMsg(
        saved
          ? 'Kata sandi salah atau data dompet rusak.'
          : 'Gagal membuat dompet: ' + e.message,
        'error'
      );
    } finally {
      if ($('btc-unlock-btn')) {
        $('btc-unlock-btn').disabled = false;
        const has = !!localStorage.getItem(KEY);
        $('btc-unlock-btn').textContent = has ? 'Buka Dompet' : 'Buat Dompet BTC';
        $('btc-unlock-btn').onclick = function () { unlock(); };
      }
    }
  }

  function confirmRecovery() {
    if (!$('btc-recovery-confirm') || !$('btc-recovery-confirm').checked) {
      alertMsg('Centang konfirmasi setelah recovery phrase dicatat offline.', 'error');
      return;
    }
    if ($('btc-recovery-panel')) $('btc-recovery-panel').hidden = true;
    if ($('btc-wallet-panel')) $('btc-wallet-panel').hidden = false;
    if ($('btc-lock-panel')) $('btc-lock-panel').hidden = true;
    renderQr();
    renderBalance();
    Promise.all([loadMarket(), loadFees()])
      .then(() => { renderBalance(); return loadChain(); })
      .catch(e => alertMsg('Alamat dibuat, tetapi data blockchain gagal dimuat: ' + e.message, 'error'));
    alertMsg(
      'Dompet dibuat. Simpan recovery phrase offline; tanpa frasa ini dompet tidak dapat dipulihkan.',
      'success'
    );
  }

  async function send() {
    if (!wallet || !password) {
      alertMsg('Buka dompet terlebih dahulu.', 'error');
      return;
    }
    if (!libsReady) {
      alertMsg('Library Bitcoin belum siap.', 'error');
      return;
    }
    const dest = (($('btc-destination') && $('btc-destination').value) || '').trim();
    const amount = Number(($('btc-amount') && $('btc-amount').value) || 0);
    try {
      bitcoin.address.toOutputScript(dest, bitcoin.networks.bitcoin);
    } catch (_) {
      alertMsg('Alamat tujuan bukan alamat Bitcoin Mainnet yang valid.', 'error');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      alertMsg('Masukkan jumlah BTC yang valid.', 'error');
      return;
    }
    const sendSats = Math.round(amount * 1e8);
    try {
      const current = await getJson(ESPLORA + '/address/' + wallet.address + '/utxo');
      if (!current.length) {
        alertMsg('Belum ada UTXO. Dompet belum memiliki BTC yang dapat dikirim.', 'error');
        return;
      }
      const fee = Math.ceil(vbytesEstimate(current.length, 2) * feeRate);
      if (sendSats + fee > balanceSats) {
        alertMsg('Saldo tidak cukup untuk jumlah dan biaya jaringan.', 'error');
        return;
      }
      if (!confirm(
        'Kirim ' + fmtBtc(sendSats) + ' ke ' + dest +
        '?\\nPerkiraan biaya: ' + fee + ' sats. Transaksi tidak dapat dibatalkan.'
      )) return;

      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });
      let total = 0;
      for (const u of current) {
        const prev = await getJson(ESPLORA + '/tx/' + u.txid);
        const out = prev.vout[u.vout];
        const scriptBytes = Uint8Array.from(
          (out.scriptpubkey.match(/.{2}/g) || []).map(x => parseInt(x, 16))
        );
        psbt.addInput({
          hash: u.txid,
          index: u.vout,
          witnessUtxo: { script: scriptBytes, value: Number(out.value) }
        });
        total += Number(out.value);
      }
      const change = total - sendSats - fee;
      psbt.addOutput({ address: dest, value: sendSats });
      if (change > 546) psbt.addOutput({ address: wallet.address, value: change });
      psbt.signAllInputs(wallet.keyPair);
      psbt.finalizeAllInputs();
      const raw = psbt.extractTransaction().toHex();
      const resp = await fetch(ESPLORA + '/tx', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: raw
      });
      const txid = await resp.text();
      if (!resp.ok) throw new Error('Broadcast gagal: ' + txid);
      saveLocalTx({
        txid: txid, createdAt: Date.now(), amount: sendSats,
        fee: fee, destination: dest, status: 'broadcast'
      });
      alertMsg('Transaksi dikirim ke jaringan. ID: ' + txid, 'success');
      if ($('btc-amount')) $('btc-amount').value = '';
      await loadChain();
    } catch (e) {
      alertMsg('Transaksi tidak terkirim: ' + (e.message || e), 'error');
    }
  }

  function lock(clearAlert) {
    if (clearAlert === undefined) clearAlert = true;
    wallet = null;
    password = null;
    utxos = [];
    balanceSats = 0;
    if ($('btc-wallet-panel')) $('btc-wallet-panel').hidden = true;
    if ($('btc-lock-panel')) $('btc-lock-panel').hidden = false;
    hideSubpanels();
    if (clearAlert) alertMsg('');
  }

  function copyAddress() {
    if (!wallet) return;
    navigator.clipboard.writeText(wallet.address)
      .then(() => alertMsg('Alamat BTC disalin.', 'success'))
      .catch(() => alertMsg(
        'Tidak dapat menyalin otomatis. Tekan lama alamat untuk menyalin.',
        'error'
      ));
  }

  async function refresh() {
    if (!wallet) {
      alertMsg('Buka dompet terlebih dahulu.', 'error');
      return;
    }
    try {
      await Promise.all([loadMarket(), loadFees()]);
      await loadChain();
      alertMsg('Saldo dan riwayat diperbarui.', 'success');
    } catch (e) {
      alertMsg('Gagal memperbarui blockchain: ' + e.message, 'error');
    }
  }

  function bindAmount() {
    const el = $('btc-amount');
    if (el && !el._btcBound) {
      el._btcBound = true;
      el.addEventListener('input', updateTotal);
    }
  }

  // Eager preload (non-blocking) so first open is faster
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(function () { ensureLibs().catch(function () {}); }, { timeout: 4000 });
  } else {
    setTimeout(function () { ensureLibs().catch(function () {}); }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAmount);
  } else {
    bindAmount();
  }

  // Real API — replaces stub immediately
  window.DKBTC = {
    open: open, close: close, unlock: unlock, confirmRecovery: confirmRecovery,
    showReceive: showReceive, showSend: showSend, copyAddress: copyAddress,
    send: send, refresh: refresh, lock: lock,
    ready: function () { return libsReady; },
    ensureLibs: ensureLibs
  };

  console.log('[DKBTC] Bitcoin wallet module ready (dynamic CDN) ✅');
})();
