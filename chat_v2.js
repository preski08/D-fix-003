// DOMPETKU CHAT v5 (WA style + gambar + file + folder + lokasi Google Maps)
(function () {
  'use strict';

  function logErr(msg, stack) {
    var b = document.getElementById('debug-box');
    if (b) { b.style.display='block';
      b.textContent='❌ chat_v2.js: '+msg+(stack?'\n📍 '+stack.split('\n').slice(0,3).join('\n'):''); }
    try { console.error('[chat]',msg,stack); } catch(_){}
  }

  try {
    var CHAT_KEY='dk_chats', READ_KEY='dk_chat_read';
    var openWith=null, view='list';
    var recorder=null, recChunks=[], recInterval=null, recStart=0;
    var booted=false;

    function id(x){ return document.getElementById(x); }
    function setText(x,t){ var e=id(x); if(e) e.textContent=t; }
    function setDisp(x,v){ var e=id(x); if(e) e.style.display=v; }
    function addC(x,c){ var e=id(x); if(e) e.classList.add(c); }
    function remC(x,c){ var e=id(x); if(e) e.classList.remove(c); }
    function hasC(x,c){ var e=id(x); return e?e.classList.contains(c):false; }
    function rd(k,d){ try{ return JSON.parse(localStorage.getItem(k))||d; }catch(e){ return d; } }
    function wr(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){ alert('Penyimpanan penuh. Hapus chat/gambar lama.'); } }
    function me(){ var s=rd('dk_session',null); return s&&s.id?s.id:null; }
    function cKey(a,b){ return [a,b].sort().join('|'); }
    function users(){ return rd('dk_users',[]); }
    function userOK(u){ return users().some(function(x){ return x.id===u; }); }
    function getChats(){ return rd(CHAT_KEY,{}); }
    function saveChats(c){ wr(CHAT_KEY,c); }
    function getReads(){ return rd(READ_KEY,{}); }
    function saveReads(m){ wr(READ_KEY,m); }

    function t(ts){
      var d=new Date(ts),n=new Date();
      var hh=('0'+d.getHours()).slice(-2),mm=('0'+d.getMinutes()).slice(-2);
      if(d.toDateString()===n.toDateString()) return hh+':'+mm;
      return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+' '+hh+':'+mm;
    }
    function dayLbl(ts){
      var d=new Date(ts),n=new Date();
      var y=new Date(); y.setDate(y.getDate()-1);
      if(d.toDateString()===n.toDateString()) return 'HARI INI';
      if(d.toDateString()===y.toDateString()) return 'KEMARIN';
      var dn=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
      var mn=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      return (dn[d.getDay()]+', '+d.getDate()+' '+mn[d.getMonth()]).toUpperCase();
    }
    function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
    function durMs(ms){ var s=Math.floor(ms/1000); return Math.floor(s/60)+':'+('0'+(s%60)).slice(-2); }
    function fmtSize(b){
      if(b<1024) return b+' B';
      if(b<1048576) return (b/1024).toFixed(1)+' KB';
      return (b/1048576).toFixed(1)+' MB';
    }
    function fileIcon(name, type){
      var n=(name||'').toLowerCase(), m=(type||'').toLowerCase();
      if(m.indexOf('pdf')>=0||n.endsWith('.pdf')) return '📕';
      if(m.indexOf('word')>=0||n.endsWith('.doc')||n.endsWith('.docx')) return '📘';
      if(m.indexOf('sheet')>=0||m.indexOf('excel')>=0||n.endsWith('.xls')||n.endsWith('.xlsx')) return '📗';
      if(m.indexOf('zip')>=0||m.indexOf('rar')>=0||n.endsWith('.zip')||n.endsWith('.rar')) return '🗜️';
      if(m.indexOf('video')>=0||/\.(mp4|mov|avi|mkv)$/.test(n)) return '🎬';
      if(m.indexOf('audio')>=0||/\.(mp3|wav|m4a)$/.test(n)) return '🎵';
      if(m.indexOf('text')>=0||n.endsWith('.txt')) return '📄';
      if(n.endsWith('.apk')) return '📦';
      if(n.endsWith('.html')||n.endsWith('.js')||n.endsWith('.css')) return '💻';
      return '📎';
    }

    function unread(){
      var u=me(); if(!u) return 0;
      var c=getChats(),r=getReads(),n=0;
      Object.keys(c).forEach(function(k){
        if(!c[k].users||c[k].users.indexOf(u)<0) return;
        var lr=r[u+'|'+k]||0;
        c[k].messages.forEach(function(m){ if(m.from!==u&&m.ts>lr) n++; });
      });
      return n;
    }
    function markRead(p){
      var u=me(); if(!u) return;
      var k=cKey(u,p), r=getReads();
      r[u+'|'+k]=Date.now(); saveReads(r); notif();
    }

    function css(){
      if(id('dkc-css')) return;
      var s=''
      + '#dk-chat-btn{position:relative}'
      + '#dk-chat-notif{position:absolute;top:2px;right:2px;min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:#10B981;color:#fff;font-size:9px;font-weight:800;display:none;align-items:center;justify-content:center;font-family:sans-serif;line-height:1;z-index:2}'
      + '#dk-chat-notif.show{display:flex}'

      + '#dkc-ov{position:fixed;inset:0;z-index:9999;display:none;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;'
      + 'background:radial-gradient(ellipse 90% 60% at 10% 0%,rgba(167,139,250,.28),transparent 55%),radial-gradient(ellipse 70% 50% at 95% 15%,rgba(96,165,250,.22),transparent 50%),radial-gradient(ellipse 60% 45% at 50% 100%,rgba(52,211,153,.18),transparent 50%),linear-gradient(165deg,#eef2ff 0%,#e0f2fe 45%,#f0fdf4 100%)}'
      + '#dkc-ov.active{display:flex}'
      + '#dkc-ov::before{content:"";position:absolute;inset:-40%;background:conic-gradient(from 0deg at 50% 50%,transparent 0deg,rgba(167,139,250,.1) 50deg,transparent 110deg,rgba(96,165,250,.08) 170deg,transparent 230deg,rgba(52,211,153,.06) 290deg,transparent 360deg);animation:dkcSpin 45s linear infinite;pointer-events:none;z-index:0}'
      + '@keyframes dkcSpin{to{transform:rotate(360deg)}}'
      + '#dkc-ov>*{position:relative;z-index:1}'

      + '.dkc-h{display:flex;align-items:center;gap:8px;padding:10px 12px;flex-shrink:0;padding-top:calc(10px + env(safe-area-inset-top));'
      + 'background:rgba(255,255,255,.5);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);border-bottom:1px solid rgba(255,255,255,.65);box-shadow:0 4px 20px rgba(15,23,42,.05);color:#1e293b}'
      + '.dkc-b{background:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.85);color:#334155;font-size:20px;width:40px;height:40px;border-radius:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(15,23,42,.06),inset 0 1px 0 #fff}'
      + '.dkc-b:active{background:rgba(237,233,254,.9)}'
      + '.dkc-avh{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#a78bfa,#60a5fa);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;flex-shrink:0;box-shadow:0 4px 14px rgba(124,58,237,.3)}'
      + '.dkc-tt{flex:1;color:#1e293b;font-weight:700;font-size:16px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.2}'
      + '.dkc-tt small{display:block;color:#64748b;font-weight:500;font-size:11px;margin-top:2px}'
      + '.dkc-hi{background:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.85);color:#7C3AED;font-size:20px;width:40px;height:40px;border-radius:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(15,23,42,.06),inset 0 1px 0 #fff}'
      + '.dkc-hi:active{background:rgba(237,233,254,.9)}'

      + '.dkc-body{flex:1;overflow-y:auto;padding:14px 12px 8px;min-height:0;background:transparent}'
      + '.dkc-empty{color:#64748b;text-align:center;padding:64px 24px;font-size:14px;line-height:1.5}'
      + '.dkc-ei{font-size:52px;margin-bottom:12px;opacity:.55}'
      + '.dkc-eb{margin-top:16px;padding:12px 24px;border-radius:18px;background:linear-gradient(135deg,#a78bfa,#60a5fa);color:#fff;border:none;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 8px 22px rgba(124,58,237,.3)}'

      + '.dkc-it{display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;margin-bottom:8px;'
      + 'background:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.8);border-radius:18px;backdrop-filter:blur(18px);box-shadow:0 6px 18px rgba(15,23,42,.05),inset 0 1px 0 #fff}'
      + '.dkc-it:active{background:rgba(237,233,254,.75);border-color:rgba(167,139,250,.45)}'
      + '.dkc-av{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#a78bfa,#60a5fa);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:17px;flex-shrink:0;box-shadow:0 4px 12px rgba(124,58,237,.25)}'
      + '.dkc-ii{flex:1;min-width:0}'
      + '.dkc-in{color:#1e293b;font-weight:700;font-size:14.5px;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.dkc-il{color:#64748b;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.dkc-im{text-align:right;flex-shrink:0}'
      + '.dkc-id{color:#94a3b8;font-size:11px}'
      + '.dkc-dot{display:inline-block;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#10B981;color:#fff;font-size:11px;font-weight:800;text-align:center;line-height:20px;margin-left:auto}'

      + '.dkc-mr{display:flex;margin-bottom:6px;padding:0 4px;align-items:flex-end;gap:6px}'
      + '.dkc-mr.m{justify-content:flex-end}'
      + '.dkc-mb{max-width:78%;padding:10px 12px;border-radius:18px;font-size:14.5px;line-height:1.4;word-break:break-word;position:relative;'
      + 'box-shadow:0 4px 14px rgba(15,23,42,.06),inset 0 1px 0 #fff;backdrop-filter:blur(12px)}'
      + '.dkc-mr.t .dkc-mb{background:rgba(255,255,255,.65);color:#1e293b;border:1px solid rgba(255,255,255,.85);border-top-left-radius:6px}'
      + '.dkc-mr.m .dkc-mb{background:linear-gradient(135deg,rgba(167,139,250,.92),rgba(96,165,250,.88));color:#fff;border:1px solid rgba(255,255,255,.45);border-top-right-radius:6px}'
      + '.dkc-mr.t .dkc-mb::before,.dkc-mr.m .dkc-mb::before{display:none}'
      + '.dkc-mt{display:inline-block;font-size:10.5px;margin-left:8px;opacity:.65;vertical-align:bottom;float:right;line-height:14px;transform:translateY(2px)}'
      + '.dkc-mr.m .dkc-mt{color:rgba(255,255,255,.85)}'

      + '.dkc-ds{text-align:center;margin:14px 0 10px}'
      + '.dkc-ds span{background:rgba(255,255,255,.55);color:#64748b;font-size:11px;font-weight:600;padding:5px 14px;border-radius:12px;letter-spacing:.4px;border:1px solid rgba(255,255,255,.8);backdrop-filter:blur(10px)}'

      + '.dkc-ib{display:flex;gap:8px;padding:10px 12px;align-items:flex-end;flex-shrink:0;'
      + 'padding-bottom:calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.5);backdrop-filter:blur(24px);border-top:1px solid rgba(255,255,255,.65)}'
      + '.dkc-inp-wrap{flex:1;display:flex;align-items:flex-end;background:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.9);border-radius:22px;padding:0 4px;min-height:44px;max-height:120px;position:relative;box-shadow:inset 0 1px 2px rgba(0,0,0,.03)}'
      + '.dkc-inp{flex:1;padding:11px 4px;background:transparent;border:none;color:#1e293b;font-size:15px;outline:none;font-family:inherit;resize:none;max-height:100px;min-height:22px;line-height:20px}'
      + '.dkc-inp::placeholder{color:#94a3b8}'
      + '.dkc-inl{background:none;border:none;color:#64748b;font-size:20px;width:40px;height:44px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}'
      + '.dkc-inl:active{color:#7C3AED}'
      + '.dkc-sm{width:48px;height:48px;border-radius:50%;border:none;background:linear-gradient(135deg,#a78bfa,#60a5fa);color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:800;box-shadow:0 6px 18px rgba(124,58,237,.3)}'
      + '.dkc-sm:active{transform:scale(.92)}'
      + '.dkc-sm.mic{background:linear-gradient(135deg,#34d399,#10b981);box-shadow:0 6px 18px rgba(16,185,129,.3)}'

      + '.dkc-att-menu{position:absolute;bottom:calc(100% + 10px);left:8px;background:rgba(255,255,255,.85);border:1px solid rgba(255,255,255,.95);border-radius:18px;padding:6px;display:none;flex-direction:column;gap:2px;box-shadow:0 12px 36px rgba(15,23,42,.12);min-width:190px;z-index:20;backdrop-filter:blur(24px)}'
      + '.dkc-att-menu.show{display:flex}'
      + '.dkc-att-item{display:flex;align-items:center;gap:14px;padding:10px 14px;border:none;background:none;color:#1e293b;font-size:14.5px;cursor:pointer;border-radius:12px;text-align:left;font-family:inherit;font-weight:500}'
      + '.dkc-att-item:active{background:rgba(237,233,254,.8)}'
      + '.dkc-att-ico{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;color:#fff}'
      + '.dkc-att-ico.g{background:linear-gradient(135deg,#a78bfa,#7c3aed)}'
      + '.dkc-att-ico.c{background:linear-gradient(135deg,#f472b6,#ef4444)}'
      + '.dkc-att-ico.d{background:linear-gradient(135deg,#60a5fa,#3b82f6)}'
      + '.dkc-att-ico.l{background:linear-gradient(135deg,#34d399,#10b981)}'
      + '.dkc-att-ico.f{background:linear-gradient(135deg,#fbbf24,#f59e0b)}'

      + '.dkc-dlg{position:fixed;inset:0;background:rgba(148,163,184,.4);display:none;align-items:center;justify-content:center;padding:20px;z-index:10001;backdrop-filter:blur(12px)}'
      + '.dkc-dlg.active{display:flex}'
      + '.dkc-dc{background:rgba(255,255,255,.82);max-width:400px;width:100%;padding:24px;border-radius:24px;box-sizing:border-box;border:1px solid rgba(255,255,255,.95);box-shadow:0 24px 60px rgba(15,23,42,.12);backdrop-filter:blur(28px)}'
      + '.dkc-dc h3{color:#1e293b;margin:0 0 16px;font-size:18px;font-weight:800}'
      + '.dkc-dc label{display:block;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600}'
      + '.dkc-dc input{width:100%;padding:14px;background:rgba(255,255,255,.75);border:1px solid rgba(255,255,255,.95);border-radius:14px;color:#1e293b;font-size:15px;outline:none;margin-bottom:8px;box-sizing:border-box}'
      + '.dkc-st{font-size:12px;min-height:18px;color:#64748b;margin-bottom:12px;font-family:monospace}'
      + '.dkc-da{display:flex;gap:10px}'
      + '.dkc-bt{flex:1;padding:14px;border-radius:16px;border:none;font-weight:700;font-size:14px;cursor:pointer}'
      + '.dkc-bt.p{background:linear-gradient(135deg,#a78bfa,#60a5fa);color:#fff;box-shadow:0 8px 22px rgba(124,58,237,.28)}'
      + '.dkc-bt.g{background:rgba(255,255,255,.65);color:#1e293b;border:1px solid rgba(255,255,255,.9)}'

      + '.dkc-vo{display:flex;align-items:center;gap:10px;min-width:180px}'
      + '.dkc-pl{width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;background:rgba(124,58,237,.2);color:#7C3AED;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}'
      + '.dkc-mr.m .dkc-pl{background:rgba(255,255,255,.25);color:#fff}'
      + '.dkc-wv{flex:1;height:24px;position:relative}'
      + '.dkc-wb{position:absolute;top:50%;transform:translateY(-50%);height:4px;width:100%;background:rgba(100,116,139,.2);border-radius:2px;overflow:hidden}'
      + '.dkc-mr.m .dkc-wb{background:rgba(255,255,255,.25)}'
      + '.dkc-wf{height:100%;width:0;background:#7C3AED}'
      + '.dkc-mr.m .dkc-wf{background:#fff}'
      + '.dkc-dr{font-size:11px;font-family:monospace;opacity:.85}'

      + '.dkc-mb.dkc-img-b{padding:4px;overflow:visible}'
      + '.dkc-imgw{position:relative;max-width:260px;border-radius:14px;overflow:hidden;cursor:pointer;background:#e2e8f0;line-height:0}'
      + '.dkc-imgw img{display:block;width:100%;height:auto;max-height:340px;object-fit:cover}'
      + '.dkc-imgd{position:absolute;bottom:6px;right:6px;background:rgba(255,255,255,.85);color:#1e293b;border:none;width:34px;height:34px;border-radius:50%;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);box-shadow:0 4px 12px rgba(0,0,0,.1)}'

      + '.dkc-file-b{padding:10px 12px !important;display:flex;align-items:center;gap:12px;min-width:230px;max-width:280px}'
      + '.dkc-fi{width:44px;height:44px;border-radius:12px;background:rgba(124,58,237,.12);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}'
      + '.dkc-fd{flex:1;min-width:0}'
      + '.dkc-fn{color:inherit;font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px}'
      + '.dkc-fs{opacity:.7;font-size:11.5px}'
      + '.dkc-fdl{background:rgba(124,58,237,.12);border:none;color:#7C3AED;width:34px;height:34px;border-radius:50%;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}'
      + '.dkc-mr.m .dkc-fdl{background:rgba(255,255,255,.2);color:#fff}'

      + '.dkc-loc-b{padding:6px !important;overflow:visible;max-width:280px}'
      + '.dkc-loc-map{position:relative;width:270px;height:150px;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,#e0f2fe,#d1fae5);cursor:pointer}'
      + '.dkc-loc-map::after{content:"";position:absolute;inset:0;background-image:repeating-linear-gradient(0deg,transparent,transparent 19px,rgba(15,23,42,.05) 19px,rgba(15,23,42,.05) 20px),repeating-linear-gradient(90deg,transparent,transparent 19px,rgba(15,23,42,.05) 19px,rgba(15,23,42,.05) 20px)}'
      + '.dkc-loc-pin{position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);z-index:2;filter:drop-shadow(0 6px 10px rgba(0,0,0,.2))}'
      + '.dkc-loc-pin-c{width:44px;height:44px;border-radius:50%;background:radial-gradient(circle at 32% 28%,#ffffff,#e2e5e8 70%,#b8bcc2);display:flex;align-items:center;justify-content:center;position:relative;box-shadow:inset 0 -3px 6px rgba(0,0,0,.1)}'
      + '.dkc-loc-pin-c::before{content:"";position:absolute;bottom:-9px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-top:11px solid #b8bcc2;z-index:-1}'
      + '.dkc-loc-pin-c::after{content:"";position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:10px solid #e2e5e8;z-index:1}'
      + '.dkc-loc-arrow{font-size:22px;color:#374151;line-height:1;margin-top:-2px}'
      + '.dkc-loc-shadow{position:absolute;left:50%;top:50%;transform:translate(-50%,0);width:22px;height:7px;background:rgba(0,0,0,.2);border-radius:50%;filter:blur(2px);z-index:1}'
      + '.dkc-loc-info{padding:6px 8px 2px;display:flex;align-items:center;gap:8px}'
      + '.dkc-loc-txt{flex:1;font-size:12.5px;color:inherit;line-height:1.3;overflow:hidden}'
      + '.dkc-loc-txt b{display:block;font-size:13.5px;font-weight:600;margin-bottom:2px}'
      + '.dkc-loc-txt span{opacity:.7;font-size:11.5px}'
      + '.dkc-loc-badge{background:rgba(124,58,237,.12);color:#7C3AED;border:1px solid rgba(167,139,250,.35);font-size:10px;padding:3px 8px;border-radius:10px;font-weight:600}'
      + '.dkc-mr.m .dkc-loc-badge{background:rgba(255,255,255,.2);color:#fff;border-color:rgba(255,255,255,.35)}'

      + '#dkc-vw{position:fixed;inset:0;background:rgba(15,23,42,.92);z-index:10003;display:none;flex-direction:column;backdrop-filter:blur(12px)}'
      + '#dkc-vw.active{display:flex}'
      + '.dkc-vwh{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;padding-top:calc(12px + env(safe-area-inset-top));background:rgba(255,255,255,.12)}'
      + '.dkc-vwt{color:#fff;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-weight:500}'
      + '.dkc-vwa{display:flex;gap:8px}'
      + '.dkc-vwb{flex:1;display:flex;align-items:center;justify-content:center;padding:12px;overflow:auto;min-height:0}'
      + '.dkc-vwb img{max-width:100%;max-height:100%;object-fit:contain;border-radius:12px}'
      + '.dkc-vwbtn{background:rgba(255,255,255,.15);color:#fff;border:none;padding:9px 14px;border-radius:16px;font-size:13px;font-weight:600;cursor:pointer}'
      + '.dkc-vwbtn.p{background:linear-gradient(135deg,#a78bfa,#60a5fa)}'

      + '#dkc-rec{position:fixed;inset:0;background:rgba(148,163,184,.45);z-index:10002;display:none;flex-direction:column;align-items:center;justify-content:center;backdrop-filter:blur(16px)}'
      + '#dkc-rec.active{display:flex}'
      + '.dkc-rp{width:100px;height:100px;border-radius:50%;background:linear-gradient(135deg,#a78bfa,#60a5fa);display:flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 12px 36px rgba(124,58,237,.35);animation:dkcPulse 1.2s ease-in-out infinite}'
      + '@keyframes dkcPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}'
      + '.dkc-rpi{font-size:40px}'
      + '.dkc-rt{color:#1e293b;font-size:28px;font-weight:800;font-family:monospace;margin-bottom:6px}'
      + '.dkc-rh{color:#64748b;font-size:13px;margin-bottom:24px}'
      + '.dkc-ra{display:flex;gap:12px}'
      + '.dkc-rbt{padding:14px 28px;border-radius:18px;border:none;font-weight:700;font-size:14px;cursor:pointer}'
      + '.dkc-rbc{background:rgba(255,255,255,.7);color:#1e293b;border:1px solid rgba(255,255,255,.9)}'
      + '.dkc-rbs{background:linear-gradient(135deg,#34d399,#10b981);color:#fff;box-shadow:0 8px 22px rgba(16,185,129,.3)}';

      var el=document.createElement('style');
      el.id='dkc-css'; el.textContent=s;
      document.head.appendChild(el);
    }

    function ui(){
      if(id('dkc-ov')) return;
      var btn=id('dk-chat-btn');
      if(!btn){
        var ha=document.querySelector('.header-actions');
        if(ha){
          var b=document.createElement('button');
          b.id='dk-chat-btn'; b.title='Chat';
          b.style.position='relative';
          b.innerHTML='💬<span id="dk-chat-notif"></span>';
          b.onclick=open;
          ha.insertBefore(b,ha.firstChild);
          btn=b;
        }
      }
      if(btn&&!btn.onclick) btn.onclick=open;

      var o=document.createElement('div');
      o.id='dkc-ov';
      o.innerHTML=''
        +'<div class="dkc-h">'
        +  '<button class="dkc-b" id="dkc-bk">←</button>'
        +  '<div class="dkc-avh" id="dkc-avh">💬</div>'
        +  '<div class="dkc-tt" id="dkc-tt">Chats<small id="dkc-sub"></small></div>'
        +  '<button class="dkc-hi" id="dkc-nw" title="Chat baru">＋</button>'
        +'</div>'
        +'<div class="dkc-body" id="dkc-body"></div>'
        +'<div class="dkc-ib" id="dkc-ib" style="display:none">'
        +  '<div class="dkc-inp-wrap">'
        +    '<button class="dkc-inl" id="dkc-emoji">😊</button>'
        +    '<textarea class="dkc-inp" id="dkc-inp" placeholder="Ketik pesan" rows="1"></textarea>'
        +    '<button class="dkc-inl" id="dkc-att">📎</button>'
        +    '<div class="dkc-att-menu" id="dkc-att-menu">'
        +      '<button class="dkc-att-item" data-t="gallery"><span class="dkc-att-ico g">🖼️</span>Galeri</button>'
        +      '<button class="dkc-att-item" data-t="camera"><span class="dkc-att-ico c">📷</span>Kamera</button>'
        +      '<button class="dkc-att-item" data-t="doc"><span class="dkc-att-ico d">📄</span>Dokumen</button>'
        +      '<button class="dkc-att-item" data-t="folder"><span class="dkc-att-ico f">📁</span>Folder</button>'
        +      '<button class="dkc-att-item" data-t="loc"><span class="dkc-att-ico l">📍</span>Lokasi</button>'
        +    '</div>'
        +  '</div>'
        +  '<button class="dkc-sm mic" id="dkc-sm">🎤</button>'
        +'</div>'
        +'<div class="dkc-dlg" id="dkc-dlg">'
        +  '<div class="dkc-dc">'
        +    '<h3>Chat Baru</h3>'
        +    '<label>Wallet ID</label>'
        +    '<input type="text" id="dkc-nwid" placeholder="username" maxlength="50">'
        +    '<div class="dkc-st" id="dkc-nwst"></div>'
        +    '<div class="dkc-da">'
        +      '<button class="dkc-bt g" id="dkc-nwca">Batal</button>'
        +      '<button class="dkc-bt p" id="dkc-nwgo">Mulai</button>'
        +    '</div>'
        +  '</div>'
        +'</div>';
      document.body.appendChild(o);

      // Hidden inputs
      ['file','file-cam','file-doc','file-folder'].forEach(function(nm){
        var fi=document.createElement('input');
        fi.type='file'; fi.id='dkc-'+nm;
        fi.style.display='none';
        if(nm==='file'||nm==='file-cam') fi.accept='image/*';
        if(nm==='file-cam') fi.capture='environment';
        if(nm==='file-folder'){ fi.webkitdirectory=true; fi.multiple=true; }
        document.body.appendChild(fi);
      });

      var r=document.createElement('div');
      r.id='dkc-rec';
      r.innerHTML=''
        +'<div class="dkc-rp"><div class="dkc-rpi">🎤</div></div>'
        +'<div class="dkc-rt" id="dkc-rt">0:00</div>'
        +'<div class="dkc-rh">Merekam... (maks 30 detik)</div>'
        +'<div class="dkc-ra">'
        +  '<button class="dkc-rbt dkc-rbc" id="dkc-rc">Batal</button>'
        +  '<button class="dkc-rbt dkc-rbs" id="dkc-rs">Kirim</button>'
        +'</div>';
      document.body.appendChild(r);

      var v=document.createElement('div');
      v.id='dkc-vw';
      v.innerHTML=''
        +'<div class="dkc-vwh">'
        +  '<div class="dkc-vwt" id="dkc-vwt"></div>'
        +  '<div class="dkc-vwa">'
        +    '<button class="dkc-vwbtn p" id="dkc-vwd">⬇ Unduh</button>'
        +    '<button class="dkc-vwbtn" id="dkc-vwx">✕</button>'
        +  '</div>'
        +'</div>'
        +'<div class="dkc-vwb"><img id="dkc-vwi" alt="preview"></div>';
      document.body.appendChild(v);

      bind();
    }

    function bind(){
      id('dkc-bk').onclick=back;
      id('dkc-nw').onclick=openDlg;
      id('dkc-nwca').onclick=function(){ remC('dkc-dlg','active'); };
      id('dkc-nwgo').onclick=startNew;
      id('dkc-nwid').addEventListener('keydown',function(e){ if(e.key==='Enter') startNew(); });

      var inp=id('dkc-inp');
      inp.addEventListener('keydown',function(e){
        if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); }
      });
      inp.addEventListener('input',function(){
        this.style.height='auto';
        this.style.height=Math.min(this.scrollHeight,100)+'px';
        updateSendBtn();
      });

      id('dkc-sm').onclick=function(){
        if(inp.value.trim().length>0) send(); else startRec();
      };
      id('dkc-att').onclick=function(e){ e.stopPropagation(); id('dkc-att-menu').classList.toggle('show'); };
      id('dkc-emoji').onclick=function(){
        var i=id('dkc-inp'); i.value+='😊'; i.focus(); updateSendBtn();
      };
      document.querySelectorAll('.dkc-att-item').forEach(function(b){
        b.onclick=function(){
          remC('dkc-att-menu','show');
          var tp=this.getAttribute('data-t');
          if(tp==='gallery') id('dkc-file').click();
          else if(tp==='camera') id('dkc-file-cam').click();
          else if(tp==='doc') id('dkc-file-doc').click();
          else if(tp==='folder') id('dkc-file-folder').click();
          else if(tp==='loc') shareLocation();
        };
      });
      document.addEventListener('click',function(e){
        var m=id('dkc-att-menu');
        if(m&&m.classList.contains('show')&&!e.target.closest('#dkc-att')&&!e.target.closest('#dkc-att-menu'))
          m.classList.remove('show');
      });

      id('dkc-file').onchange=sendImgFile;
      id('dkc-file-cam').onchange=sendImgFile;
      id('dkc-file-doc').onchange=sendFile;
      id('dkc-file-folder').onchange=sendFolder;

      id('dkc-rc').onclick=cancelRec;
      id('dkc-rs').onclick=stopRecSend;
      id('dkc-vwd').onclick=downloadViewerImg;
      id('dkc-vwx').onclick=function(){ remC('dkc-vw','active'); };
      id('dkc-vw').addEventListener('click',function(e){
        if(e.target===this||e.target.classList.contains('dkc-vwb')) remC('dkc-vw','active');
      });
    }

    function updateSendBtn(){
      var inp=id('dkc-inp'), sm=id('dkc-sm');
      if(!inp||!sm) return;
      if(inp.value.trim().length>0){ sm.classList.remove('mic'); sm.textContent='➤'; }
      else { sm.classList.add('mic'); sm.textContent='🎤'; }
    }

    function open(){
      if(!me()) return alert('Login dulu.');
      addC('dkc-ov','active');
      if(view==='room'&&openWith) drawRoom(openWith);
      else { view='list'; drawList(); }
    }
    function back(){
      if(view==='room'){ openWith=null; view='list'; drawList(); }
      else remC('dkc-ov','active');
    }

    function drawList(){
      view='list'; openWith=null;
      var u=me(); if(!u) return;
      setText('dkc-tt','Chats');
      var sub=id('dkc-sub'); if(sub) sub.textContent='Wallet ID: '+u;
      var avh=id('dkc-avh'); if(avh) avh.innerHTML='💬';
      setDisp('dkc-ib','none');

      var cs=getChats(); var arr=[];
      Object.keys(cs).forEach(function(k){
        var c=cs[k];
        if(!c.users||c.users.indexOf(u)<0) return;
        var p=null; c.users.forEach(function(x){ if(x!==u) p=x; });
        if(!p) return;
        arr.push({p:p,last:c.messages[c.messages.length-1]||null});
      });
      arr.sort(function(a,b){ return ((b.last&&b.last.ts)||0)-((a.last&&a.last.ts)||0); });

      var body=id('dkc-body'); if(!body) return;
      body.innerHTML='';

      if(!arr.length){
        body.innerHTML='<div class="dkc-empty"><div class="dkc-ei">💬</div><div>Belum ada chat</div>'
          +'<button class="dkc-eb" id="dkc-eb">Mulai Chat Baru</button></div>';
        id('dkc-eb').onclick=openDlg; return;
      }
      var reads=getReads();
      arr.forEach(function(it){
        var lr=reads[u+'|'+cKey(u,it.p)]||0;
        var unreadIt=0;
        var ch=cs[cKey(u,it.p)];
        if(ch) ch.messages.forEach(function(m){ if(m.from!==u&&m.ts>lr) unreadIt++; });
        var prev;
        if(!it.last) prev='Mulai...';
        else if(it.last.type==='voice') prev='🎤 Pesan suara';
        else if(it.last.type==='image') prev='🖼️ Foto';
        else if(it.last.type==='location') prev='📍 Lokasi';
        else if(it.last.type==='file') prev=(it.last.folder||'')+(it.last.name||'File');
        else prev=it.last.text;
        if(it.last&&it.last.from===u) prev='✓ '+prev;

        var d=document.createElement('div');
        d.className='dkc-it';
        d.innerHTML=''
          +'<div class="dkc-av">'+esc(it.p.charAt(0).toUpperCase())+'</div>'
          +'<div class="dkc-ii">'
          +  '<div class="dkc-in">'+esc(it.p)+'</div>'
          +  '<div class="dkc-il">'+esc(prev.slice(0,60))+'</div>'
          +'</div>'
          +'<div class="dkc-im"><div class="dkc-id">'+(it.last?t(it.last.ts):'')+'</div>'
          +(unreadIt>0?'<div class="dkc-dot" style="margin-top:4px">'+(unreadIt>99?'99+':unreadIt)+'</div>':'')
          +'</div>';
        d.onclick=(function(p){ return function(){ openRoom(p); }; })(it.p);
        body.appendChild(d);
      });
    }

    function openDlg(){
      id('dkc-nwid').value=''; setText('dkc-nwst','');
      addC('dkc-dlg','active');
      setTimeout(function(){ id('dkc-nwid').focus(); },100);
    }
    function startNew(){
      var u=me(); var v=id('dkc-nwid').value.trim(); var st=id('dkc-nwst');
      if(!v){ st.style.color='#EF4444'; st.textContent='Isi ID.'; return; }
      if(v===u){ st.style.color='#EF4444'; st.textContent='Tidak bisa chat diri sendiri.'; return; }
      if(!userOK(v)){ st.style.color='#EF4444'; st.textContent='✕ Tidak ditemukan.'; return; }
      st.style.color='#25D366'; st.textContent='✓ Membuka...';
      setTimeout(function(){ remC('dkc-dlg','active'); openRoom(v); },300);
    }

    function openRoom(p){ openWith=p; view='room'; markRead(p); drawRoom(p); }

    function drawRoom(p){
      var u=me(); if(!u) return;
      var k=cKey(u,p);
      var cs=getChats();
      if(!cs[k]) cs[k]={users:[u,p].sort(),messages:[]};
      saveChats(cs);

      setText('dkc-tt',p);
      var sub=id('dkc-sub'); if(sub) sub.textContent='online';
      var avh=id('dkc-avh'); if(avh) avh.textContent=p.charAt(0).toUpperCase();
      setDisp('dkc-ib','flex');
      updateSendBtn();

      var body=id('dkc-body'); if(!body) return;
      body.innerHTML='';

      if(!cs[k].messages.length){
        body.innerHTML='<div class="dkc-empty"><div class="dkc-ei">👋</div><div>Mulai chat dengan <b>'+esc(p)+'</b></div></div>';
        return;
      }

      var lastDay='';
      cs[k].messages.forEach(function(m){
        var dd=new Date(m.ts).toDateString();
        if(dd!==lastDay){
          lastDay=dd;
          var sp=document.createElement('div');
          sp.className='dkc-ds';
          sp.innerHTML='<span>'+dayLbl(m.ts)+'</span>';
          body.appendChild(sp);
        }
        var row=document.createElement('div');
        var isMe=m.from===u;
        row.className='dkc-mr '+(isMe?'m':'t');
        var tick=isMe?' ✓✓':'';

        if(m.type==='voice'){
          var aid='dkc-au-'+m.id;
          row.innerHTML=''
            +'<div class="dkc-mb" style="padding:8px 12px">'
            +  '<div class="dkc-vo">'
            +    '<button class="dkc-pl" data-a="'+aid+'" data-f="dkc-wf-'+m.id+'">▶</button>'
            +    '<div class="dkc-wv"><div class="dkc-wb"><div class="dkc-wf" id="dkc-wf-'+m.id+'"></div></div></div>'
            +    '<span class="dkc-dr">'+durMs(m.duration||0)+'</span>'
            +  '</div>'
            +  '<span class="dkc-mt">'+t(m.ts)+tick+'</span>'
            +'</div>'
            +'<audio id="'+aid+'" preload="none" src="'+m.audio+'"></audio>';
        } else if(m.type==='image'){
          row.innerHTML=''
            +'<div class="dkc-mb dkc-img-b">'
            +  '<div class="dkc-imgw" data-name="'+esc(m.name||'gambar.jpg')+'">'
            +    '<img src="'+m.image+'" alt="gambar">'
            +    '<button class="dkc-imgd" title="Unduh">⬇</button>'
            +  '</div>'
            +  '<div style="padding:2px 6px 2px 4px;line-height:1"><span class="dkc-mt" style="float:none;margin-left:0;transform:none;display:block;text-align:right">'+t(m.ts)+tick+'</span></div>'
            +'</div>';
        } else if(m.type==='file'){
          var ic=fileIcon(m.name,m.mime);
          row.innerHTML=''
            +'<div class="dkc-mb dkc-file-b">'
            +  '<div class="dkc-fi">'+ic+'</div>'
            +  '<div class="dkc-fd">'
            +    '<div class="dkc-fn">'+esc(m.name||'file')+'</div>'
            +    '<div class="dkc-fs">'+fmtSize(m.size||0)+' • '+(m.mime||'file')+'</div>'
            +  '</div>'
            +  '<button class="dkc-fdl" data-fid="'+m.id+'" title="Unduh">⬇</button>'
            +  '<span class="dkc-mt" style="position:absolute;bottom:2px;right:8px">'+t(m.ts)+tick+'</span>'
            +'</div>';
        } else if(m.type==='location'){
          var gmap='https://www.google.com/maps?q='+m.lat+','+m.lng;
          row.innerHTML=''
            +'<div class="dkc-mb dkc-loc-b">'
            +  '<div class="dkc-loc-map" data-lat="'+m.lat+'" data-lng="'+m.lng+'">'
            +    '<div class="dkc-loc-shadow" style="top:calc(50% + 3px)"></div>'
            +    '<div class="dkc-loc-pin">'
            +      '<div class="dkc-loc-pin-c"><span class="dkc-loc-arrow">➤</span></div>'
            +    '</div>'
            +  '</div>'
            +  '<div class="dkc-loc-info">'
            +    '<div class="dkc-loc-txt">'
            +      '<b>📍 Lokasi Saya</b>'
            +      '<span>'+m.lat.toFixed(5)+', '+m.lng.toFixed(5)+'</span>'
            +    '</div>'
            +    '<div class="dkc-loc-badge">Buka Peta</div>'
            +  '</div>'
            +  '<div style="padding:2px 6px 0;line-height:1"><span class="dkc-mt" style="float:none;margin-left:0;transform:none;display:block;text-align:right">'+t(m.ts)+tick+'</span></div>'
            +'</div>';
        } else {
          row.innerHTML=''
            +'<div class="dkc-mb">'
            +  esc(m.text).replace(/\n/g,'<br>')
            +  '<span class="dkc-mt">'+t(m.ts)+tick+'</span>'
            +'</div>';
        }
        body.appendChild(row);
      });

      // Bind audio
      body.querySelectorAll('.dkc-pl').forEach(function(btn){
        btn.onclick=function(){
          var au=id(this.getAttribute('data-a'));
          var fl=id(this.getAttribute('data-f'));
          if(!au) return;
          if(au.paused){
            document.querySelectorAll('audio').forEach(function(a){ if(a!==au){ a.pause(); a.currentTime=0; } });
            au.play(); this.textContent='❚❚';
          } else { au.pause(); this.textContent='▶'; }
          var self=this;
          au.onended=function(){ au.currentTime=0; self.textContent='▶'; if(fl) fl.style.width='0%'; };
          au.ontimeupdate=function(){ if(fl&&au.duration) fl.style.width=((au.currentTime/au.duration)*100)+'%'; };
        };
      });

      // Bind images
      body.querySelectorAll('.dkc-imgw').forEach(function(w){
        var img=w.querySelector('img');
        var dl=w.querySelector('.dkc-imgd');
        var name=w.getAttribute('data-name')||'gambar.jpg';
        if(img) img.onclick=function(){ showImg(img.src,name); };
        if(dl) dl.onclick=function(ev){ ev.stopPropagation(); downloadSrc(img.src,name); };
      });

      // Bind file download
      body.querySelectorAll('.dkc-fdl').forEach(function(b){
        b.onclick=function(ev){
          ev.stopPropagation();
          var fid=this.getAttribute('data-fid');
          var cs2=getChats();
          var msg=null;
          Object.keys(cs2).forEach(function(k2){
            cs2[k2].messages.forEach(function(m2){ if(m2.id===fid) msg=m2; });
          });
          if(msg&&msg.data) downloadSrc(msg.data, msg.name||'file');
        };
      });

      // Bind location (klik → Google Maps)
      body.querySelectorAll('.dkc-loc-map').forEach(function(el){
        el.onclick=function(){
          var lat=this.getAttribute('data-lat');
          var lng=this.getAttribute('data-lng');
          var url='https://www.google.com/maps?q='+lat+','+lng;
          window.open(url,'_blank','noopener');
        };
      });

      setTimeout(function(){ body.scrollTop=body.scrollHeight; },50);
      markRead(p);
    }

    function pushMsg(msg){
      var u=me(); if(!u||!openWith) return;
      var k=cKey(u,openWith);
      var cs=getChats();
      if(!cs[k]) cs[k]={users:[u,openWith].sort(),messages:[]};
      var base={id:'M'+Date.now()+Math.random().toString(36).slice(2,5),from:u,ts:Date.now()};
      Object.keys(msg).forEach(function(kk){ base[kk]=msg[kk]; });
      cs[k].messages.push(base);
      saveChats(cs);
      return base;
    }

    function send(){
      var i=id('dkc-inp'); if(!i) return;
      var v=i.value.trim(); if(!v) return;
      pushMsg({type:'text',text:v});
      i.value=''; i.style.height='auto';
      updateSendBtn();
      drawRoom(openWith);
      notif();
    }

    // ====== GAMBAR ======
    function sendImgFile(e){
      var f=e.target.files&&e.target.files[0];
      if(!f) return;
      e.target.value='';
      if(!/^image\//.test(f.type)){ alert('Hanya bisa kirim file gambar.'); return; }
      if(f.size>15*1024*1024){ alert('Maksimal 15MB.'); return; }
      if(!openWith){ alert('Buka chat dulu.'); return; }
      var sm=id('dkc-sm'); var old=sm.textContent; sm.textContent='⏳'; sm.disabled=true;
      compressImg(f,1280,0.72).then(function(d){
        if(d.length>1500000) return compressImg(f,900,0.55);
        return d;
      }).then(function(d){
        if(d.length>1500000) throw new Error('Gambar terlalu besar.');
        pushMsg({type:'image',image:d,name:f.name||('gambar_'+Date.now()+'.jpg')});
        if(openWith) drawRoom(openWith);
        notif();
      }).catch(function(err){ alert('Gagal kirim gambar: '+(err.message||err));
      }).then(function(){ sm.textContent=old; sm.disabled=false; updateSendBtn(); });
    }

    function compressImg(file,maxW,quality){
      return new Promise(function(resolve,reject){
        var fr=new FileReader();
        fr.onerror=function(){ reject(new Error('Gagal baca file')); };
        fr.onload=function(){
          var img=new Image();
          img.onerror=function(){ reject(new Error('Format tidak didukung')); };
          img.onload=function(){
            var w=img.width,h=img.height;
            if(w>maxW){ h=Math.round(h*maxW/w); w=maxW; }
            var c=document.createElement('canvas');
            c.width=w; c.height=h;
            var ctx=c.getContext('2d');
            ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h);
            ctx.drawImage(img,0,0,w,h);
            try{ resolve(c.toDataURL('image/jpeg',quality)); }catch(e){ reject(e); }
          };
          img.src=fr.result;
        };
        fr.readAsDataURL(file);
      });
    }

    function showImg(src,name){
      var img=id('dkc-vwi'); if(!img) return;
      img.src=src;
      var lbl=id('dkc-vwt'); if(lbl) lbl.textContent=name||'gambar.jpg';
      var d=id('dkc-vwd'); if(d) d.setAttribute('data-name',name||'gambar.jpg');
      addC('dkc-vw','active');
    }

    function downloadSrc(src,name){
      if(!src) return;
      try{
        var a=document.createElement('a');
        a.href=src; a.download=name||('file_'+Date.now());
        a.rel='noopener';
        document.body.appendChild(a); a.click();
        setTimeout(function(){ document.body.removeChild(a); },100);
      }catch(e){ alert('Gagal unduh: '+e.message); }
    }

    function downloadViewerImg(){
      var img=id('dkc-vwi'); if(!img||!img.src) return;
      var d=id('dkc-vwd');
      var name=(d&&d.getAttribute('data-name'))||'gambar.jpg';
      downloadSrc(img.src,name);
    }

    // ====== FILE / DOKUMEN ======
    function sendFile(e){
      var f=e.target.files&&e.target.files[0];
      if(!f) return;
      e.target.value='';
      if(!openWith){ alert('Buka chat dulu.'); return; }
      if(f.size>2*1024*1024){ alert('File terlalu besar (maks 2 MB karena penyimpanan browser terbatas).'); return; }
      var fr=new FileReader();
      fr.onloadend=function(){
        pushMsg({type:'file',data:fr.result,name:f.name,size:f.size,mime:f.type||'file'});
        if(openWith) drawRoom(openWith);
        notif();
      };
      fr.readAsDataURL(f);
    }

    // ====== FOLDER ======
    function sendFolder(e){
      var files=e.target.files;
      if(!files||!files.length) return;
      e.target.value='';
      if(!openWith){ alert('Buka chat dulu.'); return; }
      var list=Array.prototype.slice.call(files);
      // Filter & validasi total
      var total=0;
      list.forEach(function(f){ total+=f.size; });
      if(total>3*1024*1024){ alert('Total folder terlalu besar (maks 3 MB). Coba folder kecil.'); return; }
      if(!confirm('Kirim '+list.length+' file dari folder?\nTotal: '+fmtSize(total))) return;
      var i=0;
      function next(){
        if(i>=list.length){ if(openWith) drawRoom(openWith); notif(); return; }
        var f=list[i++];
        if(f.size>1024*1024){ next(); return; } // skip file >1MB
        var fr=new FileReader();
        fr.onloadend=function(){
          pushMsg({type:'file',data:fr.result,name:f.name,size:f.size,
            mime:f.type||'file',folder:'📁 '+(f.webkitRelativePath||'')});
          next();
        };
        fr.readAsDataURL(f);
      }
      next();
    }

    // ====== LOKASI (Gojek-style) ======
    function shareLocation(){
      if(!openWith){ alert('Buka chat dulu.'); return; }
      if(!navigator.geolocation){ alert('Browser tidak support lokasi.'); return; }
      var sm=id('dkc-sm'); var old=sm.textContent; sm.textContent='⏳'; sm.disabled=true;
      navigator.geolocation.getCurrentPosition(function(pos){
        var lat=pos.coords.latitude, lng=pos.coords.longitude;
        pushMsg({type:'location',lat:lat,lng:lng});
        if(openWith) drawRoom(openWith);
        notif();
        sm.textContent=old; sm.disabled=false; updateSendBtn();
      }, function(err){
        alert('Gagal ambil lokasi: '+err.message+'\n\nPastikan izin lokasi diaktifkan.');
        sm.textContent=old; sm.disabled=false; updateSendBtn();
      }, { enableHighAccuracy:true, timeout:15000, maximumAge:0 });
    }

    // ====== VOICE ======
    function startRec(){
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) return alert('Browser tidak support voice.');
      recChunks=[];
      navigator.mediaDevices.getUserMedia({audio:true}).then(function(st){
        try{ recorder=new MediaRecorder(st); }catch(e){ return alert('MediaRecorder gagal: '+e.message); }
        recorder.ondataavailable=function(e){ if(e.data.size>0) recChunks.push(e.data); };
        recorder.onstop=onRecStop;
        recorder.start();
        recStart=Date.now();
        addC('dkc-rec','active');
        setText('dkc-rt','0:00');
        recInterval=setInterval(function(){
          setText('dkc-rt',durMs(Date.now()-recStart));
          if(Date.now()-recStart>=30000) stopRecSend();
        },200);
      }).catch(function(e){ alert('Mic gagal: '+e.message); });
    }
    function cancelRec(){
      if(recorder&&recorder.state!=='inactive'){
        recorder.onstop=null;
        try{ recorder.stop(); }catch(e){}
        if(recorder.stream) recorder.stream.getTracks().forEach(function(t){ t.stop(); });
      }
      cleanRec();
    }
    function stopRecSend(){
      if(recorder&&recorder.state!=='inactive') try{ recorder.stop(); }catch(e){}
    }
    function onRecStop(){
      var dur=Date.now()-recStart;
      if(recorder&&recorder.stream) recorder.stream.getTracks().forEach(function(t){ t.stop(); });
      if(dur<800){ cleanRec(); return alert('Terlalu pendek.'); }
      var blob=new Blob(recChunks,{type:recChunks[0]?recChunks[0].type:'audio/webm'});
      if(blob.size>500000){ cleanRec(); return alert('Voice terlalu besar.'); }
      var fr=new FileReader();
      fr.onloadend=function(){
        pushMsg({type:'voice',audio:fr.result,duration:dur});
        cleanRec();
        if(openWith) drawRoom(openWith);
        notif();
      };
      fr.readAsDataURL(blob);
    }
    function cleanRec(){
      if(recInterval){ clearInterval(recInterval); recInterval=null; }
      remC('dkc-rec','active');
      recorder=null; recChunks=[];
    }

    function notif(){
      var b=id('dk-chat-notif'); if(!b) return;
      var n=unread();
      if(n>0){ b.textContent=n>99?'99+':String(n); b.classList.add('show'); }
      else b.classList.remove('show');
    }

    window.dkChatOpen=open;
    window.dkChatDrawList=drawList;
    window.dkChatOpenRoom=openRoom;

    window.addEventListener('storage',function(e){
      try{
        if(e.key===CHAT_KEY||e.key===READ_KEY||e.key==='dk_session'){
          notif();
          if(hasC('dkc-ov','active')){
            if(view==='room'&&openWith) drawRoom(openWith);
            else drawList();
          }
        }
      }catch(_){}
    });

    function boot(){
      try{ console.log('[chat] boot'); css(); ui(); booted=true; notif(); console.log('[chat] OK'); }
      catch(e){ logErr(e.message,e.stack); }
    }
    function tryBoot(){ if(!document.body){ setTimeout(tryBoot,100); return; } boot(); }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',tryBoot);
    else tryBoot();
    setInterval(function(){ try{ if(booted) notif(); }catch(_){} },1500);

  } catch(e){ logErr('outer: '+e.message,e.stack); }
})();
