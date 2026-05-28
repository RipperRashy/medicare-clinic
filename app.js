// ─── AUTH GUARD ───────────────────────────────────────────────────────────────
// Check session on load — redirect to login if not authenticated
(async () => {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }
  // Show logged-in user email in sidebar
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = session.user.email;
  // Now safe to load dashboard
  loadDashboard();
})();

// ─── LOGOUT ──────────────────────────────────────────────────────────────────
async function logout() {
  await db.auth.signOut();
  window.location.href = 'login.html';
}

// ─── NAVIGATION ──────────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const page = item.dataset.page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('page-' + page).classList.add('active');
    if (page === 'patients') loadPatients();
    if (page === 'appointments') loadAppointments();
    if (page === 'doctors') loadDoctors();
    if (page === 'reports') loadReports();
  });
});

// ─── TOAST ───────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  setTimeout(() => t.className = 'toast hidden', 3000);
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
async function loadDashboard() {
  const [{ count: pCount }, { count: dCount }, { count: aCount }, todayAppts, recentAppts, doctors] = await Promise.all([
    db.from('patients').select('*', { count: 'exact', head: true }),
    db.from('doctors').select('*', { count: 'exact', head: true }),
    db.from('appointments').select('*', { count: 'exact', head: true }),
    db.from('appointments').select('*', { count: 'exact', head: true }).eq('appointment_date', new Date().toISOString().slice(0,10)),
    db.from('appointments').select('*, patients(full_name), doctors(full_name)').order('created_at', { ascending: false }).limit(5),
    db.from('doctors').select('*').eq('available', true).limit(6),
  ]);

  document.getElementById('stat-patients').textContent = pCount ?? 0;
  document.getElementById('stat-doctors').textContent = dCount ?? 0;
  document.getElementById('stat-appointments').textContent = aCount ?? 0;
  document.getElementById('stat-today').textContent = todayAppts.count ?? 0;

  const raEl = document.getElementById('recent-appointments');
  if (!recentAppts.data || recentAppts.data.length === 0) {
    raEl.innerHTML = '<p class="empty-state">No appointments yet.</p>';
  } else {
    raEl.innerHTML = recentAppts.data.map(a => `
      <div class="appt-row">
        <div>
          <p class="appt-name">${a.patients?.full_name || '—'}</p>
          <p class="appt-meta">${a.appointment_date} at ${formatTime(a.appointment_time)} · ${a.doctors?.full_name || '—'}</p>
        </div>
        <span class="badge badge-${a.status.toLowerCase()}">${a.status}</span>
      </div>
    `).join('');
  }

  const dlEl = document.getElementById('doctors-list-dash');
  if (!doctors.data || doctors.data.length === 0) {
    dlEl.innerHTML = '<p class="empty-state">No doctors found.</p>';
  } else {
    dlEl.innerHTML = doctors.data.map(d => `
      <div class="appt-row">
        <div>
          <p class="appt-name">${d.full_name}</p>
          <p class="appt-meta">${d.specialization || 'General'}</p>
        </div>
        <span class="avail-badge">Available</span>
      </div>
    `).join('');
  }
}

// ─── PATIENTS ────────────────────────────────────────────────────────────────
let allPatients = [];

async function loadPatients() {
  const { data, error } = await db.from('patients').select('*').order('created_at', { ascending: false });
  if (error) { showToast('Error loading patients', 'error'); return; }
  allPatients = data || [];
  renderPatients(allPatients);
}

