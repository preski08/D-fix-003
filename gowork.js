/* ============================================================
   GO WORK v3 — Dompetku
   - GPS lokasi nyata + filter radius (seperti FB Nearby)
   - Tanpa user palsu / demo bot
   - Profil + portofolio + riwayat kerja + rating
   - Buka chat = biaya koneksi Rp 500 (potong saldo Dompetku)
   ============================================================ */
(function () {
  'use strict';

  var CONN_FEE = 500;
  var JOB_FEES = { harian: 500, kontrak: 2000, tetap: 5000 };
  var JOB_LABELS = { harian: 'Buruh Harian', kontrak: 'Kontrak', tetap: 'Karyawan Tetap' };
  var DEFAULT_RADIUS_KM = 15;
  var DEFAULT_LAT = -6.175392, DEFAULT_LNG = 106.827153;

  function injectCSS() {
    if (document.getElementById('gw-styles')) return;
    var s = document.createElement('style');
    s.id = 'gw-styles';
    s.textContent = `
      #gw-topbar-btn {
        display: flex; align-items: center; justify-content: center;
        width: 42px; min-width: 42px; height: auto; padding: 5px 2px 4px; border-radius: 13px;
        position: relative;
        background: rgba(209,250,229,.75);
        border: 1px solid rgba(16,185,129,.4);
        cursor: pointer; transition: all .15s;
        color: #059669; flex-direction: column; gap: 1px;
        box-shadow: 0 4px 12px rgba(15,23,42,.06), inset 0 1px 0 #fff;
        backdrop-filter: blur(12px);
      }
      #gw-topbar-btn:hover, #gw-topbar-btn:active {
        background: rgba(167,243,208,.9);
        border-color: rgba(16,185,129,.55);
      }
      #gw-topbar-btn svg { width: 17px; height: 17px; stroke: #059669; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
      #gw-topbar-btn .lbl {
        position: static; bottom: auto; left: auto; transform: none;
        font-size: 7.5px; font-weight: 700; color: #059669; letter-spacing: .15px;
        text-transform: uppercase; white-space: nowrap; pointer-events: none; opacity: .95;
        line-height: 1.1; margin-top: 1px;
      }
      .gw-overlay {
        display: none; position: fixed; inset: 0; z-index: 99999;
        justify-content: center; align-items: center;
        padding: 12px; box-sizing: border-box; font-family: inherit; color: #1e293b;
        background:
          radial-gradient(ellipse 90% 60% at 10% 0%,rgba(167,139,250,.28),transparent 55%),
          radial-gradient(ellipse 70% 50% at 95% 15%,rgba(96,165,250,.22),transparent 50%),
          radial-gradient(ellipse 60% 45% at 50% 100%,rgba(52,211,153,.18),transparent 50%),
          linear-gradient(165deg,#eef2ff 0%,#e0f2fe 45%,#f0fdf4 100%);
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      }
      .gw-overlay.gw-open { display: flex; }
      .gw-overlay::before {
        content: ''; position: absolute; inset: -40%;
        background: conic-gradient(from 0deg at 50% 50%,
          transparent 0deg, rgba(167,139,250,.1) 50deg, transparent 110deg,
          rgba(96,165,250,.08) 170deg, transparent 230deg, rgba(52,211,153,.06) 290deg, transparent 360deg);
        animation: gwSpin 45s linear infinite; pointer-events: none; z-index: 0;
      }
      @keyframes gwSpin { to { transform: rotate(360deg); } }
      .gw-modal {
        position: relative; z-index: 1;
        background: rgba(255,255,255,.72);
        width: 100%; max-width: 420px; border-radius: 26px; padding: 22px;
        max-height: 92vh; overflow-y: auto;
        box-shadow: 0 24px 60px rgba(15,23,42,.12), inset 0 1px 0 #fff;
        border: 1px solid rgba(255,255,255,.9); box-sizing: border-box;
        backdrop-filter: blur(32px); -webkit-backdrop-filter: blur(32px);
      }
      .gw-modal::-webkit-scrollbar { width: 5px; }
      .gw-modal::-webkit-scrollbar-thumb { background: rgba(100,116,139,.3); border-radius: 3px; }
      .gw-close {
        position: absolute; top: 12px; right: 14px;
        background: rgba(255,255,255,.65); border: 1px solid rgba(255,255,255,.9); color: #64748b;
        width: 34px; height: 34px; border-radius: 12px; font-size: 18px;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 12px rgba(15,23,42,.06);
      }
      .gw-close:hover { color: #ef4444; background: rgba(254,226,226,.9); }
      .gw-title { text-align: center; margin: 0 0 4px; font-size: 20px; font-weight: 800; color: #1e293b; }
      .gw-subtitle { text-align: center; color: #64748b; font-size: 13px; margin: 0 0 18px; }
      .gw-role-list { display: flex; flex-direction: column; gap: 12px; }
      .gw-role {
        background: rgba(255,255,255,.55); border: 1px solid rgba(255,255,255,.85);
        color: #1e293b; padding: 16px; border-radius: 18px; cursor: pointer;
        text-align: left; transition: .2s; font-family: inherit; width: 100%;
        box-shadow: 0 8px 22px rgba(15,23,42,.06), inset 0 1px 0 #fff;
        backdrop-filter: blur(14px);
      }
      .gw-role:hover { border-color: rgba(16,185,129,.5); background: rgba(209,250,229,.55); box-shadow: 0 10px 28px rgba(16,185,129,.15); }
      .gw-role h3 { margin: 0 0 4px; color: #059669; font-size: 16px; }
      .gw-role p { margin: 0; font-size: 12px; color: #64748b; line-height: 1.4; }
      .gw-back {
        background: none; border: none; color: #7C3AED; cursor: pointer;
        padding: 0; margin-bottom: 14px; font-size: 13px; font-family: inherit; font-weight: 600;
      }
      .gw-h3 { margin: 0 0 12px; color: #1e293b; font-size: 15px; font-weight: 700; }
      .gw-field { margin-bottom: 14px; }
      .gw-field label {
        display: block; margin-bottom: 6px;
        font-size: 11px; color: #64748b; font-weight: 600;
        text-transform: uppercase; letter-spacing: .6px;
      }
      .gw-field input, .gw-field textarea, .gw-field select {
        width: 100%; padding: 12px 14px; border-radius: 14px;
        border: 1px solid rgba(255,255,255,.9); background: rgba(255,255,255,.7);
        color: #1e293b; box-sizing: border-box; font-family: inherit; font-size: 14px;
        box-shadow: inset 0 1px 2px rgba(0,0,0,.03);
      }
      .gw-field input:focus, .gw-field textarea:focus, .gw-field select:focus {
        border-color: rgba(124,58,237,.45); outline: none;
        box-shadow: 0 0 0 3px rgba(124,58,237,.12); background: #fff;
      }
      .gw-skill-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
      .gw-skill-row input { flex: 1; }
      .gw-skill-row button {
        width: 40px; height: 40px; border: none; border-radius: 12px;
        cursor: pointer; font-weight: 800; font-size: 18px; color: #fff;
        flex-shrink: 0; font-family: inherit;
        box-shadow: 0 4px 12px rgba(15,23,42,.1);
      }
      .gw-plus { background: linear-gradient(135deg,#34d399,#10b981); }
      .gw-minus { background: linear-gradient(135deg,#f87171,#ef4444); }
      .gw-map {
        width: 100%; height: 200px; border-radius: 16px; margin-bottom: 14px;
        z-index: 1; border: 1px solid rgba(255,255,255,.85); overflow: hidden;
        box-shadow: 0 8px 24px rgba(15,23,42,.08);
      }
      .gw-submit {
        width: 100%; padding: 14px; border: none; border-radius: 16px;
        background: linear-gradient(135deg,#10b981,#3b82f6);
        color: #fff; font-weight: 700; font-size: 15px; cursor: pointer;
        font-family: inherit; box-shadow: 0 8px 24px rgba(16,185,129,.3);
        border: 1px solid rgba(255,255,255,.4);
      }
      .gw-submit:active { transform: scale(.98); }
      .gw-search-row { display: flex; gap: 8px; margin-bottom: 10px; }
      .gw-search-row input { flex: 1; }
      .gw-search-row button {
        padding: 0 16px; background: linear-gradient(135deg,#a78bfa,#60a5fa); border: none; border-radius: 14px;
        color: #fff; font-weight: 700; cursor: pointer; font-family: inherit; font-size: 13px;
        white-space: nowrap; box-shadow: 0 6px 18px rgba(124,58,237,.25);
      }
      .gw-radius-row {
        display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
        font-size: 12px; color: #64748b;
      }
      .gw-radius-row select {
        background: rgba(255,255,255,.7); border: 1px solid rgba(255,255,255,.9);
        color: #1e293b; border-radius: 12px; padding: 8px 12px; font-family: inherit;
      }
      .gw-result {
        background: rgba(255,255,255,.55); padding: 14px;
        border-radius: 18px; margin-bottom: 10px;
        border: 1px solid rgba(255,255,255,.85);
        display: flex; flex-direction: column; gap: 10px;
        box-shadow: 0 8px 22px rgba(15,23,42,.06), inset 0 1px 0 #fff;
        backdrop-filter: blur(14px);
      }
      .gw-result:hover { border-color: rgba(167,139,250,.4); box-shadow: 0 12px 28px rgba(124,58,237,.1); }
      .gw-result-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
      .gw-result h4 { margin: 0 0 3px; color: #1e293b; font-size: 14px; font-weight: 700; }
      .gw-result .gw-skills { margin: 0; font-size: 12px; color: #059669; font-weight: 600; }
      .gw-result .gw-desc { margin: 4px 0 0; font-size: 11.5px; color: #64748b; line-height: 1.35; }
      .gw-result .gw-price { color: #059669; font-weight: 800; font-size: 14px; white-space: nowrap; }
      .gw-result-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .gw-btn-msg, .gw-btn-map, .gw-btn-prof {
        flex: 1; min-width: 90px; padding: 10px; border-radius: 12px; border: none;
        font-weight: 700; font-size: 12px; cursor: pointer; font-family: inherit;
        box-shadow: 0 4px 12px rgba(15,23,42,.08);
      }
      .gw-btn-msg { background: linear-gradient(135deg,#34d399,#10b981); color: #fff; }
      .gw-btn-map { background: rgba(255,255,255,.7); color: #1e293b; border: 1px solid rgba(255,255,255,.9); }
      .gw-btn-prof { background: linear-gradient(135deg,rgba(167,139,250,.9),rgba(96,165,250,.85)); color: #fff; }
      .gw-empty { color: #64748b; font-size: 13px; text-align: center; padding: 20px 16px;
        background: rgba(255,255,255,.4); border: 1px dashed rgba(148,163,184,.35); border-radius: 16px; }
      .gw-hidden { display: none !important; }
      .gw-badge-online {
        display: inline-block; width: 8px; height: 8px; border-radius: 50%;
        background: #10b981; margin-right: 5px; box-shadow: 0 0 6px #10b981;
      }
      .gw-badge-off { background: #94a3b8; box-shadow: none; }
      .gw-dist { font-size: 11px; color: #64748b; margin-top: 2px; }
      .gw-stars { color: #F59E0B; font-size: 12px; letter-spacing: 1px; }
      .gw-stars span { color: #64748b; font-size: 11px; margin-left: 4px; letter-spacing: 0; }
      .gw-port-item {
        background: rgba(255,255,255,.5); border-radius: 14px; padding: 12px;
        margin-bottom: 8px; border: 1px solid rgba(255,255,255,.8);
        box-shadow: 0 4px 12px rgba(15,23,42,.04);
      }
      .gw-port-item h5 { margin: 0 0 4px; font-size: 13px; color: #1e293b; }
      .gw-port-item p { margin: 0; font-size: 11.5px; color: #64748b; line-height: 1.35; }
      .gw-rate-row { display: flex; gap: 6px; margin: 8px 0; }
      .gw-rate-star {
        background: rgba(255,255,255,.65); border: 1px solid rgba(255,255,255,.9); color: #94a3b8;
        font-size: 22px; cursor: pointer; padding: 4px 6px; border-radius: 10px;
      }
      .gw-rate-star.on { color: #F59E0B; background: rgba(254,243,199,.8); }
      .gw-fee-note {
        background: rgba(254,243,199,.55); border: 1px solid rgba(251,191,36,.35);
        color: #92400e; font-size: 12px; padding: 12px 14px; border-radius: 14px;
        margin-bottom: 12px; line-height: 1.45;
        box-shadow: 0 4px 14px rgba(245,158,11,.08);
      }
      .gw-tabs { display: flex; gap: 6px; margin-bottom: 14px; }
      .gw-tab {
        flex: 1; padding: 10px; border: 1px solid rgba(255,255,255,.8); border-radius: 12px;
        background: rgba(255,255,255,.5); color: #64748b; font-weight: 700;
        font-size: 12px; cursor: pointer; font-family: inherit;
        box-shadow: 0 2px 8px rgba(15,23,42,.04);
      }
      .gw-tab.on {
        background: linear-gradient(135deg,rgba(16,185,129,.9),rgba(52,211,153,.85));
        color: #fff; border-color: rgba(255,255,255,.5);
        box-shadow: 0 6px 16px rgba(16,185,129,.25);
      }
    `;
    document.head.appendChild(s);
  }

  function injectLeaflet(cb) {
    if (window.L && window.L.map) { cb(); return; }
    if (!document.getElementById('gw-leaflet-css')) {
      var l = document.createElement('link');
      l.id = 'gw-leaflet-css';
      l.rel = 'stylesheet';
      l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(l);
    }
    var s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = cb;
    s.onerror = function () { console.warn('[GoWork] Leaflet gagal load'); };
    document.head.appendChild(s);
  }

  function injectButton() {
    if (document.getElementById('gw-topbar-btn')) return true;
    var container = document.querySelector('.header-actions');
    if (!container) {
      var all = document.querySelectorAll('button');
      for (var i = 0; i < all.length; i++) {
        var t = (all[i].textContent || '').toUpperCase();
        if (t.indexOf('KELUAR') !== -1 || t.indexOf('LOGOUT') !== -1) {
          container = all[i].parentElement;
          break;
        }
      }
    }
    if (!container) return false;
    var btn = document.createElement('button');
    btn.id = 'gw-topbar-btn';
    btn.type = 'button';
    btn.title = 'Go Work';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>' +
      '<span class="lbl">Work</span>';
    btn.onclick = openGoWork;
    var last = container.lastElementChild;
    if (last) container.insertBefore(btn, last);
    else container.appendChild(btn);
    return true;
  }

  function injectModal() {
    if (document.getElementById('gwOverlay')) return;
    var div = document.createElement('div');
    div.innerHTML =
      '<div class="gw-overlay" id="gwOverlay">' +
        '<div class="gw-modal">' +
          '<button class="gw-close" type="button" onclick="GW_close()">&times;</button>' +
          '<div id="gwRoleSelect">' +
            '<h2 class="gw-title">🛠️ Go Work</h2>' +
            '<p class="gw-subtitle">Pekerja nyata di sekitar Anda · GPS + radius</p>' +
            '<div class="gw-role-list">' +
              '<button class="gw-role" type="button" onclick="GW_showSeeker()">' +
                '<h3>🔍 Tawarkan Jasa / Profil Saya</h3>' +
                '<p>Isi keahlian, portofolio, lokasi GPS — tampil di peta untuk pencari kerja</p>' +
              '</button>' +
              '<button class="gw-role" type="button" onclick="GW_showEmployer()">' +
                '<h3>👷 Cari Pekerja Terdekat</h3>' +
                '<p>Cari berdasarkan skill & radius dari lokasi Anda. Chat = biaya koneksi Rp 500</p>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div id="gwSeekerView" class="gw-hidden">' +
            '<button class="gw-back" type="button" onclick="GW_back()">&larr; Kembali</button>' +
            '<div class="gw-tabs">' +
              '<button type="button" class="gw-tab on" id="gwTabProf" onclick="GW_seekerTab(\'prof\')">Profil</button>' +
              '<button type="button" class="gw-tab" id="gwTabPort" onclick="GW_seekerTab(\'port\')">Portofolio</button>' +
              '<button type="button" class="gw-tab" id="gwTabRate" onclick="GW_seekerTab(\'rate\')">Rating</button>' +
            '</div>' +
            '<div id="gwSeekerProf">' +
              '<h3 class="gw-h3">Keahlian Saya</h3>' +
              '<div id="gwSkills"></div>' +
              '<div class="gw-field">' +
                '<label>Kategori Pekerjaan</label>' +
                '<select id="gwMyCat">' +
                  '<option value="harian">Buruh Harian</option>' +
                  '<option value="kontrak">Kontrak</option>' +
                  '<option value="tetap">Karyawan Tetap</option>' +
                '</select>' +
              '</div>' +
              '<div class="gw-field">' +
                '<label>Deskripsi & Upah</label>' +
                '<textarea id="gwDesc" rows="3" placeholder="Contoh: Upah pasang 1 colokan 80.000"></textarea>' +
              '</div>' +
              '<div class="gw-field">' +
                '<label>Lokasi (GPS / geser pin)</label>' +
                '<div id="gwMapSeeker" class="gw-map"></div>' +
                '<button type="button" class="gw-btn-map" style="width:100%;margin-bottom:10px" onclick="GW_useMyLocation(true)">📍 Pakai Lokasi Saya (GPS)</button>' +
              '</div>' +
              '<button class="gw-submit" type="button" onclick="GW_saveProfile()">💾 Simpan & Tampilkan di Peta</button>' +
            '</div>' +
            '<div id="gwSeekerPort" class="gw-hidden">' +
              '<h3 class="gw-h3">Portofolio / Riwayat Kerja</h3>' +
              '<p style="font-size:12px;color:#8B8B9C;margin:0 0 12px">Unggah foto hasil kerja, sertifikat, CV, atau PDF untuk dipamerkan.</p>' +
              '<div id="gwPortList"></div>' +
              '<div class="gw-field"><label>Judul</label><input type="text" id="gwPortTitle" placeholder="Servis AC rumah / Sertifikat / CV"></div>' +
              '<div class="gw-field"><label>Keterangan</label><textarea id="gwPortDesc" rows="2" placeholder="Ringkasan pekerjaan / deskripsi file"></textarea></div>' +
              '<div class="gw-field"><label>Unggah Foto / Sertifikat / CV / PDF</label>' +
                '<input type="file" id="gwPortFile" accept="image/*,.pdf,application/pdf" style="padding:10px">' +
              '</div>' +
              '<button class="gw-submit" type="button" onclick="GW_addPortfolio()">➕ Tambah ke Portofolio</button>' +
            '</div>' +
            '<div id="gwSeekerRate" class="gw-hidden">' +
              '<h3 class="gw-h3">Rating dari pencari kerja</h3>' +
              '<div id="gwMyRatings"></div>' +
            '</div>' +
          '</div>' +
          '<div id="gwEmployerView" class="gw-hidden">' +
            '<button class="gw-back" type="button" onclick="GW_back()">&larr; Kembali</button>' +
            '<h3 class="gw-h3">Lowongan & Pekerja Terdekat</h3>' +
            '<div class="gw-fee-note">📍 <b>Wajib aktifkan GPS</b> · Peta OpenStreetMap + buka Google Maps.<br>' +
            '💬 Biaya koneksi chat menurut kategori:<br>' +
            '• Buruh Harian <b>Rp 500</b> · Kontrak <b>Rp 2.000</b> · Karyawan Tetap <b>Rp 5.000</b><br>' +
            '(sekali per pasangan, dipotong dari saldo Dompetku)</div>' +
            '<div class="gw-field" style="margin-bottom:10px">' +
              '<label>Kategori pekerjaan yang dicari</label>' +
              '<select id="gwJobCat">' +
                '<option value="harian">Buruh Harian (koneksi Rp 500)</option>' +
                '<option value="kontrak">Kontrak (koneksi Rp 2.000)</option>' +
                '<option value="tetap">Karyawan Tetap (koneksi Rp 5.000)</option>' +
              '</select>' +
            '</div>' +
            '<div class="gw-search-row">' +
              '<input type="text" id="gwSearch" placeholder="babat rumput / listrik / bengkel">' +
              '<button type="button" onclick="GW_search()">Cari</button>' +
            '</div>' +
            '<div class="gw-radius-row">' +
              '<span>Radius</span>' +
              '<select id="gwRadius">' +
                '<option value="5">5 km</option>' +
                '<option value="10">10 km</option>' +
                '<option value="15" selected>15 km</option>' +
                '<option value="25">25 km</option>' +
                '<option value="50">50 km</option>' +
              '</select>' +
              '<button type="button" class="gw-btn-map" style="padding:8px 12px;flex:0" onclick="GW_useMyLocation(false)">📍 GPS</button>' +
            '</div>' +
            '<div id="gwMapEmployer" class="gw-map"></div>' +
            '<p style="font-size:11px;color:#8B8B9C;margin:0 0 8px;text-align:center">Hasil diurutkan dari yang <b>terdekat</b> · Klik 🗺️ buka Google Maps</p>' +
            '<div id="gwResults"><p class="gw-empty">Aktifkan GPS lalu cari. Hanya pekerja nyata di radius yang tampil.</p></div>' +
          '</div>' +
          '<div id="gwProfileView" class="gw-hidden">' +
            '<button class="gw-back" type="button" onclick="GW_backToEmployer()">&larr; Kembali</button>' +
            '<div id="gwProfileBody"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(div.firstElementChild);
  }

  var mapSeeker = null, mapEmployer = null;
  var markerSeeker = null, markersEmployer = [];
  var myLat = DEFAULT_LAT, myLng = DEFAULT_LNG;
  var gpsReady = false;

  function getUserId() {
    try {
      if (window.currentUser && window.currentUser.id) return window.currentUser.id;
    } catch (e) {}
    try {
      var s = JSON.parse(localStorage.getItem('dk_session') || 'null');
      return s && s.id ? s.id : null;
    } catch (e) { return null; }
  }

  function profileKey() { return 'dk_gowork_profile_' + (getUserId() || 'guest'); }
  function listingsKey() { return 'dk_gowork_listings_v3'; }
  function ratingsKey() { return 'dk_gowork_ratings'; }

  function loadProfile() {
    try {
      return JSON.parse(localStorage.getItem(profileKey()) || 'null') || {
        skills: [''], desc: '', lat: myLat, lng: myLng, portfolio: [], category: 'harian'
      };
    } catch (e) {
      return { skills: [''], desc: '', lat: myLat, lng: myLng, portfolio: [], category: 'harian' };
    }
  }
  function saveProfileLocal(p) {
    try { localStorage.setItem(profileKey(), JSON.stringify(p)); } catch (e) {}
  }

  function getListings() {
    var list = [];
    try { list = JSON.parse(localStorage.getItem(listingsKey()) || '[]'); } catch (e) { list = []; }
    var realIds = {};
    try { JSON.parse(localStorage.getItem('dk_users') || '[]').forEach(function (u) { if (u && !u.ghost) realIds[u.id] = 1; }); } catch (e) {}
    list = list.filter(function (x) {
      return x && x.userId && realIds[x.userId] && String(x.id || '').indexOf('demo-') !== 0 &&
        !/^(budi44|andiservice|tukanglistrik|slametbangunan|jokoelektronik)$/i.test(x.userId);
    });
    try { localStorage.removeItem('dk_gowork_listings'); } catch (e) {}
    return list;
  }

  function upsertListing(entry) {
    var list = getListings();
    var idx = list.findIndex(function (x) { return x.userId === entry.userId; });
    if (idx >= 0) list[idx] = entry;
    else list.unshift(entry);
    try { localStorage.setItem(listingsKey(), JSON.stringify(list)); } catch (e) {}
  }

  function getRatings(userId) {
    var all = {};
    try { all = JSON.parse(localStorage.getItem(ratingsKey()) || '{}'); } catch (e) {}
    return all[userId] || [];
  }
  function addRating(toUserId, fromUserId, stars, note) {
    var all = {};
    try { all = JSON.parse(localStorage.getItem(ratingsKey()) || '{}'); } catch (e) {}
    if (!all[toUserId]) all[toUserId] = [];
    all[toUserId] = all[toUserId].filter(function (r) { return r.from !== fromUserId; });
    all[toUserId].unshift({ from: fromUserId, stars: stars, note: note || '', ts: Date.now() });
    try { localStorage.setItem(ratingsKey(), JSON.stringify(all)); } catch (e) {}
  }
  function avgRating(userId) {
    var rs = getRatings(userId);
    if (!rs.length) return { avg: 0, n: 0 };
    var s = 0;
    rs.forEach(function (r) { s += r.stars; });
    return { avg: s / rs.length, n: rs.length };
  }

  function haversineKm(lat1, lng1, lat2, lng2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function starsHtml(avg, n) {
    var full = Math.round(avg);
    var s = '';
    for (var i = 1; i <= 5; i++) s += i <= full ? '★' : '☆';
    return '<div class="gw-stars">' + s + (n ? '<span>(' + n + ')</span>' : '') + '</div>';
  }

  function openGoWork() {
    if (!getUserId()) {
      alert('Login dulu untuk memakai Go Work.');
      return;
    }
    injectCSS();
    injectModal();
    var ov = document.getElementById('gwOverlay');
    if (ov) ov.classList.add('gw-open');
    backToRole();
    requestGPS(function () {
      setTimeout(function () {
        if (mapSeeker) mapSeeker.invalidateSize();
        if (mapEmployer) mapEmployer.invalidateSize();
      }, 250);
    });
  }
  function closeGoWork() {
    var ov = document.getElementById('gwOverlay');
    if (ov) ov.classList.remove('gw-open');
  }
  function backToRole() {
    document.getElementById('gwRoleSelect').classList.remove('gw-hidden');
    document.getElementById('gwSeekerView').classList.add('gw-hidden');
    document.getElementById('gwEmployerView').classList.add('gw-hidden');
    document.getElementById('gwProfileView').classList.add('gw-hidden');
  }
  function backToEmployer() {
    document.getElementById('gwProfileView').classList.add('gw-hidden');
    document.getElementById('gwEmployerView').classList.remove('gw-hidden');
  }

  function requestGPS(cb) {
    if (!navigator.geolocation) {
      if (cb) cb(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(function (pos) {
      myLat = pos.coords.latitude;
      myLng = pos.coords.longitude;
      gpsReady = true;
      if (cb) cb(true);
    }, function () {
      if (cb) cb(false);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  function renderSkills(skills) {
    var box = document.getElementById('gwSkills');
    box.innerHTML = '';
    (skills && skills.length ? skills : ['']).forEach(function (s) {
      addSkillRow(s);
    });
  }
  function addSkillRow(val) {
    var box = document.getElementById('gwSkills');
    var row = document.createElement('div');
    row.className = 'gw-skill-row';
    row.innerHTML =
      '<input type="text" value="' + escapeHtml(val || '') + '" placeholder="Contoh: Teknisi Listrik">' +
      '<button class="gw-minus" type="button">−</button>' +
      '<button class="gw-plus" type="button">+</button>';
    row.querySelector('.gw-plus').onclick = function () { addSkillRow(''); };
    row.querySelector('.gw-minus').onclick = function () {
      if (box.children.length > 1) row.remove();
      else alert('Minimal satu keahlian.');
    };
    box.appendChild(row);
  }

  function seekerTab(tab) {
    document.getElementById('gwSeekerProf').classList.toggle('gw-hidden', tab !== 'prof');
    document.getElementById('gwSeekerPort').classList.toggle('gw-hidden', tab !== 'port');
    document.getElementById('gwSeekerRate').classList.toggle('gw-hidden', tab !== 'rate');
    document.getElementById('gwTabProf').classList.toggle('on', tab === 'prof');
    document.getElementById('gwTabPort').classList.toggle('on', tab === 'port');
    document.getElementById('gwTabRate').classList.toggle('on', tab === 'rate');
    if (tab === 'port') renderPortfolioEditor();
    if (tab === 'rate') renderMyRatings();
    if (tab === 'prof' && mapSeeker) setTimeout(function () { mapSeeker.invalidateSize(); }, 100);
  }

  function renderPortfolioEditor() {
    var prof = loadProfile();
    var box = document.getElementById('gwPortList');
    var items = prof.portfolio || [];
    if (!items.length) {
      box.innerHTML = '<p class="gw-empty">Belum ada portofolio. Tambahkan pekerjaan, foto hasil, sertifikat, atau CV (PDF/gambar).</p>';
      return;
    }
    box.innerHTML = '';
    items.forEach(function (p, i) {
      var d = document.createElement('div');
      d.className = 'gw-port-item';
      var mediaHtml = '';
      if (p.media) {
        if ((p.mediaType || '').indexOf('image') === 0) {
          mediaHtml = '<img src="' + p.media + '" alt="" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;margin:6px 0">';
        } else {
          mediaHtml = '<a href="' + p.media + '" download="' + escapeHtml(p.mediaName || 'file.pdf') + '" style="display:inline-block;margin:6px 0;padding:8px 12px;background:rgba(124,58,237,.2);border-radius:8px;color:#c4b5fd;font-size:12px;font-weight:600">📄 ' + escapeHtml(p.mediaName || 'PDF / File') + '</a>';
        }
      }
      d.innerHTML = '<h5>' + escapeHtml(p.title) + '</h5><p>' + escapeHtml(p.desc || '') + '</p>' + mediaHtml +
        '<button type="button" class="gw-btn-map" style="margin-top:8px;padding:6px" data-i="' + i + '">Hapus</button>';
      d.querySelector('button').onclick = function () {
        var pr = loadProfile();
        pr.portfolio.splice(i, 1);
        saveProfileLocal(pr);
        var list = getListings();
        var me = list.find(function (x) { return x.userId === getUserId(); });
        if (me) { me.portfolio = pr.portfolio; upsertListing(me); }
        renderPortfolioEditor();
      };
      box.appendChild(d);
    });
  }

  function addPortfolio() {
    var title = (document.getElementById('gwPortTitle').value || '').trim();
    var desc = (document.getElementById('gwPortDesc').value || '').trim();
    if (!title) { alert('Isi judul pekerjaan / sertifikat / CV'); return; }
    var fileInp = document.getElementById('gwPortFile');
    var file = fileInp && fileInp.files && fileInp.files[0];
    function finish(media) {
      var pr = loadProfile();
      if (!pr.portfolio) pr.portfolio = [];
      var item = { title: title, desc: desc, ts: Date.now() };
      if (media) {
        item.media = media.data;
        item.mediaType = media.type;
        item.mediaName = media.name;
      }
      pr.portfolio.unshift(item);
      // keep portfolio lean — max 8 items, max ~400KB each stored
      if (pr.portfolio.length > 8) pr.portfolio = pr.portfolio.slice(0, 8);
      saveProfileLocal(pr);
      var list = getListings();
      var me = list.find(function (x) { return x.userId === getUserId(); });
      if (me) { me.portfolio = pr.portfolio; upsertListing(me); }
      document.getElementById('gwPortTitle').value = '';
      document.getElementById('gwPortDesc').value = '';
      if (fileInp) fileInp.value = '';
      renderPortfolioEditor();
      alert('✅ Portofolio ditambahkan' + (media ? ' (+ file)' : ''));
    }
    if (!file) { finish(null); return; }
    if (file.size > 800 * 1024) { alert('File terlalu besar (maks ~800 KB). Kompres dulu.'); return; }
    var fr = new FileReader();
    fr.onload = function () {
      finish({ data: fr.result, type: file.type || 'file', name: file.name || 'file' });
    };
    fr.onerror = function () { alert('Gagal baca file'); };
    fr.readAsDataURL(file);
  }

  function renderMyRatings() {
    var uid = getUserId();
    var rs = getRatings(uid);
    var box = document.getElementById('gwMyRatings');
    var av = avgRating(uid);
    var html = starsHtml(av.avg, av.n);
    if (!rs.length) {
      box.innerHTML = html + '<p class="gw-empty">Belum ada rating dari pencari kerja.</p>';
      return;
    }
    html += rs.map(function (r) {
      return '<div class="gw-port-item"><h5>' + escapeHtml(r.from) + ' · ' +
        '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars) + '</h5><p>' +
        escapeHtml(r.note || '—') + '</p></div>';
    }).join('');
    box.innerHTML = html;
  }

  function showSeeker() {
    document.getElementById('gwRoleSelect').classList.add('gw-hidden');
    document.getElementById('gwSeekerView').classList.remove('gw-hidden');
    document.getElementById('gwEmployerView').classList.add('gw-hidden');
    document.getElementById('gwProfileView').classList.add('gw-hidden');
    seekerTab('prof');
    var prof = loadProfile();
    renderSkills(prof.skills);
    document.getElementById('gwDesc').value = prof.desc || '';
    var catEl = document.getElementById('gwMyCat');
    if (catEl) catEl.value = prof.category || 'harian';
    injectLeaflet(function () {
      setTimeout(function () {
        var lat = gpsReady ? myLat : (prof.lat || DEFAULT_LAT);
        var lng = gpsReady ? myLng : (prof.lng || DEFAULT_LNG);
        if (!mapSeeker) {
          mapSeeker = L.map('gwMapSeeker').setView([lat, lng], 15);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
          }).addTo(mapSeeker);
          markerSeeker = L.marker([lat, lng], { draggable: true })
            .addTo(mapSeeker)
            .bindPopup('Geser pin ke lokasi Anda')
            .openPopup();
        } else {
          mapSeeker.invalidateSize();
          mapSeeker.setView([lat, lng], 15);
          if (markerSeeker) markerSeeker.setLatLng([lat, lng]);
        }
      }, 200);
    });
  }

  function useMyLocation(forSeeker) {
    if (!navigator.geolocation) {
      alert('Browser tidak support GPS.');
      return;
    }
    navigator.geolocation.getCurrentPosition(function (pos) {
      myLat = pos.coords.latitude;
      myLng = pos.coords.longitude;
      gpsReady = true;
      if (forSeeker && mapSeeker && markerSeeker) {
        mapSeeker.setView([myLat, myLng], 16);
        markerSeeker.setLatLng([myLat, myLng]);
      } else if (mapEmployer) {
        mapEmployer.setView([myLat, myLng], 14);
        searchWorkers();
      }
    }, function (err) {
      alert('Gagal ambil lokasi: ' + err.message + '\nAktifkan izin lokasi di browser.');
    }, { enableHighAccuracy: true, timeout: 12000 });
  }

  function saveProfile() {
    var inputs = document.querySelectorAll('#gwSkills input');
    var skills = [];
    inputs.forEach(function (inp) {
      var v = inp.value.trim();
      if (v) skills.push(v);
    });
    if (!skills.length) { alert('Isi minimal satu keahlian.'); return; }
    var lat = markerSeeker ? markerSeeker.getLatLng().lat : myLat;
    var lng = markerSeeker ? markerSeeker.getLatLng().lng : myLng;
    var desc = document.getElementById('gwDesc').value.trim();
    var cat = (document.getElementById('gwMyCat') || {}).value || 'harian';
    var uid = getUserId();
    var old = loadProfile();
    var prof = {
      skills: skills, desc: desc, lat: lat, lng: lng, category: cat,
      portfolio: old.portfolio || [], updatedAt: Date.now()
    };
    saveProfileLocal(prof);
    upsertListing({
      id: 'user-' + uid, userId: uid, name: uid, skills: skills,
      desc: desc || skills.join(', '), price: extractPrice(desc) || 'Hubungi',
      lat: lat, lng: lng, online: true, category: cat,
      portfolio: prof.portfolio, updatedAt: Date.now()
    });
    alert('✅ Profil Go Work disimpan!\nAnda bisa ditemukan dalam radius pencarian GPS.');
    closeGoWork();
  }

  function extractPrice(text) {
    if (!text) return null;
    var m = text.match(/(\d[\d.]*)\s*(rb|ribu|000)?/i);
    if (!m) return null;
    var n = parseFloat(m[1].replace(/\./g, ''));
    if (/rb|ribu/i.test(m[2] || '')) n *= 1000;
    if (n < 1000 && !m[2]) n *= 1000;
    return 'Rp ' + n.toLocaleString('id-ID');
  }

  function showEmployer() {
    document.getElementById('gwRoleSelect').classList.add('gw-hidden');
    document.getElementById('gwSeekerView').classList.add('gw-hidden');
    document.getElementById('gwEmployerView').classList.remove('gw-hidden');
    document.getElementById('gwProfileView').classList.add('gw-hidden');
    injectLeaflet(function () {
      setTimeout(function () {
        var lat = gpsReady ? myLat : DEFAULT_LAT;
        var lng = gpsReady ? myLng : DEFAULT_LNG;
        if (!mapEmployer) {
          mapEmployer = L.map('gwMapEmployer').setView([lat, lng], 13);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
          }).addTo(mapEmployer);
        } else {
          mapEmployer.invalidateSize();
          mapEmployer.setView([lat, lng], 13);
        }
        if (!gpsReady) {
          requestGPS(function (ok) {
            if (ok && mapEmployer) mapEmployer.setView([myLat, myLng], 14);
            searchWorkers();
          });
        } else {
          searchWorkers();
        }
      }, 200);
    });
  }

  function searchWorkers() {
    var q = (document.getElementById('gwSearch').value || '').toLowerCase().trim();
    var radius = parseFloat(document.getElementById('gwRadius').value) || DEFAULT_RADIUS_KM;
    var results = document.getElementById('gwResults');
    results.innerHTML = '';
    if (!mapEmployer) {
      results.innerHTML = '<p class="gw-empty">Peta belum siap.</p>';
      return;
    }
    markersEmployer.forEach(function (m) { mapEmployer.removeLayer(m); });
    markersEmployer = [];
    var data = getListings();
    var me = getUserId();
    var center = mapEmployer.getCenter();
    var cLat = center.lat, cLng = center.lng;
    if (gpsReady) { cLat = myLat; cLng = myLng; }

    var filtered = data.filter(function (w) {
      if (!w || !w.userId || w.userId === me) return false;
      if (typeof w.lat !== 'number' || typeof w.lng !== 'number') return false;
      var dist = haversineKm(cLat, cLng, w.lat, w.lng);
      w._dist = dist;
      if (dist > radius) return false;
      var hay = ((w.skills || []).join(' ') + ' ' + (w.desc || '') + ' ' + (w.name || '')).toLowerCase();
      return !q || hay.indexOf(q) !== -1;
    });
    filtered.sort(function (a, b) { return a._dist - b._dist; });

    if (!filtered.length) {
      results.innerHTML = '<p class="gw-empty">Tidak ada pekerja nyata dalam radius ' + radius +
        ' km' + (q ? ' untuk "' + escapeHtml(q) + '"' : '') +
        '.<br><br>Ajak teman daftar & isi profil Go Work, atau perbesar radius / geser peta.</p>';
      return;
    }

    filtered.forEach(function (w) {
      var distTxt = w._dist < 1 ? Math.round(w._dist * 1000) + ' m' : w._dist.toFixed(1) + ' km';
      var av = avgRating(w.userId);
      var connected = typeof window.dkHasConnection === 'function' && window.dkHasConnection(me, w.userId);
      var card = document.createElement('div');
      card.className = 'gw-result';
      card.innerHTML =
        '<div class="gw-result-top">' +
          '<div>' +
            '<h4><span class="gw-badge-online ' + (w.online ? '' : 'gw-badge-off') + '"></span>' +
              escapeHtml(w.name) + '</h4>' +
            starsHtml(av.avg, av.n) +
            '<p class="gw-skills">' + escapeHtml((w.skills || []).join(' · ')) +
              (w.category ? ' · <span style="color:#F59E0B">' + escapeHtml(JOB_LABELS[w.category] || w.category) + '</span>' : '') + '</p>' +
            '<p class="gw-desc">' + escapeHtml(w.desc || '') + '</p>' +
            '<p class="gw-dist">📍 ' + distTxt + ' dari lokasi Anda</p>' +
          '</div>' +
          '<div class="gw-price">' + escapeHtml(w.price || '') + '</div>' +
        '</div>' +
        '<div class="gw-result-actions">' +
          '<button type="button" class="gw-btn-msg" data-uid="' + escapeHtml(w.userId) + '">' +
            (connected ? '💬 Chat' : '💬 Koneksi Rp ' + (JOB_FEES[w.category] || CONN_FEE).toLocaleString('id-ID')) + '</button>' +
          '<button type="button" class="gw-btn-prof" data-uid="' + escapeHtml(w.userId) + '">👤 Profil</button>' +
          '<button type="button" class="gw-btn-map" data-lat="' + w.lat + '" data-lng="' + w.lng + '">🗺️ Google Maps</button>' +
        '</div>';
      results.appendChild(card);
      var mk = L.marker([w.lat, w.lng]).addTo(mapEmployer)
        .bindPopup('<b>' + escapeHtml(w.name) + '</b><br>' +
          escapeHtml((w.skills || []).join(', ')) + '<br>' + escapeHtml(w.price || '') + '<br>' + distTxt);
      markersEmployer.push(mk);
    });

    results.querySelectorAll('.gw-btn-msg').forEach(function (btn) {
      btn.onclick = function () { openChatWith(this.getAttribute('data-uid')); };
    });
    results.querySelectorAll('.gw-btn-prof').forEach(function (btn) {
      btn.onclick = function () { showWorkerProfile(this.getAttribute('data-uid')); };
    });
    results.querySelectorAll('.gw-btn-map').forEach(function (btn) {
      btn.onclick = function () {
        var lat = parseFloat(this.getAttribute('data-lat'));
        var lng = parseFloat(this.getAttribute('data-lng'));
        mapEmployer.setView([lat, lng], 16);
        window.open('https://www.google.com/maps?q=' + lat + ',' + lng, '_blank', 'noopener');
      };
    });
    if (markersEmployer.length) {
      var g = new L.featureGroup(markersEmployer);
      mapEmployer.fitBounds(g.getBounds().pad(0.25));
    }
  }

  function showWorkerProfile(uid) {
    var list = getListings();
    var w = list.find(function (x) { return x.userId === uid; });
    if (!w) { alert('Profil tidak ditemukan'); return; }
    var av = avgRating(uid);
    var port = w.portfolio || [];
    var me = getUserId();
    var connected = typeof window.dkHasConnection === 'function' && window.dkHasConnection(me, uid);
    var html = '<h3 class="gw-h3">' + escapeHtml(w.name) + '</h3>' +
      starsHtml(av.avg, av.n) +
      '<p class="gw-skills" style="margin:8px 0">' + escapeHtml((w.skills || []).join(' · ')) + '</p>' +
      '<p class="gw-desc">' + escapeHtml(w.desc || '') + '</p>' +
      '<p class="gw-price" style="margin:10px 0">' + escapeHtml(w.price || '') + '</p>' +
      '<h3 class="gw-h3">Portofolio</h3>';
    if (!port.length) {
      html += '<p class="gw-empty">Belum ada portofolio.</p>';
    } else {
      port.forEach(function (p) {
        var mhtml = '';
        if (p.media) {
          if ((p.mediaType || '').indexOf('image') === 0) {
            mhtml = '<img src="' + p.media + '" style="width:100%;max-height:160px;object-fit:cover;border-radius:8px;margin:6px 0">';
          } else {
            mhtml = '<a href="' + p.media + '" download="' + escapeHtml(p.mediaName || 'file') + '" style="display:inline-block;margin:6px 0;padding:8px 12px;background:rgba(124,58,237,.2);border-radius:8px;color:#c4b5fd;font-size:12px">📄 ' + escapeHtml(p.mediaName || 'PDF') + '</a>';
          }
        }
        html += '<div class="gw-port-item"><h5>' + escapeHtml(p.title) + '</h5><p>' +
          escapeHtml(p.desc || '') + '</p>' + mhtml + '</div>';
      });
    }
    html += '<h3 class="gw-h3">Beri Rating</h3>' +
      '<div class="gw-rate-row" id="gwRateStars">' +
      [1,2,3,4,5].map(function (i) {
        return '<button type="button" class="gw-rate-star" data-s="' + i + '">★</button>';
      }).join('') + '</div>' +
      '<div class="gw-field"><input type="text" id="gwRateNote" placeholder="Komentar singkat (opsional)"></div>' +
      '<button class="gw-submit" type="button" id="gwRateSubmit">Kirim Rating</button>' +
      '<button class="gw-btn-msg" type="button" style="width:100%;margin-top:10px" id="gwProfChat">' +
      (connected ? '💬 Buka Chat' : '💬 Buka Koneksi (Rp 500)') + '</button>';
    document.getElementById('gwEmployerView').classList.add('gw-hidden');
    document.getElementById('gwProfileView').classList.remove('gw-hidden');
    document.getElementById('gwProfileBody').innerHTML = html;
    var chosen = 0;
    document.querySelectorAll('#gwRateStars .gw-rate-star').forEach(function (b) {
      b.onclick = function () {
        chosen = parseInt(this.getAttribute('data-s'), 10);
        document.querySelectorAll('#gwRateStars .gw-rate-star').forEach(function (x) {
          x.classList.toggle('on', parseInt(x.getAttribute('data-s'), 10) <= chosen);
        });
      };
    });
    document.getElementById('gwRateSubmit').onclick = function () {
      if (!chosen) { alert('Pilih bintang 1–5'); return; }
      if (uid === me) { alert('Tidak bisa rate diri sendiri'); return; }
      addRating(uid, me, chosen, document.getElementById('gwRateNote').value.trim());
      alert('✅ Terima kasih! Rating tersimpan.');
      showWorkerProfile(uid);
    };
    document.getElementById('gwProfChat').onclick = function () { openChatWith(uid); };
  }

  function openChatWith(uid) {
    var me = getUserId();
    if (!me) { alert('Login dulu'); return; }
    if (uid === me) { alert('Tidak bisa chat diri sendiri'); return; }
    try {
      var users = JSON.parse(localStorage.getItem('dk_users') || '[]');
      if (!users.some(function (u) { return u.id === uid && !u.ghost; })) {
        alert('Akun "' + uid + '" tidak terdaftar.');
        return;
      }
    } catch (e) { return; }
    var already = typeof window.dkHasConnection === 'function' && window.dkHasConnection(me, uid);
    if (!already) {
      var catEl = document.getElementById('gwJobCat');
      var cat = (catEl && catEl.value) || 'harian';
      var fee = JOB_FEES[cat] || CONN_FEE;
      // also try worker category from listing
      try {
        var list = getListings();
        var w = list.find(function(x){ return x.userId === uid; });
        if (w && w.category && JOB_FEES[w.category]) fee = JOB_FEES[w.category];
      } catch(e){}
      var conf = confirm(
        'Buka koneksi chat dengan "' + uid + '"?\\n\\n' +
        'Biaya: Rp ' + fee.toLocaleString('id-ID') + ' (sekali saja)\\n' +
        'Dipotong dari saldo Dompetku Anda.'
      );
      if (!conf) return;
      if (typeof window.dkOpenConnection !== 'function') {
        alert('Sistem koneksi belum siap. Muat ulang halaman.');
        return;
      }
      var res = window.dkOpenConnection(me, uid, fee);
      if (!res.ok) {
        alert(res.msg || 'Gagal membuka koneksi');
        return;
      }
      if (!res.already) {
        alert('✅ Koneksi terbuka. Biaya Rp ' + fee.toLocaleString('id-ID') + ' dipotong dari saldo.');
      }
    }
    closeGoWork();
    if (typeof window.dkChatOpen === 'function') {
      window.dkChatOpen();
      setTimeout(function () {
        var inp = document.getElementById('dkc-nwid');
        if (inp) {
          var dlg = document.getElementById('dkc-dlg');
          if (dlg) dlg.classList.add('active');
          inp.value = uid;
        }
      }, 400);
    } else {
      alert('Chat siap. Buka menu Chat lalu ketik ID: ' + uid);
    }
  }

  window.GW_close = closeGoWork;
  window.GW_back = backToRole;
  window.GW_backToEmployer = backToEmployer;
  window.GW_showSeeker = showSeeker;
  window.GW_showEmployer = showEmployer;
  window.GW_saveProfile = saveProfile;
  window.GW_search = searchWorkers;
  window.GW_open = openGoWork;
  window.GW_useMyLocation = useMyLocation;
  window.GW_seekerTab = seekerTab;
  window.GW_addPortfolio = addPortfolio;

  function boot() {
    injectCSS();
    try { localStorage.removeItem('dk_gowork_listings'); } catch (e) {}
    var attempts = 0;
    var timer = setInterval(function () {
      attempts++;
      if (injectButton() || attempts > 50) clearInterval(timer);
    }, 400);
    var lastUser = null;
    setInterval(function () {
      var u = getUserId();
      if (u !== lastUser) {
        lastUser = u;
        if (u) {
          setTimeout(injectButton, 200);
          setTimeout(injectButton, 1200);
        } else {
          var b = document.getElementById('gw-topbar-btn');
          if (b) b.remove();
        }
      }
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  console.log('[GoWork v4] GPS + radius + portfolio media + kategori fee + Google Maps ✅');
})();
