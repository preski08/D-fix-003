/* Dompetku i18n + Currency */
(function () {
  'use strict';

  var LANG_KEY = 'dk_lang';
  var CUR_KEY = 'dk_currency';

  var rates = { // relative to IDR (approx)
    IDR: 1,
    USD: 1 / 16200,
    CNY: 1 / 2250,
    KRW: 1 / 12,
    THB: 1 / 460,
    SAR: 1 / 4320,
    INR: 1 / 195
  };

  var symbols = {
    IDR: 'Rp', USD: '$', CNY: '¥', KRW: '₩', THB: '฿', SAR: '﷼', INR: '₹'
  };

  var dict = {
    id: {
      tagline: 'Decentralized wallet · v3.0',
      login: 'Masuk',
      wallet_id: 'Wallet ID',
      passphrase: 'Passphrase',
      connect: 'Connect Wallet',
      no_wallet: 'Belum punya wallet?',
      create_new: 'Buat Baru',
      create_wallet: 'Buat Wallet',
      create_btn: 'Create Wallet',
      have_wallet: 'Sudah punya?',
      login_link: 'Masuk',
      connected: 'Connected',
      logout: 'Keluar',
      total_balance: '◈ Total Balance',
      topup: 'Top Up',
      send: 'Kirim',
      portfolio: 'Portfolio',
      income: 'Pemasukan',
      expense: 'Pengeluaran',
      history: 'Riwayat Transaksi',
      lang_currency: 'Bahasa & Mata Uang',
      choose_lang: 'Pilih bahasa',
      choose_currency: 'Pilih mata uang',
      topup_title: 'Top Up Saldo',
      amount: 'Nominal',
      description: 'Keterangan',
      method: 'Metode',
      generate_pay: 'Generate Payment',
      send_title: 'Kirim Saldo',
      choose_send: 'Pilih metode pengiriman:',
      scan_qr: 'Scan QR',
      scan_qr_sub: 'Kamera · scan QR wallet tujuan',
      upload_qr: 'Upload QR',
      upload_qr_sub: 'Pilih gambar QR dari galeri',
      send_id: 'Kirim ke ID',
      send_id_sub: 'Transfer langsung ke wallet ID (instan)',
      recipient: 'Penerima',
      recipient_id: 'Wallet ID Penerima',
      check_wallet: 'Cek Wallet',
      back: 'Kembali',
      my_qr: 'QR Wallet Saya',
      show_qr: 'Bagikan QR ini agar orang bisa kirim saldo ke kamu',
      download_qr: 'Unduh QR',
      point_camera: 'Arahkan kamera ke QR Dompetku',
      switch_cam: 'Ganti Kamera',
      empty_tx: 'Belum ada transaksi',
      monthly_report: 'Laporan Bulanan',
      net: 'Netto'
    },
    en: {
      tagline: 'Decentralized wallet · v3.0',
      login: 'Sign In',
      wallet_id: 'Wallet ID',
      passphrase: 'Passphrase',
      connect: 'Connect Wallet',
      no_wallet: "Don't have a wallet?",
      create_new: 'Create New',
      create_wallet: 'Create Wallet',
      create_btn: 'Create Wallet',
      have_wallet: 'Already have one?',
      login_link: 'Sign In',
      connected: 'Connected',
      logout: 'Logout',
      total_balance: '◈ Total Balance',
      topup: 'Top Up',
      send: 'Send',
      portfolio: 'Portfolio',
      income: 'Income',
      expense: 'Expense',
      history: 'Transaction History',
      lang_currency: 'Language & Currency',
      choose_lang: 'Choose language',
      choose_currency: 'Choose currency',
      topup_title: 'Top Up Balance',
      amount: 'Amount',
      description: 'Description',
      method: 'Method',
      generate_pay: 'Generate Payment',
      send_title: 'Send Balance',
      choose_send: 'Choose send method:',
      scan_qr: 'Scan QR',
      scan_qr_sub: 'Camera · scan destination wallet QR',
      upload_qr: 'Upload QR',
      upload_qr_sub: 'Pick QR image from gallery',
      send_id: 'Send to ID',
      send_id_sub: 'Instant transfer to wallet ID',
      recipient: 'Recipient',
      recipient_id: 'Recipient Wallet ID',
      check_wallet: 'Check Wallet',
      back: 'Back',
      my_qr: 'My Wallet QR',
      show_qr: 'Show this QR so others can send you balance',
      download_qr: 'Download QR',
      point_camera: 'Point camera at Dompetku QR',
      switch_cam: 'Switch Camera',
      empty_tx: 'No transactions yet',
      monthly_report: 'Monthly Report',
      net: 'Net'
    },
    zh: {
      tagline: '去中心化钱包 · v3.0',
      login: '登录',
      wallet_id: '钱包 ID',
      passphrase: '密码短语',
      connect: '连接钱包',
      no_wallet: '还没有钱包？',
      create_new: '创建新钱包',
      create_wallet: '创建钱包',
      create_btn: '创建钱包',
      have_wallet: '已有钱包？',
      login_link: '登录',
      connected: '已连接',
      logout: '退出',
      total_balance: '◈ 总余额',
      topup: '充值',
      send: '发送',
      portfolio: '投资组合',
      income: '收入',
      expense: '支出',
      history: '交易历史',
      lang_currency: '语言和货币',
      choose_lang: '选择语言',
      choose_currency: '选择货币',
      topup_title: '充值余额',
      amount: '金额',
      description: '说明',
      method: '方式',
      generate_pay: '生成付款',
      send_title: '发送余额',
      choose_send: '选择发送方式：',
      scan_qr: '扫描二维码',
      scan_qr_sub: '相机 · 扫描目标钱包二维码',
      upload_qr: '上传二维码',
      upload_qr_sub: '从相册选择二维码图片',
      send_id: '发送到 ID',
      send_id_sub: '即时转账到钱包 ID',
      recipient: '收款人',
      recipient_id: '收款人钱包 ID',
      check_wallet: '检查钱包',
      back: '返回',
      my_qr: '我的钱包二维码',
      show_qr: '展示此二维码以便他人向您发送余额',
      download_qr: '下载二维码',
      point_camera: '将相机对准 Dompetku 二维码',
      switch_cam: '切换相机',
      empty_tx: '暂无交易',
      monthly_report: '月度报告',
      net: '净额'
    },
    ko: {
      tagline: '탈중앙화 지갑 · v3.0',
      login: '로그인',
      wallet_id: '지갑 ID',
      passphrase: '패스프레이즈',
      connect: '지갑 연결',
      no_wallet: '지갑이 없으신가요?',
      create_new: '새로 만들기',
      create_wallet: '지갑 만들기',
      create_btn: '지갑 만들기',
      have_wallet: '이미 있으신가요?',
      login_link: '로그인',
      connected: '연결됨',
      logout: '로그아웃',
      total_balance: '◈ 총 잔액',
      topup: '충전',
      send: '보내기',
      portfolio: '포트폴리오',
      income: '수입',
      expense: '지출',
      history: '거래 내역',
      lang_currency: '언어 및 통화',
      choose_lang: '언어 선택',
      choose_currency: '통화 선택',
      topup_title: '잔액 충전',
      amount: '금액',
      description: '설명',
      method: '방법',
      generate_pay: '결제 생성',
      send_title: '잔액 보내기',
      choose_send: '전송 방법 선택:',
      scan_qr: 'QR 스캔',
      scan_qr_sub: '카메라 · 대상 지갑 QR 스캔',
      upload_qr: 'QR 업로드',
      upload_qr_sub: '갤러리에서 QR 이미지 선택',
      send_id: 'ID로 보내기',
      send_id_sub: '지갑 ID로 즉시 이체',
      recipient: '수신자',
      recipient_id: '수신자 지갑 ID',
      check_wallet: '지갑 확인',
      back: '뒤로',
      my_qr: '내 지갑 QR',
      show_qr: '다른 사람이 잔액을 보낼 수 있도록 이 QR을 보여주세요',
      download_qr: 'QR 다운로드',
      point_camera: '카메라를 Dompetku QR에 맞추세요',
      switch_cam: '카메라 전환',
      empty_tx: '거래 내역 없음',
      monthly_report: '월간 보고서',
      net: '순액'
    },
    th: {
      tagline: 'กระเป๋าเงินแบบกระจายศูนย์ · v3.0',
      login: 'เข้าสู่ระบบ',
      wallet_id: 'รหัสกระเป๋า',
      passphrase: 'รหัสผ่าน',
      connect: 'เชื่อมต่อกระเป๋า',
      no_wallet: 'ยังไม่มีกระเป๋า?',
      create_new: 'สร้างใหม่',
      create_wallet: 'สร้างกระเป๋า',
      create_btn: 'สร้างกระเป๋า',
      have_wallet: 'มีแล้ว?',
      login_link: 'เข้าสู่ระบบ',
      connected: 'เชื่อมต่อแล้ว',
      logout: 'ออกจากระบบ',
      total_balance: '◈ ยอดรวม',
      topup: 'เติมเงิน',
      send: 'ส่ง',
      portfolio: 'พอร์ตโฟลิโอ',
      income: 'รายรับ',
      expense: 'รายจ่าย',
      history: 'ประวัติธุรกรรม',
      lang_currency: 'ภาษาและสกุลเงิน',
      choose_lang: 'เลือกภาษา',
      choose_currency: 'เลือกสกุลเงิน',
      topup_title: 'เติมยอดเงิน',
      amount: 'จำนวน',
      description: 'รายละเอียด',
      method: 'วิธี',
      generate_pay: 'สร้างการชำระเงิน',
      send_title: 'ส่งยอดเงิน',
      choose_send: 'เลือกวิธีส่ง:',
      scan_qr: 'สแกน QR',
      scan_qr_sub: 'กล้อง · สแกน QR กระเป๋าปลายทาง',
      upload_qr: 'อัปโหลด QR',
      upload_qr_sub: 'เลือกภาพ QR จากแกลเลอรี',
      send_id: 'ส่งไปยัง ID',
      send_id_sub: 'โอนทันทีไปยังรหัสกระเป๋า',
      recipient: 'ผู้รับ',
      recipient_id: 'รหัสกระเป๋าผู้รับ',
      check_wallet: 'ตรวจสอบกระเป๋า',
      back: 'กลับ',
      my_qr: 'QR กระเป๋าของฉัน',
      show_qr: 'แสดง QR นี้เพื่อให้ผู้อื่นส่งยอดเงินถึงคุณ',
      download_qr: 'ดาวน์โหลด QR',
      point_camera: 'เล็งกล้องไปที่ QR Dompetku',
      switch_cam: 'สลับกล้อง',
      empty_tx: 'ยังไม่มีธุรกรรม',
      monthly_report: 'รายงานรายเดือน',
      net: 'สุทธิ'
    },
    ar: {
      tagline: 'محفظة لامركزية · v3.0',
      login: 'تسجيل الدخول',
      wallet_id: 'معرّف المحفظة',
      passphrase: 'عبارة المرور',
      connect: 'ربط المحفظة',
      no_wallet: 'ليس لديك محفظة؟',
      create_new: 'إنشاء جديد',
      create_wallet: 'إنشاء محفظة',
      create_btn: 'إنشاء محفظة',
      have_wallet: 'لديك واحدة بالفعل؟',
      login_link: 'تسجيل الدخول',
      connected: 'متصل',
      logout: 'خروج',
      total_balance: '◈ الرصيد الإجمالي',
      topup: 'شحن',
      send: 'إرسال',
      portfolio: 'المحفظة',
      income: 'الدخل',
      expense: 'المصروف',
      history: 'سجل المعاملات',
      lang_currency: 'اللغة والعملة',
      choose_lang: 'اختر اللغة',
      choose_currency: 'اختر العملة',
      topup_title: 'شحن الرصيد',
      amount: 'المبلغ',
      description: 'الوصف',
      method: 'الطريقة',
      generate_pay: 'إنشاء الدفع',
      send_title: 'إرسال الرصيد',
      choose_send: 'اختر طريقة الإرسال:',
      scan_qr: 'مسح QR',
      scan_qr_sub: 'الكاميرا · مسح QR المحفظة الهدف',
      upload_qr: 'رفع QR',
      upload_qr_sub: 'اختر صورة QR من المعرض',
      send_id: 'إرسال إلى ID',
      send_id_sub: 'تحويل فوري إلى معرّف المحفظة',
      recipient: 'المستلم',
      recipient_id: 'معرّف محفظة المستلم',
      check_wallet: 'تحقق من المحفظة',
      back: 'رجوع',
      my_qr: 'QR محفظتي',
      show_qr: 'أظهر هذا الـ QR حتى يتمكن الآخرون من إرسال الرصيد إليك',
      download_qr: 'تحميل QR',
      point_camera: 'وجّه الكاميرا إلى QR Dompetku',
      switch_cam: 'تبديل الكاميرا',
      empty_tx: 'لا توجد معاملات بعد',
      monthly_report: 'التقرير الشهري',
      net: 'صافي'
    },
    hi: {
      tagline: 'विकेंद्रीकृत वॉलेट · v3.0',
      login: 'साइन इन',
      wallet_id: 'वॉलेट ID',
      passphrase: 'पासफ़्रेज़',
      connect: 'वॉलेट कनेक्ट करें',
      no_wallet: 'वॉलेट नहीं है?',
      create_new: 'नया बनाएं',
      create_wallet: 'वॉलेट बनाएं',
      create_btn: 'वॉलेट बनाएं',
      have_wallet: 'पहले से है?',
      login_link: 'साइन इन',
      connected: 'कनेक्टेड',
      logout: 'लॉगआउट',
      total_balance: '◈ कुल बैलेंस',
      topup: 'टॉप अप',
      send: 'भेजें',
      portfolio: 'पोर्टफोलियो',
      income: 'आय',
      expense: 'खर्च',
      history: 'लेन-देन इतिहास',
      lang_currency: 'भाषा और मुद्रा',
      choose_lang: 'भाषा चुनें',
      choose_currency: 'मुद्रा चुनें',
      topup_title: 'बैलेंस टॉप अप',
      amount: 'राशि',
      description: 'विवरण',
      method: 'विधि',
      generate_pay: 'भुगतान बनाएं',
      send_title: 'बैलेंस भेजें',
      choose_send: 'भेजने का तरीका चुनें:',
      scan_qr: 'QR स्कैन',
      scan_qr_sub: 'कैमरा · गंतव्य वॉलेट QR स्कैन करें',
      upload_qr: 'QR अपलोड',
      upload_qr_sub: 'गैलरी से QR छवि चुनें',
      send_id: 'ID पर भेजें',
      send_id_sub: 'वॉलेट ID पर तुरंत ट्रांसफर',
      recipient: 'प्राप्तकर्ता',
      recipient_id: 'प्राप्तकर्ता वॉलेट ID',
      check_wallet: 'वॉलेट जांचें',
      back: 'वापस',
      my_qr: 'मेरा वॉलेट QR',
      show_qr: 'यह QR दिखाएं ताकि दूसरे आपको बैलेंस भेज सकें',
      download_qr: 'QR डाउनलोड',
      point_camera: 'कैमरा Dompetku QR पर लगाएं',
      switch_cam: 'कैमरा बदलें',
      empty_tx: 'अभी कोई लेन-देन नहीं',
      monthly_report: 'मासिक रिपोर्ट',
      net: 'शुद्ध'
    }
  };

  var currentLang = localStorage.getItem(LANG_KEY) || 'id';
  var currentCur = localStorage.getItem(CUR_KEY) || 'IDR';

  function t(key) {
    var d = dict[currentLang] || dict.id;
    return d[key] || dict.id[key] || key;
  }

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = t(key);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = val;
      } else {
        el.textContent = val;
      }
    });
    // direction for Arabic
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;
    // update auth lang buttons
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === currentLang);
    });
    document.querySelectorAll('.lang-opt').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === currentLang);
    });
    document.querySelectorAll('.cur-opt').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-cur') === currentCur);
    });
    var curLabel = document.getElementById('cur-label');
    if (curLabel) curLabel.textContent = currentCur;
    var syms = document.querySelectorAll('#topup-cur-sym, #exp-cur-sym');
    syms.forEach(function (s) { s.textContent = symbols[currentCur] || 'Rp'; });
  }

  window.setLang = function (lang) {
    if (!dict[lang]) return;
    currentLang = lang;
    localStorage.setItem(LANG_KEY, lang);
    applyI18n();
    if (typeof window.dkRenderBalance === 'function') window.dkRenderBalance();
    if (typeof window.dkRenderHistory === 'function') window.dkRenderHistory();
    if (typeof window.dkRenderChart === 'function') window.dkRenderChart();
  };

  window.setCurrency = function (cur) {
    if (!rates[cur]) return;
    currentCur = cur;
    localStorage.setItem(CUR_KEY, cur);
    applyI18n();
    if (typeof window.dkRenderBalance === 'function') window.dkRenderBalance();
    if (typeof window.dkRenderHistory === 'function') window.dkRenderHistory();
    if (typeof window.dkRenderChart === 'function') window.dkRenderChart();
  };

  window.openLangModal = function () {
    document.getElementById('lang-modal').classList.add('active');
    applyI18n();
  };
  window.closeLangModal = function () {
    document.getElementById('lang-modal').classList.remove('active');
  };

  window.dkT = t;
  window.dkGetLang = function () { return currentLang; };
  window.dkGetCurrency = function () { return currentCur; };
  window.dkFmtMoney = function (idrAmount) {
    var rate = rates[currentCur] || 1;
    var val = Number(idrAmount || 0) * rate;
    var sym = symbols[currentCur] || 'Rp';
    if (currentCur === 'IDR') {
      return sym + ' ' + Math.round(val).toLocaleString('id-ID');
    }
    if (currentCur === 'KRW' || currentCur === 'INR') {
      return sym + ' ' + Math.round(val).toLocaleString('en-US');
    }
    return sym + ' ' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  window.dkSym = function () { return symbols[currentCur] || 'Rp'; };


  window.toggleAuthLangDrop = function () {
    var d = document.getElementById('auth-lang-drop');
    if (!d) return;
    d.classList.toggle('show');
  };
  document.addEventListener('click', function (e) {
    var wrap = document.getElementById('auth-lang-row');
    var drop = document.getElementById('auth-lang-drop');
    if (!wrap || !drop) return;
    if (!wrap.contains(e.target)) drop.classList.remove('show');
  });

  // boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyI18n);
  } else {
    applyI18n();
  }
})();
