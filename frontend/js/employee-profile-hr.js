/**
 * HR Employee Profile
 *
 * Opens the full personnel file when HR clicks "View" on an employee.
 *
 * Medical records are fetched through a SEPARATE rpc and only when explicitly
 * requested - the ADA requires medical information to be kept in separate
 * confidential files rather than mixed into the general personnel record, so
 * get_employee_profile() never returns them.
 */

let hrProfileEmployeeId = null;
let hrProfileData = null;

function openEmployeeProfile(employeeId) {
  hrProfileEmployeeId = employeeId;
  (async () => {
    try {
      const context = getBranchContext();
      if (!context) return alert('No branch context - please log in again');

      const { data, error } = await window.supabase.rpc('get_employee_profile', {
        p_employee_id: employeeId,
        p_branch_id: context.branch_id,
        p_viewer_id: getAuthUUID()
      });

      if (error) throw error;
      if (data && data.error) return alert(data.error);

      hrProfileData = data;
      renderEmployeeProfile(data);
      document.getElementById('employeeProfileModal').style.display = 'flex';
    } catch (err) {
      console.error('Load employee profile error:', err);
      alert('Failed to load profile: ' + err.message);
    }
  })();
}

function closeEmployeeProfile() {
  const m = document.getElementById('employeeProfileModal');
  if (m) m.style.display = 'none';
  hrProfileEmployeeId = null;
  hrProfileData = null;
}

function pEsc(v) {
  const d = document.createElement('div');
  d.textContent = v == null || v === '' ? '-' : String(v);
  return d.innerHTML;
}

function pDate(v) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('en-ZM');
}

