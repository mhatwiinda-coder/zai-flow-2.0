/**
 * Employee Self-Service Profile
 *
 * Lets an employee maintain their own photo, contact details, emergency
 * contact and preferences from the landing page. Everything written here
 * lands on the `employees` table - the same record HR opens - so the HR
 * profile stays in step automatically rather than holding a second copy.
 *
 * The landing page knows the signed-in user; HR works in employee records.
 * The two are bridged on email.
 */

(function employeeProfile() {
  'use strict';

  const MAX_AVATAR_PX = 256;      // avatars render at 100px, 256 covers retina
  const JPEG_QUALITY  = 0.85;

  let profile = null;
  let modalEl = null;

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  function currentUserEmail() {
    try {
      return (JSON.parse(localStorage.getItem('user')) || {}).email || null;
    } catch (_) {
      return null;
    }
  }

  function initialsFrom(first, last) {
    return ((first || '?').charAt(0) + (last || '').charAt(0)).toUpperCase();
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /**
   * Shrink an image file to a small square-ish data URL. Keeps rows light -
   * a raw phone photo is several MB, this lands around 20-40KB.
   */
  function resizeToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please choose an image file'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read that file'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('That file is not a readable image'));
        img.onload = () => {
          const scale = Math.min(1, MAX_AVATAR_PX / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          // White backdrop so transparent PNGs don't turn black as JPEG
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);

          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Load + render                                                       */
  /* ------------------------------------------------------------------ */

  async function loadProfile() {
    const email = currentUserEmail();
    if (!email || !window.supabase) return;

    try {
      const { data, error } = await window.supabase.rpc('get_my_employee_profile', {
        p_email: email
      });
      if (error) throw error;
      profile = Array.isArray(data) && data.length ? data[0] : null;
    } catch (err) {
      // Not fatal - fall through and render the unlinked state so the employee
      // still gets an explanation instead of a card with no controls at all.
      console.error('Profile load error:', err);
      profile = null;
    }

    renderCard();
    applyTheme();
  }

  function renderCard() {
    const avatarEl = document.querySelector('.profile-avatar');
    if (!avatarEl) return;

    if (profile && profile.avatar_url) {
      avatarEl.style.background = `#0f172a url("${profile.avatar_url}") center/cover no-repeat`;
      avatarEl.textContent = '';
    } else if (profile) {
      avatarEl.textContent = initialsFrom(profile.first_name, profile.last_name);
      avatarEl.style.fontSize = '34px';
    }

    // Prefer the name the employee chose to go by
    if (profile && profile.preferred_name) {
      const nameEl = document.getElementById('user-name');
      if (nameEl) nameEl.textContent = profile.preferred_name;
    }

    injectEditButton(avatarEl);
  }

  function handleEditClick() {
    if (!profile) {
      alert('Your login is not yet linked to an HR employee record.\n\n' +
            'Ask HR to onboard you using this email address:\n' + currentUserEmail());
      return;
    }
    openModal();
  }

  function injectEditButton(avatarEl) {
    const card = avatarEl.closest('.profile-card');
    if (!card) return;

    // Reuse the button across reloads, but always restate its label - the
    // linked/unlinked state can change (e.g. HR onboards the person, or the
    // first fetch failed and a retry succeeded).
    let btn = document.getElementById('zf-edit-profile');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'zf-edit-profile';
      btn.type = 'button';
      btn.addEventListener('click', handleEditClick);
      card.appendChild(btn);
    }

    btn.textContent = profile ? 'Edit profile' : 'Profile not linked';
    btn.style.cssText =
      'margin-top:12px;width:100%;padding:10px 14px;border:0;border-radius:10px;' +
      'cursor:pointer;font-size:13px;font-weight:600;' +
      (profile ? 'background:#3b82f6;color:#fff' : 'background:#fef3c7;color:#92400e');

    // Clicking the photo is the obvious way to change it. Bind once only,
    // otherwise repeated loads stack duplicate handlers.
    if (profile && !avatarEl.dataset.zfBound) {
      avatarEl.dataset.zfBound = '1';
      avatarEl.style.cursor = 'pointer';
      avatarEl.title = 'Change profile photo';
      avatarEl.addEventListener('click', handleEditClick);
    }
  }

  function applyTheme() {
    if (!profile || !profile.theme_preference) return;
    document.documentElement.setAttribute('data-theme', profile.theme_preference);
  }

  /* ------------------------------------------------------------------ */
  /* Edit modal                                                          */
  /* ------------------------------------------------------------------ */

  function field(label, id, value, type) {
    return `
      <label style="display:block;margin-bottom:12px">
        <span style="display:block;font-size:12px;color:#94a3b8;margin-bottom:5px">${esc(label)}</span>
        <input id="${id}" type="${type || 'text'}" value="${esc(value)}"
          style="width:100%;padding:10px 12px;border-radius:8px;font-size:14px;
                 border:1px solid rgba(148,163,184,0.3);background:rgba(15,23,42,0.6);color:#e2e8f0">
      </label>`;
  }

  function checkbox(label, key, checked) {
    return `
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;color:#cbd5e1">
        <input type="checkbox" data-notif="${key}" ${checked ? 'checked' : ''}
               style="width:16px;height:16px;cursor:pointer">
        ${esc(label)}
      </label>`;
  }

  function openModal() {
    if (modalEl) modalEl.remove();
    const p = profile || {};
    const prefs = p.notification_prefs || {};

    modalEl = document.createElement('div');
    modalEl.style.cssText =
      'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;' +
      'justify-content:center;padding:16px;background:rgba(2,6,23,0.75);' +
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;overflow-y:auto';

    modalEl.innerHTML = `
      <div style="background:#0f172a;color:#e2e8f0;border:1px solid rgba(148,163,184,0.25);
                  border-radius:16px;width:100%;max-width:640px;max-height:90vh;
                  overflow-y:auto;padding:24px;box-shadow:0 24px 48px rgba(0,0,0,0.5)">

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h2 style="margin:0;font-size:19px;font-weight:700;color:#f8fafc">My Profile</h2>
          <button type="button" id="zf-close" style="background:transparent;border:0;color:#94a3b8;
                  font-size:26px;line-height:1;cursor:pointer">&times;</button>
        </div>

        <div style="display:flex;align-items:center;gap:16px;margin-bottom:22px;flex-wrap:wrap">
          <div id="zf-preview" style="width:88px;height:88px;border-radius:50%;flex-shrink:0;
               background:${p.avatar_url ? `#0f172a url('${p.avatar_url}') center/cover no-repeat`
                                        : 'linear-gradient(135deg,#667eea,#764ba2)'};
               display:flex;align-items:center;justify-content:center;font-size:30px;color:#fff">
            ${p.avatar_url ? '' : esc(initialsFrom(p.first_name, p.last_name))}
          </div>
          <div style="flex:1;min-width:180px">
            <input type="file" id="zf-avatar" accept="image/*" style="display:none">
            <button type="button" id="zf-pick"
              style="padding:9px 14px;border:1px solid rgba(148,163,184,0.35);border-radius:8px;
                     background:transparent;color:#e2e8f0;cursor:pointer;font-size:13px;font-weight:600">
              Choose photo
            </button>
            <button type="button" id="zf-remove"
              style="padding:9px 14px;border:0;border-radius:8px;background:transparent;
                     color:#f87171;cursor:pointer;font-size:13px;margin-left:6px">
              Remove
            </button>
            <div style="font-size:11px;color:#64748b;margin-top:7px">
              Resized to ${MAX_AVATAR_PX}px automatically.
            </div>
          </div>
        </div>

        <div style="font-size:12px;font-weight:700;color:#64748b;letter-spacing:.06em;
                    text-transform:uppercase;margin:0 0 12px">About you</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 14px">
          ${field('Preferred name', 'zf-preferred', p.preferred_name)}
          ${field('Mobile number', 'zf-phone', p.phone, 'tel')}
          ${field('Personal email', 'zf-personal-email', p.personal_email, 'email')}
          ${field('Date of birth', 'zf-dob', p.date_of_birth, 'date')}
          ${field('Gender', 'zf-gender', p.gender)}
          ${field('Marital status', 'zf-marital', p.marital_status)}
          ${field('Nationality', 'zf-nationality', p.nationality)}
          ${field('City', 'zf-city', p.city)}
        </div>
        ${field('Home address', 'zf-address', p.address)}

        <div style="font-size:12px;font-weight:700;color:#64748b;letter-spacing:.06em;
                    text-transform:uppercase;margin:18px 0 12px">Emergency contact</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 14px">
          ${field('Full name', 'zf-ec-name', p.emergency_contact_name)}
          ${field('Phone number', 'zf-ec-phone', p.emergency_contact_phone, 'tel')}
          ${field('Relationship', 'zf-ec-rel', p.emergency_contact_relationship)}
        </div>

        <div style="font-size:12px;font-weight:700;color:#64748b;letter-spacing:.06em;
                    text-transform:uppercase;margin:18px 0 12px">Preferences</div>
        <label style="display:block;margin-bottom:14px">
          <span style="display:block;font-size:12px;color:#94a3b8;margin-bottom:5px">Appearance</span>
          <select id="zf-theme" style="width:100%;padding:10px 12px;border-radius:8px;font-size:14px;
                  border:1px solid rgba(148,163,184,0.3);background:rgba(15,23,42,0.6);color:#e2e8f0">
            <option value="dark"  ${p.theme_preference !== 'light' ? 'selected' : ''}>Dark</option>
            <option value="light" ${p.theme_preference === 'light' ? 'selected' : ''}>Light</option>
          </select>
        </label>
        ${checkbox('Notify me when a task is assigned to me', 'task_assigned', prefs.task_assigned !== false)}
        ${checkbox('Notify me when my leave is approved or declined', 'leave_status', prefs.leave_status !== false)}
        ${checkbox('Remind me to clock in', 'clock_in_reminder', prefs.clock_in_reminder !== false)}
        ${checkbox('Notify me when my payslip is ready', 'payroll_ready', prefs.payroll_ready !== false)}

        <div id="zf-msg" style="margin-top:14px;font-size:13px;min-height:18px"></div>

        <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap">
          <button type="button" id="zf-save"
            style="flex:1 1 160px;padding:12px;border:0;border-radius:10px;background:#3b82f6;
                   color:#fff;font-size:14px;font-weight:600;cursor:pointer">Save changes</button>
          <button type="button" id="zf-cancel"
            style="flex:0 1 120px;padding:12px;border-radius:10px;background:transparent;
                   color:#cbd5e1;font-size:14px;font-weight:600;cursor:pointer;
                   border:1px solid rgba(148,163,184,0.35)">Cancel</button>
        </div>
      </div>`;

    document.body.appendChild(modalEl);
    wireModal();
  }

  function closeModal() {
    if (modalEl) { modalEl.remove(); modalEl = null; }
  }

  function wireModal() {
    let pendingAvatar = null;   // null = unchanged, '' = remove, string = new image

    const $ = id => modalEl.querySelector('#' + id);
    const msg = $('zf-msg');

    $('zf-close').addEventListener('click', closeModal);
    $('zf-cancel').addEventListener('click', closeModal);
    modalEl.addEventListener('click', e => { if (e.target === modalEl) closeModal(); });

    $('zf-pick').addEventListener('click', () => $('zf-avatar').click());

    $('zf-avatar').addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        msg.style.color = '#94a3b8';
        msg.textContent = 'Processing image…';
        pendingAvatar = await resizeToDataUrl(file);
        const preview = $('zf-preview');
        preview.style.background = `#0f172a url('${pendingAvatar}') center/cover no-repeat`;
        preview.textContent = '';
        msg.textContent = 'Photo ready - remember to save.';
      } catch (err) {
        msg.style.color = '#f87171';
        msg.textContent = err.message;
      }
    });

    $('zf-remove').addEventListener('click', () => {
      pendingAvatar = '';
      const preview = $('zf-preview');
      preview.style.background = 'linear-gradient(135deg,#667eea,#764ba2)';
      preview.textContent = initialsFrom(profile.first_name, profile.last_name);
      msg.style.color = '#94a3b8';
      msg.textContent = 'Photo will be removed on save.';
    });

    $('zf-save').addEventListener('click', async () => {
      const btn = $('zf-save');
      btn.disabled = true;
      btn.textContent = 'Saving…';
      msg.style.color = '#94a3b8';
      msg.textContent = '';

      const notifs = {};
      modalEl.querySelectorAll('[data-notif]').forEach(cb => {
        notifs[cb.getAttribute('data-notif')] = cb.checked;
      });

      // Blank inputs are sent as null, which the RPC reads as "leave unchanged".
      const val = id => { const v = ($(id).value || '').trim(); return v === '' ? null : v; };

      try {
        const { data, error } = await window.supabase.rpc('update_my_employee_profile', {
          p_email:                          currentUserEmail(),
          p_preferred_name:                 val('zf-preferred'),
          p_personal_email:                 val('zf-personal-email'),
          p_phone:                          val('zf-phone'),
          p_avatar_url:                     pendingAvatar,
          p_date_of_birth:                  val('zf-dob'),
          p_gender:                         val('zf-gender'),
          p_marital_status:                 val('zf-marital'),
          p_nationality:                    val('zf-nationality'),
          p_address:                        val('zf-address'),
          p_city:                           val('zf-city'),
          p_emergency_contact_name:         val('zf-ec-name'),
          p_emergency_contact_phone:        val('zf-ec-phone'),
          p_emergency_contact_relationship: val('zf-ec-rel'),
          p_theme_preference:               $('zf-theme').value,
          p_notification_prefs:             notifs
        });

        if (error) throw error;

        const result = Array.isArray(data) ? data[0] : data;
        if (!result || !result.success) {
          throw new Error((result && result.message) || 'Could not save profile');
        }

        msg.style.color = '#34d399';
        msg.textContent = 'Saved.';
        await loadProfile();
        setTimeout(closeModal, 700);
      } catch (err) {
        console.error('Profile save error:', err);
        msg.style.color = '#f87171';
        msg.textContent = err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save changes';
      }
    });
  }

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // The landing page builds its profile card on DOMContentLoaded; run just
  // after so the avatar element exists to decorate.
  document.addEventListener('DOMContentLoaded', () => setTimeout(loadProfile, 0));

  window.reloadMyProfile = loadProfile;
})();
