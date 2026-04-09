/* ═══════════════════════════════════════════════════
   SwiftCart Concierge — app.js
   All logic: navigation, pricing, form, payment,
   email, WhatsApp, PWA install
   ═══════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════
   ❶ CONSTANTS & DEFAULTS
══════════════════════════════════════ */
const NS = 'swiftcart_'; // localStorage namespace

const DEFAULTS = {
  serviceFee:    2000,   // base service fee (₦) — edit here or in Settings
  deliveryFee:   1500,   // delivery surcharge (₦)
  expressFee:    1000,   // express surcharge (₦)
  whatsappNumber: '2348000000000',          // international format, no +
  adminEmail:    'orders@swiftcart.ng',
  emailjsPublicKey:  'YOUR_EMAILJS_PUBLIC_KEY',
  emailjsServiceId:  'YOUR_EMAILJS_SERVICE_ID',
  emailjsTemplateId: 'YOUR_EMAILJS_TEMPLATE_ID',
  paystackPublicKey: 'pk_test_YOUR_PAYSTACK_KEY',
};

/* ══════════════════════════════════════
   ❷ UTILITIES
══════════════════════════════════════ */

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function lsGet(key, fallback = null) {
  try { const v = localStorage.getItem(NS + key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch {}
}
function lsRemove(key) {
  try { localStorage.removeItem(NS + key); } catch {}
}

function fmt(amount) {
  return '₦' + Number(amount).toLocaleString('en-NG');
}

function generateOrderId() {
  const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const rand = Math.random().toString(36).slice(2,6).toUpperCase();
  return `SC-${date}-${rand}`;
}

let toastTimer;
function showToast(msg, type = '', duration = 3500) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast' + (type ? ` toast--${type}` : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
}

function showLoading(text = 'Processing…') {
  const txt = document.getElementById('loading-text');
  if (txt) txt.textContent = text;
  document.getElementById('loading-overlay')?.classList.remove('hidden');
}
function hideLoading() {
  document.getElementById('loading-overlay')?.classList.add('hidden');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ══════════════════════════════════════
   ❸ SETTINGS
══════════════════════════════════════ */

function getSettings() {
  return {
    serviceFee:       lsGet('serviceFee',       DEFAULTS.serviceFee),
    deliveryFee:      lsGet('deliveryFee',      DEFAULTS.deliveryFee),
    expressFee:       lsGet('expressFee',       DEFAULTS.expressFee),
    whatsappNumber:   lsGet('whatsappNumber',   DEFAULTS.whatsappNumber),
    adminEmail:       lsGet('adminEmail',       DEFAULTS.adminEmail),
    emailjsPublicKey: lsGet('emailjsPublicKey', DEFAULTS.emailjsPublicKey),
    emailjsServiceId: lsGet('emailjsServiceId', DEFAULTS.emailjsServiceId),
    emailjsTemplateId:lsGet('emailjsTemplateId',DEFAULTS.emailjsTemplateId),
    paystackPublicKey:lsGet('paystackPublicKey',DEFAULTS.paystackPublicKey),
  };
}

window.saveSettings = function () {
  const numKeys = ['serviceFee','deliveryFee','expressFee'];
  const map = {
    'set-service-fee':  'serviceFee',
    'set-delivery-fee': 'deliveryFee',
    'set-express-fee':  'expressFee',
    'set-whatsapp':     'whatsappNumber',
    'set-admin-email':  'adminEmail',
    'set-ejs-pub':      'emailjsPublicKey',
    'set-ejs-service':  'emailjsServiceId',
    'set-ejs-template': 'emailjsTemplateId',
    'set-paystack-key': 'paystackPublicKey',
  };
  for (const [elId, key] of Object.entries(map)) {
    const el = document.getElementById(elId);
    if (!el) continue;
    const raw = el.value.trim();
    if (raw === '') continue;
    lsSet(key, numKeys.includes(key) ? Number(raw) : raw);
  }
  initEmailJS();
  updatePricingDisplay();
  showToast('Settings saved ✓', 'success');
};

window.resetSettings = function () {
  ['serviceFee','deliveryFee','expressFee','whatsappNumber','adminEmail',
   'emailjsPublicKey','emailjsServiceId','emailjsTemplateId','paystackPublicKey']
  .forEach(k => lsRemove(k));
  populateSettingsForm();
  updatePricingDisplay();
  showToast('Settings reset to defaults', '');
};

function populateSettingsForm() {
  const s = getSettings();
  const map = {
    'set-service-fee':  s.serviceFee,
    'set-delivery-fee': s.deliveryFee,
    'set-express-fee':  s.expressFee,
    'set-whatsapp':     s.whatsappNumber,
    'set-admin-email':  s.adminEmail,
    'set-ejs-pub':      s.emailjsPublicKey,
    'set-ejs-service':  s.emailjsServiceId,
    'set-ejs-template': s.emailjsTemplateId,
    'set-paystack-key': s.paystackPublicKey,
  };
  for (const [id, val] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  }
}

/* ══════════════════════════════════════
   ❹ NAVIGATION
══════════════════════════════════════ */

/* ── Admin password (change this to your desired password) ── */
const ADMIN_PASSWORD = 'swiftcart2024';
const ADMIN_SESSION_KEY = 'adminUnlocked';

function isAdminUnlocked() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1';
}

function promptAdminPassword(onSuccess) {
  const overlay = document.getElementById('admin-lock-overlay');
  const input   = document.getElementById('admin-password-input');
  const errEl   = document.getElementById('admin-password-error');
  if (!overlay || !input) return;
  input.value = '';
  if (errEl) errEl.textContent = '';
  overlay.classList.remove('hidden');
  setTimeout(() => input.focus(), 100);

  window._adminSubmit = function () {
    if (input.value === ADMIN_PASSWORD) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
      overlay.classList.add('hidden');
      onSuccess();
    } else {
      if (errEl) errEl.textContent = 'Incorrect password. Try again.';
      input.value = '';
      input.focus();
    }
  };

  window._adminCancel = function () {
    overlay.classList.add('hidden');
  };

  input.onkeydown = e => { if (e.key === 'Enter') window._adminSubmit(); };
}