function renderEmployeeProfile(d) {
  const e = d.employee || {};
  const initials = ((e.first_name || '?')[0] + (e.last_name || '')[0] || '?').toUpperCase();

  document.getElementById('profileHeader').innerHTML = [
    e.avatar_url
      ? '<img src="' + pEsc(e.avatar_url) + '" class="profile-avatar-img" alt="">'
      : '<div class="profile-avatar-initials">' + pEsc(initials) + '</div>',
    '<div>',
      '<h3 style="margin:0 0 4px">' + pEsc((e.preferred_name || e.first_name) + ' ' + e.last_name) + '</h3>',
      '<div style="color:var(--zf-text-dim);font-size:13px">' + pEsc(e.position) + ' &middot; ' + pEsc(e.department_name) + '</div>',
      '<div style="color:var(--zf-text-faint);font-size:12px;margin-top:4px">' + pEsc(e.employee_code) + ' &middot; ' + pEsc(e.email) + '</div>',
    '</div>',
    '<span class="status-badge status-' + String(e.status || '').toLowerCase() + '" style="margin-left:auto">' + pEsc(e.status) + '</span>'
  ].join('');

  // Overview
  const att = d.attendance_summary || {};
  const lv = d.leave_summary || {};
  document.getElementById('profileTabOverview').innerHTML = [
    '<div class="dashboard-grid">',
      statCard('Present (90d)', att.days_present ?? 0),
      statCard('Absent (90d)', att.days_absent ?? 0),
      statCard('Leave days taken', lv.approved_days ?? 0),
      statCard('Active warnings', (d.disciplinary_records || []).filter(r => r.status === 'ACTIVE').length),
    '</div>',
    '<div class="form-grid" style="margin-top:20px">',
      field('Hire date', pDate(e.hire_date)),
      field('Date of birth', pDate(e.date_of_birth)),
      field('Phone', pEsc(e.phone)),
      field('Personal email', pEsc(e.personal_email)),
      field('Address', pEsc([e.address, e.city].filter(Boolean).join(', '))),
      field('Nationality', pEsc(e.nationality)),
      field('NRC / ID', pEsc(e.identity_number)),
      field('Tax PIN', pEsc(e.tax_pin)),
      field('Basic salary', e.basic_salary != null ? 'K ' + Number(e.basic_salary).toLocaleString('en-ZM', {minimumFractionDigits:2}) : '-'),
      field('Emergency contact', pEsc(e.emergency_contact_name)),
      field('Emergency phone', pEsc(e.emergency_contact_phone)),
      field('Relationship', pEsc(e.emergency_contact_relationship)),
    '</div>'
  ].join('');

  // Performance
  const reviews = d.performance_reviews || [];
  document.getElementById('profileTabPerformance').innerHTML =
    '<button class="btn-primary" onclick="addPerformanceReview()" style="margin-bottom:16px">Add review</button>' +
    (reviews.length === 0
      ? '<p class="no-data">No performance reviews recorded</p>'
      : recordTable(
          ['Period', 'Reviewed', 'Rating', 'Strengths', 'Improvements', 'Reviewer'],
          reviews.map(r => [
            pDate(r.review_period_start) + ' - ' + pDate(r.review_period_end),
            pDate(r.review_date),
            r.overall_rating != null ? r.overall_rating + ' / 5' : '-',
            pEsc(r.strengths), pEsc(r.areas_for_improvement), pEsc(r.reviewer_name)
          ])
        ));

  // Disciplinary
  const disc = d.disciplinary_records || [];
  document.getElementById('profileTabDisciplinary').innerHTML =
    '<button class="btn-primary" onclick="addDisciplinaryRecord()" style="margin-bottom:16px">Record incident</button>' +
    (disc.length === 0
      ? '<p class="no-data">No disciplinary records - a clean file</p>'
      : recordTable(
          ['Incident', 'Severity', 'Category', 'Description', 'Action', 'Status', 'Expires'],
          disc.map(r => [
            pDate(r.incident_date),
            '<span class="status-badge ' + severityClass(r.severity) + '">' + pEsc(String(r.severity).replace(/_/g,' ')) + '</span>',
            pEsc(r.category), pEsc(r.description), pEsc(r.action_taken),
            pEsc(r.status), pDate(r.expires_on)
          ])
        ));

  // Training
  const tr = d.training_records || [];
  document.getElementById('profileTabTraining').innerHTML =
    '<button class="btn-primary" onclick="addTrainingRecord()" style="margin-bottom:16px">Add training</button>' +
    (tr.length === 0
      ? '<p class="no-data">No training recorded</p>'
      : recordTable(
          ['Course', 'Provider', 'Type', 'Completed', 'Expires', 'Result'],
          tr.map(r => [
            pEsc(r.course_name), pEsc(r.provider), pEsc(r.training_type),
            pDate(r.completion_date),
            r.expiry_date && new Date(r.expiry_date) < new Date()
              ? '<span style="color:var(--zf-danger)">' + pDate(r.expiry_date) + ' (expired)</span>'
              : pDate(r.expiry_date),
            pEsc(r.result)
          ])
        ));

  // Employment history
  const hist = d.employment_history || [];
  document.getElementById('profileTabHistory').innerHTML = hist.length === 0
    ? '<p class="no-data">No employment history recorded</p>'
    : recordTable(
        ['Date', 'Change', 'From', 'To', 'Reason'],
        hist.map(h => [
          pDate(h.effective_date),
          pEsc(String(h.change_type).replace(/_/g,' ')),
          pEsc(h.previous_position || (h.previous_salary != null ? 'K ' + h.previous_salary : '')),
          pEsc(h.new_position || (h.new_salary != null ? 'K ' + h.new_salary : '')),
          pEsc(h.reason)
        ])
      );

  // Medical - gated behind an explicit action
  document.getElementById('profileTabMedical').innerHTML = [
    '<div class="card" style="border-left:3px solid var(--zf-warning)">',
      '<p style="font-size:13px;color:var(--zf-text-muted);margin-bottom:12px">',
        'Medical records are held separately from the personnel file and are restricted to HR ',
        'and administrators. Opening them is recorded in the access log.',
      '</p>',
      d.has_medical_records
        ? '<button class="btn-secondary" onclick="loadMedicalRecords()">View medical records</button>'
        : '<p class="no-data" style="padding:12px 0">No medical records on file</p>',
    '</div>',
    '<div id="medicalRecordsArea"></div>'
  ].join('');
}

function severityClass(sev) {
  if (sev === 'VERBAL_WARNING') return 'status-pending';
  if (sev === 'WRITTEN_WARNING') return 'status-pending';
  return 'status-terminated';
}

function statCard(label, value) {
  return '<div class="metric-card"><div class="metric-label">' + pEsc(label) + '</div>' +
         '<div class="metric-value">' + pEsc(value) + '</div></div>';
}

function field(label, value) {
  return '<div class="form-group"><label>' + pEsc(label) + '</label>' +
         '<div style="font-size:14px;padding:6px 0">' + value + '</div></div>';
}

function recordTable(headers, rows) {
  return '<div class="table-wrapper"><table><thead><tr>' +
    headers.map(h => '<th>' + pEsc(h) + '</th>').join('') +
    '</tr></thead><tbody>' +
    rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') +
    '</tbody></table></div>';
}

function switchProfileTab(name) {
  document.querySelectorAll('.profile-tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.profile-tab-btn').forEach(el => el.classList.remove('active'));
  const panel = document.getElementById('profileTab' + name);
  if (panel) panel.style.display = 'block';
  const btn = document.querySelector('.profile-tab-btn[data-tab="' + name + '"]');
  if (btn) btn.classList.add('active');
}

