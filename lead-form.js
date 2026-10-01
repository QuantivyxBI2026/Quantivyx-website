/*
 * Quantivyx lead form handler
 * Used by index.html and contact.html. Any <form data-lead-form="..."> on a page is wired up automatically.
 *
 * ONE-TIME SETUP (about 2 minutes), so every inquiry lands in your inbox:
 *   1. Go to https://web3forms.com and create a free access key using Hernandezanalytics@outlook.com.
 *   2. Web3Forms emails you a key. Paste it into ACCESS_KEY below, then redeploy.
 *   3. Submit one test inquiry from the live site and confirm it arrives. Check your Junk folder the first time
 *      and mark the sender as safe so Outlook never filters a lead.
 *
 * Until a key is pasted in, the form falls back to opening the visitor's email app with the message
 * pre-filled, and it never tells the visitor that a message was sent when it was not.
 */
(function () {
    'use strict';

    var CONFIG = {
        ENDPOINT: 'https://api.web3forms.com/submit',
        ACCESS_KEY: 'PASTE_YOUR_WEB3FORMS_ACCESS_KEY_HERE',
        TO_EMAIL: 'Hernandezanalytics@outlook.com',
        MIN_SECONDS_BEFORE_SUBMIT: 3   // bots submit instantly; people do not
    };
    var READY = CONFIG.ACCESS_KEY.indexOf('PASTE_') !== 0;

    /* ---------- small helpers ---------- */
    function qs(name) { try { return new URLSearchParams(window.location.search).get(name) || ''; } catch (e) { return ''; } }
    function store(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* storage can be blocked, that is fine */ } }
    function load(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }

    /* Remember where the visitor came from on their first page, so the lead tells you which channel worked. */
    (function captureAttribution() {
        if (load('qx_attr')) return;
        var a = { landing: window.location.pathname, referrer: document.referrer || 'direct' };
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) { var v = qs(k); if (v) a[k] = v; });
        store('qx_attr', JSON.stringify(a));
    })();
    function attribution() { try { return JSON.parse(load('qx_attr') || '{}'); } catch (e) { return {}; } }

    var toastTimer, toastEl;
    function toast(msg) {
        if (!toastEl) {
            toastEl = document.getElementById('toast');
            if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'toast'; toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
        }
        toastEl.textContent = msg; toastEl.classList.add('show');
        clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2400);
    }
    function copy(text, okMsg) {
        function done() { toast(okMsg || 'Copied to clipboard'); }
        function fallback() {
            var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(); } catch (e) { toast('Press and hold to copy'); }
            document.body.removeChild(ta);
        }
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    }

    document.querySelectorAll('[data-copy-email]').forEach(function (b) {
        b.addEventListener('click', function () { copy(CONFIG.TO_EMAIL, 'Email address copied'); });
    });

    /* ---------- form wiring ---------- */
    function value(form, name) {
        var checked = form.querySelector('[name="' + name + '"]:checked');
        if (checked) return checked.value;
        var el = form.querySelector('[name="' + name + '"]');
        return el && el.type !== 'radio' ? el.value.trim() : '';
    }
    function setErr(form, name, bad) {
        var el = form.querySelector('[name="' + name + '"]');
        var f = el && el.closest('.field'); if (f) f.classList.toggle('err', bad);
        return bad;
    }

    function init(form) {
        var card = form.closest('.form-card') || form.parentNode;
        var loadedAt = Date.now();
        var btn = form.querySelector('[type="submit"]');
        var label = btn ? btn.querySelector('[data-label]') : null;
        var idleLabel = label ? label.textContent : '';
        var lastMailto = '', lastBody = '';

        var sample = qs('sample'), sampleField = form.querySelector('[name="sample_viewed"]');
        if (sample && sampleField) sampleField.value = sample;

        ['name', 'email', 'message'].forEach(function (n) {
            var el = form.querySelector('[name="' + n + '"]');
            if (el) el.addEventListener('input', function () { var f = el.closest('.field'); if (f) f.classList.remove('err'); });
        });

        function ok(direct, name, email) {
            if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
            if (label) label.textContent = idleLabel;
            var t = card.querySelector('[data-ok-title]'), p = card.querySelector('[data-ok-text]');
            var first = (name || '').split(' ')[0];
            if (t) t.textContent = direct ? ('Thank you' + (first ? ', ' + first : '') + '.') : 'Your message is ready.';
            if (p) p.textContent = direct
                ? 'Your message has been received. You will hear back at ' + email + '.'
                : 'Your email app should have opened with everything filled in. Just press send. If nothing happened, use the buttons below.';
            card.querySelectorAll('[data-fallback-only]').forEach(function (e) { e.style.display = direct ? 'none' : ''; });
            card.classList.add('sent');
            try { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { /* older browsers */ }
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            // Spam traps: a hidden field people never see, and a minimum time on the page.
            var trap = form.querySelector('[name="website"]');
            if (trap && trap.value) return;
            if (Date.now() - loadedAt < CONFIG.MIN_SECONDS_BEFORE_SUBMIT * 1000) { toast('One moment, then try again.'); return; }

            var name = value(form, 'name'), email = value(form, 'email'), message = value(form, 'message');
            var bad = setErr(form, 'name', name.length < 2);
            bad = setErr(form, 'email', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) || bad;
            bad = setErr(form, 'message', message.length < 5) || bad;
            if (bad) { var first = form.querySelector('.err input, .err textarea'); if (first) first.focus(); return; }

            var data = {
                name: name, email: email, message: message,
                company: value(form, 'company'),
                interest: value(form, 'interest'),
                reporting_today: value(form, 'reporting_today'),
                timing: value(form, 'timing'),
                heard_about: value(form, 'heard_about'),
                sample_viewed: value(form, 'sample_viewed')
            };
            var attr = attribution(), meta = {
                form: form.getAttribute('data-lead-form') || 'site',
                page: window.location.pathname,
                landing_page: attr.landing || '',
                came_from: attr.referrer || '',
                utm_source: attr.utm_source || '', utm_medium: attr.utm_medium || '', utm_campaign: attr.utm_campaign || '',
                submitted_at: new Date().toISOString()
            };

            var subject = 'New Quantivyx lead: ' + name + (data.company ? ' (' + data.company + ')' : '');
            var lines = ['Name: ' + name, 'Email: ' + email];
            if (data.company) lines.push('Company: ' + data.company);
            if (data.interest) lines.push('Wants help with: ' + data.interest);
            if (data.reporting_today) lines.push('Reporting today: ' + data.reporting_today);
            if (data.timing) lines.push('Timing: ' + data.timing);
            if (data.sample_viewed) lines.push('Sample dashboard viewed: ' + data.sample_viewed);
            if (data.heard_about) lines.push('Heard about us: ' + data.heard_about);
            lastBody = 'Hi,\n\n' + message + '\n\n----\n' + lines.join('\n');
            lastMailto = 'mailto:' + CONFIG.TO_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lastBody);

            if (btn) { btn.classList.add('loading'); btn.disabled = true; }
            if (label) label.textContent = 'Sending...';

            function fallback() { window.location.href = lastMailto; setTimeout(function () { ok(false, name, email); }, 450); }

            if (!READY) {
                if (window.console) console.warn('Quantivyx form: no access key set in lead-form.js, using the email app fallback.');
                fallback(); return;
            }

            var payload = { access_key: CONFIG.ACCESS_KEY, subject: subject, from_name: 'Quantivyx Website', replyto: email };
            Object.keys(data).forEach(function (k) { if (data[k]) payload[k] = data[k]; });
            Object.keys(meta).forEach(function (k) { if (meta[k]) payload[k] = meta[k]; });

            fetch(CONFIG.ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload) })
                .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
                .then(function (res) { if (res.ok && res.body && res.body.success) ok(true, name, email); else throw new Error('rejected'); })
                .catch(function () { fallback(); });
        });

        var copyMsg = card.querySelector('[data-copy-msg]');
        if (copyMsg) copyMsg.addEventListener('click', function () { copy(CONFIG.TO_EMAIL + '\n\n' + lastBody, 'Message copied. Paste it into any email.'); });
        var reopen = card.querySelector('[data-reopen]');
        if (reopen) reopen.addEventListener('click', function (e) { e.preventDefault(); if (lastMailto) window.location.href = lastMailto; });
    }

    document.querySelectorAll('form[data-lead-form]').forEach(init);
})();