window.navigateTo = function (pageName) {
  if (pageName === 'settings' && !isAdminUnlocked()) {
    promptAdminPassword(() => window.navigateTo('settings'));
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('page--active'));
  const target = document.getElementById(`page-${pageName}`);
  if (target) {
    target.classList.add('page--active');
    target.style.animation = 'none';
    requestAnimationFrame(() => { target.style.animation = ''; });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  if (pageName === 'settings') populateSettingsForm();
  if (pageName === 'request') {
    updatePricingDisplay();
    updateDeliveryFeeLabel();
    updateExpressFeeLabel();
  }
};

/* ══════════════════════════════════════
   ❺ PRICING
══════════════════════════════════════ */

function getDeliveryMethod() {
  return document.querySelector('input[name="delivery"]:checked')?.value ?? 'pickup';
}
function getUrgency() {
  return document.querySelector('input[name="urgency"]:checked')?.value ?? 'normal';
}

function calcTotal() {
  const s = getSettings();
  return s.serviceFee
    + (getDeliveryMethod() === 'delivery' ? s.deliveryFee : 0)
    + (getUrgency() === 'express' ? s.expressFee : 0);
}

function updatePricingDisplay() {
  const s = getSettings();
  const isDelivery = getDeliveryMethod() === 'delivery';
  const isExpress  = getUrgency() === 'express';
  setText('price-service', fmt(s.serviceFee));
  setText('price-delivery', fmt(s.deliveryFee));
  setText('price-express',  fmt(s.expressFee));
  setText('price-total',    fmt(calcTotal()));
  const dr = document.getElementById('price-delivery-row');
  const er = document.getElementById('price-express-row');
  if (dr) dr.style.display = isDelivery ? 'flex' : 'none';
  if (er) er.style.display = isExpress  ? 'flex' : 'none';
}

function updateDeliveryFeeLabel() {
  const s = getSettings();
  setText('delivery-fee-label', `+${fmt(s.deliveryFee)} delivery fee`);
  const addrGroup = document.getElementById('address-group');
  if (addrGroup) addrGroup.style.display = getDeliveryMethod() === 'delivery' ? 'block' : 'none';
}

function updateExpressFeeLabel() {
  setText('express-fee-label', `+${fmt(getSettings().expressFee)} surcharge`);
}

/* ══════════════════════════════════════
   ❻ VALIDATION
══════════════════════════════════════ */

function validateForm() {
  const required = [
    { id:'field-name',   label:'Full name' },
    { id:'field-phone',  label:'Phone number' },
    { id:'field-email',  label:'Email address' },
    { id:'field-item',   label:'Item name' },
    { id:'field-desc',   label:'Description' },
    { id:'field-budget', label:'Budget range' },
  ];
  required.forEach(f => document.getElementById(f.id)?.classList.remove('error'));
  document.getElementById('field-address')?.classList.remove('error');

  let firstError = null;
  for (const f of required) {
    const el = document.getElementById(f.id);
    if (el && el.value.trim() === '') {
      el.classList.add('error');
      if (!firstError) firstError = { el, label: f.label };
    }
  }

  // Email format
  const emailEl = document.getElementById('field-email');
  if (emailEl && emailEl.value.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())) {
    emailEl.classList.add('error');
    if (!firstError) firstError = { el: emailEl, label: 'Valid email address' };
  }

  // Delivery address
  if (getDeliveryMethod() === 'delivery') {
    const addrEl = document.getElementById('field-address');
    if (addrEl && addrEl.value.trim() === '') {
      addrEl.classList.add('error');
      if (!firstError) firstError = { el: addrEl, label: 'Delivery address' };
    }
  }

  if (firstError) {
    showToast(`${firstError.label} is required`, 'error');
    firstError.el.focus();
    firstError.el.scrollIntoView({ behavior:'smooth', block:'center' });
    return false;
  }
  return true;
}