function loadMedicalRecords() {
  (async () => {
    try {
      const context = getBranchContext();
      const { data, error } = await window.supabase.rpc('get_employee_medical_records', {
        p_employee_id: hrProfileEmployeeId,
        p_branch_id: context.branch_id,
        p_viewer_id: getAuthUUID()
      });
      if (error) throw error;

      if (data && data.error) return alert(data.error);

      const area = document.getElementById('medicalRecordsArea');
      area.innerHTML = (!Array.isArray(data) || data.length === 0)
        ? '<p class="no-data">No medical records</p>'
        : recordTable(
            ['Date', 'Type', 'Summary', 'Restrictions', 'Valid until'],
            data.map(m => [
              pDate(m.record_date), pEsc(String(m.record_type).replace(/_/g,' ')),
              pEsc(m.summary), pEsc(m.restrictions), pDate(m.valid_until)
            ])
          );
    } catch (err) {
      console.error('Medical records error:', err);
      alert('Failed to load medical records: ' + err.message);
    }
  })();
}

function addDisciplinaryRecord() {
  const severity = prompt('Severity (VERBAL_WARNING, WRITTEN_WARNING, FINAL_WARNING, SUSPENSION, DISMISSAL):');
  if (!severity) return;
  const incidentDate = prompt('Incident date (YYYY-MM-DD):');
  if (!incidentDate) return;
  const description = prompt('What happened?');
  if (!description) return;
  const category = prompt('Category (optional, e.g. Attendance, Conduct):') || null;
  const action = prompt('Action taken (optional):') || null;
  const expires = prompt('Warning expires on (YYYY-MM-DD, optional):') || null;

  (async () => {
    try {
      const context = getBranchContext();
      const { data, error } = await window.supabase.rpc('add_disciplinary_record', {
        p_employee_id: hrProfileEmployeeId,
        p_branch_id: context.branch_id,
        p_incident_date: incidentDate,
        p_severity: severity.trim().toUpperCase(),
        p_category: category,
        p_description: description,
        p_action_taken: action,
        p_expires_on: expires,
        p_issued_by: getAuthUUID()
      });
      if (error) throw error;
      alert(data[0].message);
      if (data[0].success) openEmployeeProfile(hrProfileEmployeeId);
    } catch (err) {
      alert('Failed to add record: ' + err.message);
    }
  })();
}

function addPerformanceReview() {
  const start = prompt('Review period start (YYYY-MM-DD):');
  if (!start) return;
  const end = prompt('Review period end (YYYY-MM-DD):');
  if (!end) return;
  const rating = prompt('Overall rating (1-5):');
  const strengths = prompt('Strengths:') || null;
  const improvements = prompt('Areas for improvement:') || null;
  const goals = prompt('Goals for next period:') || null;

  (async () => {
    try {
      const context = getBranchContext();
      const { data, error } = await window.supabase.rpc('add_performance_review', {
        p_employee_id: hrProfileEmployeeId,
        p_branch_id: context.branch_id,
        p_period_start: start,
        p_period_end: end,
        p_rating: rating ? Number(rating) : null,
        p_strengths: strengths,
        p_improvements: improvements,
        p_goals: goals,
        p_reviewer_id: getAuthUUID()
      });
      if (error) throw error;
      alert(data[0].message);
      if (data[0].success) openEmployeeProfile(hrProfileEmployeeId);
    } catch (err) {
      alert('Failed to save review: ' + err.message);
    }
  })();
}

function addTrainingRecord() {
  const course = prompt('Course name:');
  if (!course) return;
  const provider = prompt('Provider (optional):') || null;
  const type = prompt('Type (INDUCTION, COMPLIANCE, TECHNICAL, SAFETY, LEADERSHIP, OTHER):') || 'OTHER';
  const completed = prompt('Completion date (YYYY-MM-DD, optional):') || null;
  const expiry = prompt('Expiry date (YYYY-MM-DD, optional):') || null;
  const result = prompt('Result (optional):') || null;

  (async () => {
    try {
      const context = getBranchContext();
      const { data, error } = await window.supabase.rpc('add_training_record', {
        p_employee_id: hrProfileEmployeeId,
        p_branch_id: context.branch_id,
        p_course_name: course,
        p_provider: provider,
        p_training_type: type.trim().toUpperCase(),
        p_completion_date: completed,
        p_expiry_date: expiry,
        p_result: result
      });
      if (error) throw error;
      alert(data[0].message);
      if (data[0].success) openEmployeeProfile(hrProfileEmployeeId);
    } catch (err) {
      alert('Failed to add training: ' + err.message);
    }
  })();
}