function renderPatients(patients) {
  const tbody = document.getElementById('patients-tbody');
  if (patients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No patients found. Add one to get started.</td></tr>';
    return;
  }
  tbody.innerHTML = patients.map(p => `
    <tr>
      <td><strong>${p.full_name}</strong></td>
      <td>${p.gender || '—'}</td>
      <td>${p.date_of_birth || '—'}</td>
      <td>${p.phone || '—'}</td>
      <td>${p.blood_group || '—'}</td>
      <td>${formatDate(p.created_at)}</td>
      <td>
        <button class="action-btn" onclick="viewPatient('${p.id}')">View</button>
        <button class="action-btn danger" onclick="deletePatient('${p.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function filterPatients() {
  const q = document.getElementById('patient-search').value.toLowerCase();
  renderPatients(allPatients.filter(p =>
    p.full_name.toLowerCase().includes(q) || (p.phone || '').includes(q)
  ));
}

async function deletePatient(id) {
  if (!confirm('Delete this patient? This will also remove their appointments.')) return;
  const { error } = await db.from('patients').delete().eq('id', id);
  if (error) { showToast('Failed to delete patient', 'error'); return; }
  showToast('Patient deleted');
  loadPatients();
  loadDashboard();
}

async function viewPatient(id) {
  const { data: p } = await db.from('patients').select('*').eq('id', id).single();
  if (!p) return;
  document.getElementById('modal-title').textContent = 'Patient Details';
  document.getElementById('modal-body').innerHTML = `
    <div class="form">
      <div class="form-row">
        <div class="form-group"><label>Full Name</label><input value="${p.full_name}" readonly /></div>
        <div class="form-group"><label>Gender</label><input value="${p.gender || '—'}" readonly /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Date of Birth</label><input value="${p.date_of_birth || '—'}" readonly /></div>
        <div class="form-group"><label>Blood Group</label><input value="${p.blood_group || '—'}" readonly /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Phone</label><input value="${p.phone || '—'}" readonly /></div>
        <div class="form-group"><label>Email</label><input value="${p.email || '—'}" readonly /></div>
      </div>
      <div class="form-group"><label>Address</label><textarea readonly>${p.address || '—'}</textarea></div>
    </div>
    <div class="form-actions"><button class="btn-cancel" onclick="closeModal()">Close</button></div>
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

// ─── APPOINTMENTS ─────────────────────────────────────────────────────────────
async function loadAppointments() {
  const status = document.getElementById('appt-status-filter')?.value || '';
  let query = db.from('appointments')
    .select('*, patients(full_name), doctors(full_name)')
    .order('appointment_date', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) { showToast('Error loading appointments', 'error'); return; }

  const tbody = document.getElementById('appointments-tbody');
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No appointments found.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(a => `
    <tr>
      <td><strong>${a.patients?.full_name || '—'}</strong></td>
      <td>${a.doctors?.full_name || '—'}</td>
      <td>${a.appointment_date}</td>
      <td>${formatTime(a.appointment_time)}</td>
      <td>${a.reason || '—'}</td>
      <td><span class="badge badge-${a.status.toLowerCase()}">${a.status}</span></td>
      <td>
        ${a.status === 'Scheduled' ? `
          <button class="action-btn success" onclick="updateStatus('${a.id}','Completed')">Complete</button>
          <button class="action-btn danger" onclick="updateStatus('${a.id}','Cancelled')">Cancel</button>
        ` : '—'}
      </td>
    </tr>
  `).join('');
}

async function updateStatus(id, status) {
  const { error } = await db.from('appointments').update({ status }).eq('id', id);
  if (error) { showToast('Failed to update status', 'error'); return; }
  showToast(`Appointment marked as ${status}`);
  loadAppointments();
  loadDashboard();
}

// ─── DOCTORS ─────────────────────────────────────────────────────────────────
async function loadDoctors() {
  const { data, error } = await db.from('doctors').select('*').order('full_name');
  if (error) { showToast('Error loading doctors', 'error'); return; }

  const grid = document.getElementById('doctors-grid');
  if (!data || data.length === 0) {
    grid.innerHTML = '<p class="empty-state">No doctors found. Add one to get started.</p>';
    return;
  }
  grid.innerHTML = data.map(d => `
    <div class="doctor-card">
      <div class="doctor-avatar" style="${d.flagged ? 'background:linear-gradient(135deg,#fef2f2,#fecaca);color:#dc2626;' : ''}">${initials(d.full_name)}</div>
      <p class="doctor-name">${d.full_name}</p>
      <p class="doctor-spec">${d.specialization || 'General Practice'}</p>
      <div class="doctor-info">
        <span>📞 ${d.phone || '—'}</span>
        <span>✉️ ${d.email || '—'}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:12px;">
        ${d.flagged ? '<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11.5px;font-weight:600;background:#fef2f2;color:#dc2626;">⚑ Under Review</span>' : ''}
        <span class="avail-badge" style="${d.available ? '' : 'background:#f1f5f9;color:#64748b;'}">${d.available ? '● Available' : '○ Unavailable'}</span>
        <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:4px;">
          <button class="action-btn" onclick="toggleAvailability('${d.id}', ${d.available})">${d.available ? 'Set Unavailable' : 'Set Available'}</button>
          <button class="action-btn ${d.flagged ? 'success' : 'danger'}" onclick="toggleFlag('${d.id}', ${d.flagged || false})">${d.flagged ? 'Unflag' : 'Flag'}</button>
          <button class="action-btn danger" onclick="deleteDoctor('${d.id}')">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function toggleAvailability(id, current) {
  const { error } = await db.from('doctors').update({ available: !current }).eq('id', id);
  if (error) { showToast('Failed to update', 'error'); return; }
  showToast('Availability updated');
  loadDoctors();
}

async function toggleFlag(id, current) {
  const { error } = await db.from('doctors').update({ flagged: !current }).eq('id', id);
  if (error) { showToast('Failed to update', 'error'); return; }
  showToast(current ? 'Flag removed' : 'Doctor flagged for review');
  loadDoctors();
}

async function deleteDoctor(id) {
  if (!confirm('Delete this doctor? This cannot be undone.')) return;
  const { error } = await db.from('doctors').delete().eq('id', id);
  if (error) { showToast('Failed to delete doctor', 'error'); return; }
  showToast('Doctor removed');
  loadDoctors();
  loadDashboard();
}

function showDoctorForm() {
  document.getElementById('modal-title').textContent = 'Add New Doctor';
  document.getElementById('modal-body').innerHTML = `
    <div class="form">
      <div class="form-row">
        <div class="form-group"><label>Full Name *</label><input id="df-name" placeholder="Dr. Jane Odhiambo" /></div>
        <div class="form-group"><label>Specialization</label><input id="df-spec" placeholder="e.g. Cardiologist" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Phone</label><input id="df-phone" placeholder="0712 345 678" /></div>
        <div class="form-group"><label>Email</label><input id="df-email" type="email" placeholder="doctor@clinic.com" /></div>
      </div>
      <div class="form-group"><label>Availability</label>
        <select id="df-available">
          <option value="true">Available</option>
          <option value="false">Unavailable</option>
        </select>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="submitDoctor()">Add Doctor</button>
    </div>
  `;
}

async function submitDoctor() {
  const name = document.getElementById('df-name').value.trim();
  if (!name) { showToast('Full name is required', 'error'); return; }
  const payload = {
    full_name: name,
    specialization: document.getElementById('df-spec').value.trim() || null,
    phone: document.getElementById('df-phone').value.trim() || null,
    email: document.getElementById('df-email').value.trim() || null,
    available: document.getElementById('df-available').value === 'true',
    flagged: false,
  };
  const { error } = await db.from('doctors').insert([payload]);
  if (error) { showToast('Failed to add doctor: ' + error.message, 'error'); return; }
  showToast('Doctor added successfully!');
  closeModal();
  loadDoctors();
  loadDashboard();
}

// ─── MODALS ───────────────────────────────────────────────────────────────────
function openModal(type) {
  if (type === 'patient') showPatientForm();
  if (type === 'appointment') showAppointmentForm();
  if (type === 'doctor') showDoctorForm();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function showPatientForm() {
  document.getElementById('modal-title').textContent = 'Register New Patient';
  document.getElementById('modal-body').innerHTML = `
    <div class="form" id="patient-form">
      <div class="form-row">
        <div class="form-group"><label>Full Name *</label><input id="pf-name" placeholder="e.g. Jane Muthoni" /></div>
        <div class="form-group"><label>Gender</label>
          <select id="pf-gender">
            <option value="">Select</option>
            <option>Male</option><option>Female</option><option>Other</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Date of Birth</label><input id="pf-dob" type="date" /></div>
        <div class="form-group"><label>Blood Group</label>
          <select id="pf-blood">
            <option value="">Select</option>
            <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
            <option>O+</option><option>O-</option><option>AB+</option><option>AB-</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Phone</label><input id="pf-phone" placeholder="0712 345 678" /></div>
        <div class="form-group"><label>Email</label><input id="pf-email" type="email" placeholder="jane@email.com" /></div>
      </div>
      <div class="form-group"><label>Address</label><textarea id="pf-address" placeholder="Street, Town, County"></textarea></div>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="submitPatient()">Register Patient</button>
    </div>
  `;
}

async function submitPatient() {
  const name = document.getElementById('pf-name').value.trim();
  if (!name) { showToast('Full name is required', 'error'); return; }

  const payload = {
    full_name: name,
    gender: document.getElementById('pf-gender').value || null,
    date_of_birth: document.getElementById('pf-dob').value || null,
    blood_group: document.getElementById('pf-blood').value || null,
    phone: document.getElementById('pf-phone').value.trim() || null,
    email: document.getElementById('pf-email').value.trim() || null,
    address: document.getElementById('pf-address').value.trim() || null,
  };

  const { error } = await db.from('patients').insert([payload]);
  if (error) { showToast('Failed to register patient: ' + error.message, 'error'); return; }
  showToast('Patient registered successfully!');
  closeModal();
  loadPatients();
  loadDashboard();
}

async function showAppointmentForm() {
  const { data: patients } = await db.from('patients').select('id, full_name').order('full_name');
  const { data: doctors } = await db.from('doctors').select('id, full_name').eq('available', true);

  document.getElementById('modal-title').textContent = 'Book Appointment';
  document.getElementById('modal-body').innerHTML = `
    <div class="form">
      <div class="form-group"><label>Patient *</label>
        <select id="af-patient">
          <option value="">Select patient</option>
          ${(patients || []).map(p => `<option value="${p.id}">${p.full_name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Doctor *</label>
        <select id="af-doctor">
          <option value="">Select doctor</option>
          ${(doctors || []).map(d => `<option value="${d.id}">${d.full_name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Date *</label><input id="af-date" type="date" min="${new Date().toISOString().slice(0,10)}" /></div>
        <div class="form-group"><label>Time *</label><input id="af-time" type="time" /></div>
      </div>
      <div class="form-group"><label>Reason for Visit</label><textarea id="af-reason" placeholder="e.g. Fever and headache for 3 days"></textarea></div>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="submitAppointment()">Book Appointment</button>
    </div>
  `;
}

async function submitAppointment() {
  const patient_id = document.getElementById('af-patient').value;
  const doctor_id = document.getElementById('af-doctor').value;
  const appointment_date = document.getElementById('af-date').value;
  const appointment_time = document.getElementById('af-time').value;

  if (!patient_id || !doctor_id || !appointment_date || !appointment_time) {
    showToast('Please fill all required fields', 'error'); return;
  }

  const due = new Date(appointment_date);
  due.setDate(due.getDate() + 7);

  const { error } = await db.from('appointments').insert([{
    patient_id, doctor_id, appointment_date, appointment_time,
    reason: document.getElementById('af-reason').value.trim() || null,
    due_date: due.toISOString().slice(0,10),
    status: 'Scheduled'
  }]);

  if (error) { showToast('Failed to book: ' + error.message, 'error'); return; }
  showToast('Appointment booked!');
  closeModal();
  loadAppointments();
  loadDashboard();
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(str) {
  if (!str) return '—';
  const [h, m] = str.split(':');
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr < 12 ? 'AM' : 'PM'}`;
}

function initials(name) {
  return name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
}

// ─── DATE CHIP ────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const dc = document.getElementById('date-chip');
  if (dc) dc.textContent = new Date().toLocaleDateString('en-KE', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });
});

// ─── REPORTS ─────────────────────────────────────────────────────────────────
let chartStatus = null, chartGender = null, chartDoctors = null, chartBlood = null;

async function loadReports() {
  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: totalPatients },
    { data: appointments },
    { data: patients },
    { data: doctors },
    { count: todayCount },
  ] = await Promise.all([
    db.from('patients').select('*', { count: 'exact', head: true }),
    db.from('appointments').select('status, doctor_id, doctors(full_name)'),
    db.from('patients').select('gender, blood_group'),
    db.from('doctors').select('id, full_name'),
    db.from('appointments').select('*', { count: 'exact', head: true }).eq('appointment_date', today),
  ]);

  // ── Summary stats
  const completed  = (appointments || []).filter(a => a.status === 'Completed').length;
  const scheduled  = (appointments || []).filter(a => a.status === 'Scheduled').length;

  document.getElementById('r-total-patients').textContent = totalPatients ?? 0;
  document.getElementById('r-completed').textContent      = completed;
  document.getElementById('r-scheduled').textContent      = scheduled;
  document.getElementById('r-today').textContent          = todayCount ?? 0;

  // ── Chart colours
  const BLUE   = '#2563eb';
  const GREEN  = '#16a34a';
  const RED    = '#dc2626';
  const PURPLE = '#7c3aed';
  const ORANGE = '#ea580c';
  const CYAN   = '#0891b2';
  const PINK   = '#db2777';
  const YELLOW = '#ca8a04';

  // ── 1. Status doughnut
  const statusCtx = document.getElementById('chart-status').getContext('2d');
  if (chartStatus) chartStatus.destroy();
  chartStatus = new Chart(statusCtx, {
    type: 'doughnut',
    data: {
      labels: ['Scheduled', 'Completed', 'Cancelled'],
      datasets: [{
        data: [
          scheduled,
          completed,
          (appointments || []).filter(a => a.status === 'Cancelled').length,
        ],
        backgroundColor: [BLUE, GREEN, RED],
        borderWidth: 2,
        borderColor: '#fff',
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 }, padding: 16 } }
      },
      cutout: '65%',
    }
  });

  // ── 2. Gender doughnut
  const genderCounts = { Male: 0, Female: 0, Other: 0 };
  (patients || []).forEach(p => {
    const g = p.gender || 'Other';
    genderCounts[g] = (genderCounts[g] || 0) + 1;
  });
  const genderCtx = document.getElementById('chart-gender').getContext('2d');
  if (chartGender) chartGender.destroy();
  chartGender = new Chart(genderCtx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(genderCounts),
      datasets: [{
        data: Object.values(genderCounts),
        backgroundColor: [BLUE, PINK, PURPLE],
        borderWidth: 2,
        borderColor: '#fff',
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 }, padding: 16 } }
      },
      cutout: '65%',
    }
  });

  // ── 3. Appointments per doctor bar chart
  const doctorMap = {};
  (doctors || []).forEach(d => { doctorMap[d.id] = d.full_name; });
  const doctorCounts = {};
  (appointments || []).forEach(a => {
    const name = a.doctors?.full_name || doctorMap[a.doctor_id] || 'Unknown';
    doctorCounts[name] = (doctorCounts[name] || 0) + 1;
  });
  const doctorCtx = document.getElementById('chart-doctors').getContext('2d');
  if (chartDoctors) chartDoctors.destroy();
  chartDoctors = new Chart(doctorCtx, {
    type: 'bar',
    data: {
      labels: Object.keys(doctorCounts),
      datasets: [{
        label: 'Appointments',
        data: Object.values(doctorCounts),
        backgroundColor: BLUE,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Inter' } }, grid: { color: '#f1f5f9' } },
        x: { ticks: { font: { family: 'Inter' } }, grid: { display: false } }
      }
    }
  });

  // ── 4. Blood group bar chart
  const bloodCounts = {};
  (patients || []).forEach(p => {
    const b = p.blood_group || 'Unknown';
    bloodCounts[b] = (bloodCounts[b] || 0) + 1;
  });
  const colors = [BLUE, GREEN, RED, PURPLE, ORANGE, CYAN, PINK, YELLOW];
  const bloodCtx = document.getElementById('chart-blood').getContext('2d');
  if (chartBlood) chartBlood.destroy();
  chartBlood = new Chart(bloodCtx, {
    type: 'bar',
    data: {
      labels: Object.keys(bloodCounts),
      datasets: [{
        label: 'Patients',
        data: Object.values(bloodCounts),
        backgroundColor: colors.slice(0, Object.keys(bloodCounts).length),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Inter' } }, grid: { color: '#f1f5f9' } },
        x: { ticks: { font: { family: 'Inter' } }, grid: { display: false } }
      }
    }
  });
}
