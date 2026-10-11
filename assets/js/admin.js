import { checkAuth, supabase } from './app.js';

let currentAdminProfile = null;
let complianceRecords = [];

window.handleAdminSignOut = async () => { await supabase.auth.signOut(); window.location.href = './index.html'; };

window.switchAdminTab = (tab) => {
    ['courses', 'students', 'students-list', 'admins-list', 'reports', 'tenants'].forEach(t => {
        document.getElementById(`admin-tab-${t}`)?.classList.add('hidden');
        document.getElementById(`tab-btn-${t}`)?.className = 'px-3 py-1.5 text-xs font-semibold rounded text-slate-300 hover:text-white transition';
    });
    document.getElementById(`admin-tab-${tab}`)?.classList.remove('hidden');
    document.getElementById(`tab-btn-${tab}`).className = `px-3 py-1.5 text-xs font-semibold rounded text-white transition ${tab === 'tenants' ? 'bg-purple-600' : 'bg-blue-600'}`;

    if (tab === 'tenants') loadTenantsManagement();
    if (tab === 'students') loadStudentTenantDropdowns();
    if (tab === 'students-list') loadStudentManagementTable();
    if (tab === 'admins-list') loadAdminManagementTable();
};

(async () => {
    currentAdminProfile = await checkAuth('admin');
    if (!currentAdminProfile) return;

    if (currentAdminProfile.role === 'super_admin') {
        document.getElementById('tab-btn-tenants')?.classList.remove('hidden');
        document.getElementById('course-tenant-assignment-container')?.classList.remove('hidden');
        document.querySelector('nav h1').textContent = `Griffin Consulting Training Institute — Super-Admin Ecosystem`;
        loadTenantSelectDropdowns();
    } else {
        document.querySelector('nav h1').textContent = `${currentAdminProfile.tenants?.name || 'Organization'} LMS — Admin Portal`;
    }
    loadDashboardStats();
    fetchAdminCourses();
    fetchComplianceReports();
    loadStudentTenantDropdowns();
    loadStudentManagementTable();
    loadAdminManagementTable();
})();