/* ══════════════════════════════════════
   ❼ IMAGE UPLOAD
══════════════════════════════════════ */

let imageBase64 = '';

function initImageUpload() {
  const input    = document.getElementById('field-image');
  const dropText = document.getElementById('file-drop-text');
  if (!input || !dropText) return;

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) { imageBase64 = ''; dropText.textContent = 'Tap to upload image'; return; }
    if (file.size > 4 * 1024 * 1024) {
      showToast('Image must be under 4MB', 'error');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      imageBase64 = e.target.result;
      dropText.textContent = `✓ ${file.name}`;
      try { lsSet('pendingImage', imageBase64); } catch {}
    };
    reader.onerror = () => showToast('Could not read image', 'error');
    reader.readAsDataURL(file);
  });
}

/* ══════════════════════════════════════
   ❽ PAYSTACK
══════════════════════════════════════ */

function initiatePayment(orderData, onSuccess, onFailure) {
  const s = getSettings();
  const amountKobo = calcTotal() * 100;

  if (typeof PaystackPop === 'undefined') {
    showToast('Payment service unavailable. Check your internet connection.', 'error');
    onFailure('not_loaded');
    return;
  }

  const handler = PaystackPop.setup({
    key:      s.paystackPublicKey,
    email:    orderData.email,
    amount:   amountKobo,
    currency: 'NGN',
    ref:      `SC-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`,
    metadata: {
      custom_fields: [
        { display_name:'Order ID',  variable_name:'order_id',  value: orderData.orderId },
        { display_name:'Customer', variable_name:'customer',  value: orderData.fullName },
        { display_name:'Item',     variable_name:'item_name', value: orderData.itemName },
      ]
    },
    callback: response => onSuccess(response.reference),
    onClose:  () => {
      hideLoading();
      showToast('Payment cancelled. Please try again.', '');
      onFailure('cancelled');
    }
  });

  handler.openIframe();
}

/* ══════════════════════════════════════
   ❾ EMAILJS
══════════════════════════════════════ */

function initEmailJS() {
  const s = getSettings();
  if (typeof emailjs !== 'undefined' && s.emailjsPublicKey && !s.emailjsPublicKey.startsWith('YOUR_')) {
    try { emailjs.init(s.emailjsPublicKey); } catch {}
  }
}

function sendOrderEmail(orderData) {
  const s = getSettings();
  if (typeof emailjs === 'undefined') return;
  if (s.emailjsPublicKey.startsWith('YOUR_')) return;

  emailjs.send(s.emailjsServiceId, s.emailjsTemplateId, {
    to_email:          s.adminEmail,
    order_id:          orderData.orderId,
    customer_name:     orderData.fullName,
    customer_phone:    orderData.phone,
    customer_email:    orderData.email,
    item_name:         orderData.itemName,
    description:       orderData.description,
    budget:            orderData.budget,
    delivery_method:   orderData.deliveryMethod,
    delivery_address:  orderData.address || 'N/A (Pickup)',
    urgency:           orderData.urgency,
    total_paid:        fmt(orderData.totalPaid),
    paystack_ref:      orderData.paystackRef,
    image_attached:    imageBase64 ? 'Yes' : 'No',
    submitted_at:      new Date().toLocaleString('en-NG', { timeZone:'Africa/Lagos' }),
  }).then(() => console.log('✓ Email sent'))
    .catch(err => console.warn('EmailJS error:', err));
}

/* ══════════════════════════════════════
   ❿ WHATSAPP
══════════════════════════════════════ */

function buildWhatsAppURL(orderData) {
  const s = getSettings();
  const msg = [
    `✦ *SwiftCart Concierge — New Order*`,
    ``,
    `📋 *Order ID:* ${orderData.orderId}`,
    `👤 *Name:* ${orderData.fullName}`,
    `📞 *Phone:* ${orderData.phone}`,
    ``,
    `🛍️ *Item:* ${orderData.itemName}`,
    `📝 *Description:* ${orderData.description}`,
    `💰 *Budget:* ${orderData.budget}`,
    ``,
    `🚚 *Delivery:* ${orderData.deliveryMethod === 'delivery' ? 'Home Delivery' : 'Pickup'}`,
    orderData.address ? `📍 *Address:* ${orderData.address}` : null,
    `⚡ *Urgency:* ${orderData.urgency === 'express' ? 'Express' : 'Normal'}`,
    ``,
    `💳 *Total Paid:* ${fmt(orderData.totalPaid)}`,
    `🔑 *Payment Ref:* ${orderData.paystackRef}`,
    ``,
    `Please confirm receipt and proceed. Thank you!`,
  ].filter(l => l !== null).join('\n');

  return `https://wa.me/${s.whatsappNumber}?text=${encodeURIComponent(msg)}`;
}

/* ══════════════════════════════════════
   ⓫ CONFIRMATION
══════════════════════════════════════ */

function showConfirmationPage(orderData) {
  setText('conf-order-id', escHtml(orderData.orderId));
  setText('conf-item',     escHtml(orderData.itemName));
  setText('conf-amount',   fmt(orderData.totalPaid));
  setText('conf-ref',      escHtml(orderData.paystackRef));

  const waUrl = buildWhatsAppURL(orderData);
  const waBtn = document.getElementById('wa-btn');
  const waFallback = document.getElementById('wa-fallback-link');
  if (waBtn)      waBtn.href = waUrl;
  if (waFallback) waFallback.href = waUrl;

  window.navigateTo('confirmation');

  // Auto-open WhatsApp after a short delay
  setTimeout(() => {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }, 1800);
}

/* ══════════════════════════════════════
   ⓬ FORM INIT
══════════════════════════════════════ */

function initRequestForm() {
  const form = document.getElementById('request-form');
  if (!form) return;

  form.querySelectorAll('input[name="delivery"]').forEach(r => {
    r.addEventListener('change', () => { updatePricingDisplay(); updateDeliveryFeeLabel(); });
  });
  form.querySelectorAll('input[name="urgency"]').forEach(r => {
    r.addEventListener('change', updatePricingDisplay);
  });

  const descEl  = document.getElementById('field-desc');
  const countEl = document.getElementById('desc-count');
  if (descEl && countEl) {
    descEl.addEventListener('input', () => {
      countEl.textContent = `${descEl.value.length} / 600`;
    });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm()) return;

    const orderData = {
      orderId:        generateOrderId(),
      fullName:       document.getElementById('field-name').value.trim(),
      phone:          document.getElementById('field-phone').value.trim(),
      email:          document.getElementById('field-email').value.trim(),
      itemName:       document.getElementById('field-item').value.trim(),
      description:    document.getElementById('field-desc').value.trim(),
      budget:         document.getElementById('field-budget').value.trim(),
      deliveryMethod: getDeliveryMethod(),
      address:        document.getElementById('field-address')?.value.trim() || '',
      urgency:        getUrgency(),
      totalPaid:      calcTotal(),
      paystackRef:    '',
    };

    showLoading('Opening secure payment…');

    initiatePayment(
      orderData,
      paystackRef => {
        orderData.paystackRef = paystackRef;
        hideLoading();
        lsSet('lastOrder', orderData);
        sendOrderEmail(orderData);
        lsRemove('pendingImage');
        imageBase64 = '';
        showConfirmationPage(orderData);
        showToast('Payment successful! Opening WhatsApp…', 'success', 5000);
      },
      reason => {
        hideLoading();
        if (reason !== 'cancelled') showToast('Payment failed. Please try again.', 'error');
      }
    );
  });
}

/* ══════════════════════════════════════
   ⓭ PWA
══════════════════════════════════════ */

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.warn('SW error:', err));
  }
}

let deferredPrompt = null;

function initInstallBanner() {
  const banner = document.getElementById('install-banner');
  const installBtn = document.getElementById('install-btn');
  const dismissBtn = document.getElementById('install-dismiss');

  // Show banner immediately if not already installed as a PWA
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  const dismissed = sessionStorage.getItem('installBannerDismissed');

  if (!isStandalone && !dismissed && banner) {
    banner.classList.remove('hidden');
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    banner?.classList.add('hidden');
    showToast('SwiftCart installed \u2713', 'success');
  });

  installBtn?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      banner?.classList.add('hidden');
    } else {
      showToast('Use your browser\'s "Add to Home Screen" option to install.', '', 5000);
    }
  });

  dismissBtn?.addEventListener('click', () => {
    banner?.classList.add('hidden');
    sessionStorage.setItem('installBannerDismissed', '1');
  });
}

/* ══════════════════════════════════════
   ⓮ BOOT
══════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  initEmailJS();
  updatePricingDisplay();
  updateDeliveryFeeLabel();
  updateExpressFeeLabel();
  initRequestForm();
  initImageUpload();
  initInstallBanner();
});