async function loadDashboardStats() {
    let q = supabase.from('courses').select('*', { count: 'exact', head: true }).eq('archived', false);
    if (currentAdminProfile.role === 'admin' && currentAdminProfile.tenant_id) q = q.eq('tenant_id', currentAdminProfile.tenant_id);
    const { count: cCount } = await q;
    const { count: sCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
    const { count: lCount } = await supabase.from('lessons').select('*', { count: 'exact', head: true });

    document.getElementById('stat-total-courses').textContent = cCount || 0;
    document.getElementById('stat-total-students').textContent = sCount || 0;
    document.getElementById('stat-total-modules').textContent = lCount || 0;
}

async function fetchAdminCourses() {
    const container = document.getElementById('admin-course-list');
    if (!container) return;
    let q = supabase.from('courses').select('*, tenants(name)').order('created_at', { ascending: false });
    if (currentAdminProfile.role === 'admin' && currentAdminProfile.tenant_id) q = q.eq('tenant_id', currentAdminProfile.tenant_id);
    const { data: courses } = await q;

    if (!courses || courses.length === 0) { container.innerHTML = `<p class="text-slate-400 text-sm italic">No courses created yet.</p>`; return; }
    const { data: allLessons } = await supabase.from('lessons').select('*');

    container.innerHTML = courses.map(course => {
        const lessons = allLessons ? allLessons.filter(l => l.course_id === course.id) : [];
        return `
            <div class="bg-slate-900 p-5 rounded-xl border ${course.archived ? 'border-red-900/50 opacity-75' : 'border-slate-700'} space-y-4">
                <div class="flex justify-between items-start flex-wrap gap-4">
                    <div class="flex gap-4 items-center">
                        ${course.thumbnail_url ? `<img src="${course.thumbnail_url}" class="w-16 h-16 rounded-lg object-cover border border-slate-700" alt="${course.title}">` : ''}
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-mono bg-slate-800 text-blue-400 px-2 py-0.5 rounded">${course.course_number || 'NO ID'}</span>
                                <h3 class="font-bold text-slate-100 text-base">${course.title} ${course.archived ? '<span class="text-xs text-red-400">(Archived)</span>' : ''}</h3>
                            </div>
                            <p class="text-xs text-slate-400 mt-1">${course.description || ''}</p>
                            <div class="flex gap-3 mt-2">
                                <span class="text-xs bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded">${course.ceu_credits || 0} CEUs</span>
                                <span class="text-xs bg-purple-600/20 text-purple-300 px-2 py-0.5 rounded">${course.tenants?.name || 'Global Course'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.editCourse(${course.id})" class="px-3 py-1 bg-blue-600/20 text-blue-300 hover:bg-blue-600 hover:text-white rounded text-xs transition">Edit</button>
                        <button onclick="window.toggleCourseArchive(${course.id}, ${!course.archived})" class="px-3 py-1 ${course.archived ? 'bg-emerald-600/20 text-emerald-400' : 'bg-amber-600/20 text-amber-400'} rounded text-xs">${course.archived ? 'Restore' : 'Archive'}</button>
                        <button onclick="window.toggleCourseAccordion(${course.id})" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs">Toggle Modules ↕</button>
                    </div>
                </div>
                <div id="course-modules-section-${course.id}" class="hidden border-t border-slate-800 pt-4 space-y-3">
                    <div class="flex justify-between items-center"><h4 class="text-xs font-semibold text-slate-300 uppercase">Modules</h4><span class="text-xs text-slate-400">${lessons.length} Modules</span></div>
                    <div class="space-y-2">
                        ${lessons.map(l => `<div class="flex justify-between items-center bg-slate-950 p-2.5 rounded border border-slate-800 text-xs">
                            <span class="text-slate-200">[${l.lesson_type.toUpperCase()}]${l.title}</span>
                            <button onclick="window.deleteLesson(${l.id})" class="text-red-400 hover:text-red-300">Remove</button>
                        </div>`).join('')}
                    </div>
                    <form onsubmit="window.handleAddLesson(event, ${course.id})" class="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 mt-2">
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <input type="text" placeholder="Lesson ID" required class="lesson-num-input px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100">
                            <input type="text" placeholder="Title" required class="lesson-title-input px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100">
                            <select class="lesson-type-select px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100"><option value="scorm">SCORM</option><option value="video">Video</option><option value="pdf">PDF</option></select>
                            <input type="file" required class="lesson-file-input text-xs text-slate-400 file:bg-blue-600 file:text-white file:rounded file:border-0 file:px-2 file:py-1">
                        </div>
                        <button type="submit" class="px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold">Attach Module</button>
                    </form>
                </div>
            </div>`;
    }).join('');
}

window.toggleCourseAccordion = (id) => document.getElementById(`course-modules-section-${id}`)?.classList.toggle('hidden');
window.toggleCourseArchive = async (id, state) => { await supabase.from('courses').update({ archived: state }).eq('id', id); loadDashboardStats(); fetchAdminCourses(); };
window.editCourse = async (id) => {
    const { data: c } = await supabase.from('courses').select('*').eq('id', id).single();
    if (!c) return;
    document.getElementById('course-id-field').value = c.id;
    document.getElementById('course-number').value = c.course_number || '';
    document.getElementById('course-title').value = c.title || '';
    document.getElementById('course-desc').value = c.description || '';
    document.getElementById('course-ceu').value = c.ceu_credits || 0;
    if (document.getElementById('course-tenant-id')) document.getElementById('course-tenant-id').value = c.tenant_id || '';
    document.getElementById('cancel-course-edit').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};
window.resetCourseForm = () => { document.getElementById('create-course-form').reset(); document.getElementById('course-id-field').value = ''; document.getElementById('cancel-course-edit').classList.add('hidden'); };
window.deleteLesson = async (id) => { await supabase.from('lessons').delete().eq('id', id); fetchAdminCourses(); };
window.handleAddLesson = async (e, courseId) => {
    e.preventDefault();
    const f = e.target;
    const file = f.querySelector('.lesson-file-input').files[0];
    const path = `lessons/${Date.now()}_${file.name}`;
    await supabase.storage.from('lms-content').upload(path, file);
    const { data } = supabase.storage.from('lms-content').getPublicUrl(path);
    await supabase.from('lessons').insert([{ course_id: courseId, lesson_number: f.querySelector('.lesson-num-input').value, title: f.querySelector('.lesson-title-input').value, lesson_type: f.querySelector('.lesson-type-select').value, content_url: data.publicUrl }]);
    fetchAdminCourses();
};

document.getElementById('create-course-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('course-id-field').value;
    const payload = { course_number: document.getElementById('course-number').value, title: document.getElementById('course-title').value, description: document.getElementById('course-desc').value, ceu_credits: parseFloat(document.getElementById('course-ceu').value) || 0 };
    if (currentAdminProfile.role === 'super_admin') payload.tenant_id = document.getElementById('course-tenant-id').value || null;
    else if (currentAdminProfile.tenant_id) payload.tenant_id = currentAdminProfile.tenant_id;

    if (editId) await supabase.from('courses').update(payload).eq('id', editId);
    else await supabase.from('courses').insert([payload]);
    window.resetCourseForm();
    loadDashboardStats();
    fetchAdminCourses();
});

async function loadTenantSelectDropdowns() {
    const { data: tenants } = await supabase.from('tenants').select('id, name, slug');
    [document.getElementById('admin-tenant-select'), document.getElementById('course-tenant-id')].forEach(sel => {
        if (sel) sel.innerHTML = `<option value="">-- Choose Tenant --</option>` + (tenants || []).map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    });
}

async function loadStudentTenantDropdowns() {
    const { data: tenants } = await supabase.from('tenants').select('id, name').eq('service_status', 'active');
    const container = document.getElementById('student-tenants-container');
    if (container) container.innerHTML = `<div class="flex gap-2 items-center student-tenant-row bg-slate-950 p-3 rounded border border-slate-800"><select required class="student-tenant-select w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100"><option value="">-- Select Org --</option>${(tenants || []).map(t => `<option value="${t.id}">${t.name}</option>`).join('')}</select></div>`;
}

window.loadStudentManagementTable = async () => {
    const tbody = document.getElementById('admin-students-tbody');
    if (!tbody) return;
    const { data: students } = await supabase.from('profiles').select('*').eq('role', 'student').order('created_at', { ascending: false });
    if (!students || students.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">No students found.</td></tr>`; return; }
    tbody.innerHTML = students.map(s => `<tr class="hover:bg-slate-900/50"><td class="p-3 font-semibold text-white">${s.first_name || ''} ${s.last_name || ''}</td><td class="p-3 font-mono text-blue-400">${s.unique_identifier || s.email}</td><td class="p-3">${s.status || 'active'}</td><td class="p-3 text-right"><button onclick="window.editStudent('${s.id}')" class="px-2 py-1 bg-blue-600/20 text-blue-300 rounded text-xs">Edit</button></td></tr>`).join('');
};

window.editStudent = async (userId) => {
    const { data: s } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!s) return;
    window.switchAdminTab('students');
    document.getElementById('edit-student-id').value = s.id;
    document.getElementById('prov-email').value = s.email || '';
    document.getElementById('prov-uid').value = s.unique_identifier || '';
    document.getElementById('prov-firstname').value = s.first_name || '';
    document.getElementById('prov-lastname').value = s.last_name || '';
    document.getElementById('prov-pass-container').classList.add('hidden');
    document.getElementById('cancel-student-edit').classList.remove('hidden');
};

document.getElementById('provision-student-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('edit-student-id').value;
    const payload = { email: document.getElementById('prov-email').value, unique_identifier: document.getElementById('prov-uid').value, first_name: document.getElementById('prov-firstname').value, last_name: document.getElementById('prov-lastname').value };
    if (editId) {
        await supabase.from('profiles').update(payload).eq('id', editId);
        alert('Student profile successfully updated!');
    } else {
        const { data: authData } = await supabase.auth.signUp({ email: payload.email, password: document.getElementById('prov-pass').value });
        if (authData?.user) await supabase.from('profiles').upsert([{ id: authData.user.id, ...payload, role: 'student', status: 'active' }]);
        alert('Student successfully provisioned!');
    }
    window.loadStudentManagementTable();
});

async function loadAdminManagementTable() {
    const tbody = document.getElementById('admin-admins-tbody');
    if (!tbody) return;
    const { data: admins } = await supabase.from('profiles').select('*, tenants(name)').in('role', ['admin', 'super_admin']);
    tbody.innerHTML = (admins || []).map(a => `<tr class="hover:bg-slate-900/50"><td class="p-3">${a.email}</td><td class="p-3">${a.tenants?.name || 'Ecosystem'}</td><td class="p-3">${a.role.toUpperCase()}</td></tr>`).join('');
}

async function fetchComplianceReports() {
    const tbody = document.getElementById('compliance-report-tbody');
    if (!tbody) return;
    const { data: comps } = await supabase.from('student_completions').select('completed_at, courses(title, ceu_credits), profiles(first_name, last_name, unique_identifier)');
    complianceRecords = comps || [];
    tbody.innerHTML = (comps || []).map(c => `<tr class="hover:bg-slate-900/50"><td class="p-3">${c.profiles?.first_name || ''} ${c.profiles?.last_name || ''}</td><td class="p-3">${c.courses?.title || ''}</td><td class="p-3">${c.courses?.ceu_credits || 0} CEUs</td><td class="p-3">${new Date(c.completed_at).toLocaleDateString()}</td></tr>`).join('');
}
