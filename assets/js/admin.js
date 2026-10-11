import { checkAuth, supabase } from './app.js';

let complianceRecords = [];
let currentAdminProfile = null;

// Expose global sign out handler for HTML onclick bindings
window.handleAdminSignOut = async function() {
    await supabase.auth.signOut();
    window.location.href = './index.html';
};

window.switchAdminTab = function(tabName) {
    ['courses', 'students', 'students-list', 'admins-list', 'reports', 'tenants'].forEach(t => {
        const el = document.getElementById(`admin-tab-${t}`);
        if (el) el.classList.add('hidden');
        const btn = document.getElementById(`tab-btn-${t}`);
        if (btn) btn.className = 'px-3 py-1.5 text-xs font-semibold rounded text-slate-300 hover:text-white transition';
    });

    const targetTab = document.getElementById(`admin-tab-${tabName}`);
    if (targetTab) targetTab.classList.remove('hidden');

    const targetBtn = document.getElementById(`tab-btn-${tabName}`);
    if (targetBtn) {
        targetBtn.className = tabName === 'tenants' 
            ? 'px-3 py-1.5 text-xs font-semibold rounded bg-purple-600 text-white transition' 
            : 'px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white transition';
    }

    if (tabName === 'tenants') loadTenantsManagement();
    if (tabName === 'students') loadStudentTenantDropdowns();
    if (tabName === 'students-list') loadStudentManagementTable();
    if (tabName === 'admins-list') loadAdminManagementTable();
};

(async () => {
    currentAdminProfile = await checkAuth();
    if (!currentAdminProfile || (currentAdminProfile.role !== 'admin' && currentAdminProfile.role !== 'super_admin')) {
        window.location.href = './index.html';
        return;
    }

    if (currentAdminProfile.role === 'super_admin') {
        const tenantBtn = document.getElementById('tab-btn-tenants');
        if (tenantBtn) tenantBtn.classList.remove('hidden');
        document.getElementById('course-tenant-assignment-container').classList.remove('hidden');
        document.querySelector('nav h1').textContent = `Platform Super-Admin Portal — Ecosystem Control`;
        loadTenantSelectDropdowns();
    } else {
        const tenantName = currentAdminProfile.tenants?.name || 'Organization';
        document.querySelector('nav h1').textContent = `${tenantName} LMS — Admin Portal`;
    }

    loadDashboardStats();
    fetchAdminCourses();
    fetchComplianceReports();
    loadStudentTenantDropdowns();
})();

async function loadDashboardStats() {
    try {
        let courseQuery = supabase.from('courses').select('*', { count: 'exact', head: true });
        if (currentAdminProfile.role === 'admin' && currentAdminProfile.tenant_id) {
            courseQuery = courseQuery.eq('tenant_id', currentAdminProfile.tenant_id);
        }
        const { count: courseCount } = await courseQuery;
        
        const { count: studentCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
        const { count: lessonCount } = await supabase.from('lessons').select('*', { count: 'exact', head: true });

        document.getElementById('stat-total-courses').textContent = courseCount || 0;
        document.getElementById('stat-total-students').textContent = studentCount || 0;
        document.getElementById('stat-total-modules').textContent = lessonCount || 0;
    } catch (err) {
        console.error('Error loading stats:', err);
    }
}

async function fetchAdminCourses() {
    const container = document.getElementById('admin-course-list');
    try {
        let query = supabase.from('courses').select('*, tenants(name)').order('created_at', { ascending: false });
        if (currentAdminProfile.role === 'admin' && currentAdminProfile.tenant_id) {
            query = query.eq('tenant_id', currentAdminProfile.tenant_id);
        }
        const { data: courses, error } = await query;

        if (error || !courses || courses.length === 0) {
            container.innerHTML = `<p class="text-slate-400 text-sm italic">No courses created yet.</p>`;
            return;
        }

        const { data: allLessons } = await supabase.from('lessons').select('*');

        container.innerHTML = courses.map(course => {
            const courseLessons = allLessons ? allLessons.filter(l => l.course_id === course.id) : [];
            return `
                <div class="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-4">
                    <div class="flex justify-between items-start flex-wrap gap-4">
                        <div class="flex gap-4 items-center">
                            ${course.thumbnail_url ? `<img src="${course.thumbnail_url}" class="w-16 h-16 rounded-lg object-cover border border-slate-700">` : ''}
                            <div>
                                <h3 class="font-bold text-slate-100 text-base">${course.title}</h3>
                                <p class="text-xs text-slate-400">${course.description || ''}</p>
                                <div class="flex gap-3 mt-2">
                                    <span class="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">${course.ceu_credits || 0} CEUs</span>
                                    <span class="text-xs bg-purple-600/20 text-purple-300 px-2 py-0.5 rounded">${course.tenants?.name || 'Global Course'}</span>
                                </div>
                            </div>
                        </div>
                        <button onclick="window.deleteCourse(${course.id})" class="px-3 py-1 bg-red-600/20 text-red-400 rounded text-xs">Delete Course</button>
                    </div>

                    <div class="border-t border-slate-800 pt-4 space-y-3">
                        <h4 class="text-xs font-semibold text-slate-300 uppercase tracking-wider">Course Modules & SCORM Packages</h4>
                        <div class="space-y-2">
                            ${courseLessons.length > 0 ? courseLessons.map(l => `
                                <div class="flex justify-between items-center bg-slate-950 p-2.5 rounded border border-slate-800 text-xs">
                                    <span class="text-slate-200">▶ [${l.lesson_type.toUpperCase()}]${l.title}</span>
                                    <button onclick="window.deleteLesson(${l.id})" class="text-red-400 hover:text-red-300">Remove</button>
                                </div>
                            `).join('') : '<p class="text-xs text-slate-500 italic">No modules added to this course yet.</p>'}
                        </div>

                        <form onsubmit="window.handleAddLesson(event, ${course.id})" class="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-3 mt-3">
                            <p class="text-xs font-bold text-blue-400">+ Add Lesson or SCORM Module</p>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input type="text" placeholder="Module Title" required class="lesson-title-input px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100">
                                <select required class="lesson-type-select px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100">
                                    <option value="scorm">SCORM / HTML5 Zip</option>
                                    <option value="video">Video (MP4)</option>
                                    <option value="pdf">PDF Document</option>
                                </select>
                                <input type="file" required class="lesson-file-input text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-blue-600 file:text-white">
                            </div>
                            <button type="submit" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition">Upload & Attach Module</button>
                        </form>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
    }
};

window.deleteCourse = async function(courseId) {
    if (!confirm('Are you sure you want to delete this course?')) return;
    const { error } = await supabase.from('courses').delete().eq('id', courseId);
    if (error) alert('Error: ' + error.message);
    else {
        loadDashboardStats();
        fetchAdminCourses();
    }
};

window.deleteLesson = async function(lessonId) {
    const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
    if (error) alert('Error: ' + error.message);
    else fetchAdminCourses();
};

window.handleAddLesson = async function(e, courseId) {
    e.preventDefault();
    const form = e.target;
    const title = form.querySelector('.lesson-title-input').value;
    const lesson_type = form.querySelector('.lesson-type-select').value;
    const file = form.querySelector('.lesson-file-input').files[0];

    if (!file) {
        alert('Please select a file to upload.');
        return;
    }

    const path = `lessons/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from('lms-content').upload(path, file);
    if (upErr) {
        alert('Upload Error: ' + upErr.message);
        return;
    }

    const { data } = supabase.storage.from('lms-content').getPublicUrl(path);
    const content_url = data.publicUrl;

    const { error: insErr } = await supabase.from('lessons').insert([{
        course_id: courseId,
        title,
        lesson_type,
        content_url
    }]);

    if (insErr) {
        alert('Database Error: ' + insErr.message);
    } else {
        loadDashboardStats();
        fetchAdminCourses();
    }
};

document.getElementById('create-course-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('course-title').value;
    const description = document.getElementById('course-desc').value;
    const ceu_credits = parseFloat(document.getElementById('course-ceu').value) || 0;
    const thumbFile = document.getElementById('course-thumbnail').files[0];

    let thumbnail_url = null;
    if (thumbFile) {
        const path = `thumbnails/${Date.now()}_${thumbFile.name}`;
        const { error: upErr } = await supabase.storage.from('lms-content').upload(path, thumbFile);
        if (!upErr) {
            const { data } = supabase.storage.from('lms-content').getPublicUrl(path);
            thumbnail_url = data.publicUrl;
        }
    }

    const payload = { title, description, ceu_credits, thumbnail_url };
    if (currentAdminProfile.role === 'super_admin') {
        const tSel = document.getElementById('course-tenant-id').value;
        if (tSel) payload.tenant_id = tSel;
    } else if (currentAdminProfile.tenant_id) {
        payload.tenant_id = currentAdminProfile.tenant_id;
    }

    const { error } = await supabase.from('courses').insert([payload]);
    if (error) {
        alert('Error: ' + error.message);
    } else {
        document.getElementById('create-course-form').reset();
        loadDashboardStats();
        fetchAdminCourses();
    }
});

async function loadTenantSelectDropdowns() {
    const { data: tenants } = await supabase.from('tenants').select('id, name, slug');
    const selects = [document.getElementById('admin-tenant-select'), document.getElementById('course-tenant-id')];
    selects.forEach(sel => {
        if (!sel) return;
        const defaultText = sel.id === 'course-tenant-id' ? '-- Global / All Tenants --' : '-- Choose Tenant --';
        sel.innerHTML = `<option value="">${defaultText}</option>` + (tenants || []).map(t => `<option value="${t.id}">${t.name} (${t.slug})</option>`).join('');
    });
}

async function loadStudentTenantDropdowns() {
    const { data: tenants } = await supabase.from('tenants').select('id, name').eq('service_status', 'active');
    const container = document.getElementById('student-tenants-container');
    if (container) {
        container.innerHTML = `
            <div class="flex gap-2 items-center student-tenant-row bg-slate-950 p-3 rounded-lg border border-slate-800">
                <select required class="student-tenant-select w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100">
                    <option value="">-- Select Organization --</option>
                    ${(tenants || []).map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                </select>
            </div>
        `;
    }
}

window.addStudentTenantRow = async function() {
    const { data: tenants } = await supabase.from('tenants').select('id, name').eq('service_status', 'active');
    const container = document.getElementById('student-tenants-container');
    const row = document.createElement('div');
    row.className = 'flex gap-2 items-center student-tenant-row bg-slate-950 p-3 rounded-lg border border-slate-800';
    row.innerHTML = `
        <select required class="student-tenant-select w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100">
            <option value="">-- Select Organization --</option>
            ${(tenants || []).map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
        </select>
        <button type="button" onclick="this.closest('.student-tenant-row').remove()" class="px-3 py-2 bg-red-600/20 text-red-400 rounded text-xs">Remove</button>
    `;
    container.appendChild(row);
};

document.getElementById('create-tenant-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('t-name').value;
    const slug = document.getElementById('t-slug').value.trim().toLowerCase().replace(/\s+/g, '-');
    const logoFile = document.getElementById('t-logo').files[0];

    let logo_url = null;
    if (logoFile) {
        const path = `logos/${Date.now()}_${logoFile.name}`;
        const { error: upErr } = await supabase.storage.from('lms-content').upload(path, logoFile);
        if (!upErr) {
            const { data } = supabase.storage.from('lms-content').getPublicUrl(path);
            logo_url = data.publicUrl;
        }
    }

    const payload = {
        name,
        slug,
        logo_url,
        street_address: document.getElementById('t-street').value,
        street_address_2: document.getElementById('t-street2').value,
        city: document.getElementById('t-city').value,
        state: document.getElementById('t-state').value,
        zip: document.getElementById('t-zip').value,
        phone: document.getElementById('t-phone').value,
        website: document.getElementById('t-website').value,
        training_contact_first_name: document.getElementById('t-train-first').value,
        training_contact_last_name: document.getElementById('t-train-last').value,
        training_contact_email: document.getElementById('t-train-email').value,
        training_contact_phone: document.getElementById('t-train-phone').value,
        technical_contact_first_name: document.getElementById('t-tech-first').value,
        technical_contact_last_name: document.getElementById('t-tech-last').value,
        technical_contact_email: document.getElementById('t-tech-email').value,
        technical_contact_phone: document.getElementById('t-tech-phone').value,
        issue_link: document.getElementById('t-issuelink').value,
        service_status: 'active'
    };

    const { error } = await supabase.from('tenants').insert([payload]);
    if (error) {
        alert('Error: ' + error.message);
    } else {
        alert('Tenant profile successfully created!');
        document.getElementById('create-tenant-form').reset();
        loadTenantsManagement();
    }
});

async function loadTenantsManagement() {
    const tbody = document.getElementById('tenants-table-tbody');
    const { data: tenants } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });

    if (!tenants || tenants.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-500 italic">No tenants found.</td></tr>`;
        return;
    }

    tbody.innerHTML = tenants.map(t => `
        <tr class="hover:bg-slate-950/50">
            <td class="p-3 font-semibold text-purple-300">${t.name}</td>
            <td class="p-3 font-mono text-slate-400">${t.slug}</td>
            <td class="p-3">
                <span class="px-2 py-0.5 rounded text-xs ${t.service_status === 'active' ? 'bg-emerald-600/20 text-emerald-400' : t.service_status === 'paused' ? 'bg-amber-600/20 text-amber-400' : 'bg-red-600/20 text-red-400'}">${t.service_status.toUpperCase()}</span>
            </td>
            <td class="p-3 flex gap-2">
                <button onclick="window.toggleTenantStatus('${t.id}', '${t.service_status === 'active' ? 'paused' : 'active'}')" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-xs rounded">${t.service_status === 'active' ? 'Pause' : 'Activate'}</button>
                <button onclick="window.toggleTenantStatus('${t.id}', 'archived')" class="px-2 py-1 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white text-xs rounded">Archive</button>
            </td>
        </tr>
    `).join('');

    loadTenantSelectDropdowns();
}

window.toggleTenantStatus = async function(tenantId, newStatus) {
    const { error } = await supabase.from('tenants').update({ service_status: newStatus }).eq('id', tenantId);
    if (error) alert('Error updating status: ' + error.message);
    else loadTenantsManagement();
};

window.loadStudentManagementTable = async function() {
    const tbody = document.getElementById('admin-students-tbody');
    const { data: students } = await supabase
        .from('profiles')
        .select('*, student_tenants(tenants(name)), tenants(name)')
        .eq('role', 'student')
        .order('created_at', { ascending: false });

    if (!students || students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">No students found.</td></tr>`;
        return;
    }

    tbody.innerHTML = students.map(s => {
        const orgNames = s.student_tenants?.map(st => st.tenants?.name).join(', ') || s.tenants?.name || 'Unassigned';
        const status = s.status || 'active';
        return `
            <tr class="hover:bg-slate-950/50">
                <td class="p-3 font-semibold text-white">${s.first_name || 'N/A'}</td>
                <td class="p-3 font-semibold text-white">${s.last_name || 'N/A'}</td>
                <td class="p-3 text-slate-300">${orgNames}</td>
                <td class="p-3 font-mono text-blue-400">${s.unique_identifier || s.email}</td>
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-xs ${status === 'active' ? 'bg-emerald-600/20 text-emerald-400' : status === 'suspended' ? 'bg-amber-600/20 text-amber-400' : 'bg-red-600/20 text-red-400'}">${status.toUpperCase()}</span>
                </td>
                <td class="p-3 text-right relative">
                    <div class="inline-block relative">
                        <button onclick="window.toggleActionMenu(event, '${s.id}')" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold">⋮</button>
                        <div id="menu-${s.id}" class="hidden absolute right-0 mt-2 w-36 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1 text-left">
                            <button onclick="window.updateProfileStatus('${s.id}', 'active')" class="w-full px-3 py-1.5 text-xs text-emerald-300 hover:bg-slate-700">Activate</button>
                            <button onclick="window.updateProfileStatus('${s.id}', 'suspended')" class="w-full px-3 py-1.5 text-xs text-amber-300 hover:bg-slate-700">Suspend</button>
                            <button onclick="window.updateProfileStatus('${s.id}', 'archived')" class="w-full px-3 py-1.5 text-xs text-red-400 hover:bg-slate-700">Archive</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

window.loadAdminManagementTable = async function() {
    const tbody = document.getElementById('admin-admins-tbody');
    const { data: admins } = await supabase
        .from('profiles')
        .select('*, tenants(name)')
        .in('role', ['admin', 'super_admin'])
        .order('created_at', { ascending: false });

    if (!admins || admins.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500 italic">No admins found.</td></tr>`;
        return;
    }

    tbody.innerHTML = admins.map(a => {
        const status = a.status || 'active';
        return `
            <tr class="hover:bg-slate-950/50">
                <td class="p-3">
                    <p class="font-semibold text-white">${a.first_name || ''} ${a.last_name || ''}</p>
                    <p class="text-xs text-slate-400 font-mono">${a.email}</p>
                </td>
                <td class="p-3 text-purple-300">${a.tenants?.name || 'Platform Ecosystem (Super Admin)'}</td>
                <td class="p-3 font-semibold text-blue-400">${a.role.toUpperCase()}</td>
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-xs ${status === 'active' ? 'bg-emerald-600/20 text-emerald-400' : status === 'suspended' ? 'bg-amber-600/20 text-amber-400' : 'bg-red-600/20 text-red-400'}">${status.toUpperCase()}</span>
                </td>
                <td class="p-3 text-right relative">
                    <div class="inline-block relative">
                        <button onclick="window.toggleActionMenu(event, '${a.id}')" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold">⋮</button>
                        <div id="menu-${a.id}" class="hidden absolute right-0 mt-2 w-36 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1 text-left">
                            <button onclick="window.updateProfileStatus('${a.id}', 'active')" class="w-full px-3 py-1.5 text-xs text-emerald-300 hover:bg-slate-700">Activate</button>
                            <button onclick="window.updateProfileStatus('${a.id}', 'suspended')" class="w-full px-3 py-1.5 text-xs text-amber-300 hover:bg-slate-700">Suspend</button>
                            <button onclick="window.updateProfileStatus('${a.id}', 'archived')" class="w-full px-3 py-1.5 text-xs text-red-400 hover:bg-slate-700">Archive</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

window.toggleActionMenu = function(e, id) {
    e.stopPropagation();
    document.querySelectorAll('[id^="menu-"]').forEach(m => {
        if (m.id !== `menu-${id}`) m.classList.add('hidden');
    });
    const menu = document.getElementById(`menu-${id}`);
    if (menu) menu.classList.toggle('hidden');
};

window.addEventListener('click', () => {
    document.querySelectorAll('[id^="menu-"]').forEach(m => m.classList.add('hidden'));
});

window.updateProfileStatus = async function(userId, newStatus) {
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', userId);
    if (error) {
        alert('Error updating status: ' + error.message);
    } else {
        alert(`User status successfully updated to ${newStatus.toUpperCase()}`);
        loadStudentManagementTable();
        loadAdminManagementTable();
    }
};

document.getElementById('provision-student-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('prov-email').value;
    const password = document.getElementById('prov-pass').value;
    const unique_identifier = document.getElementById('prov-uid').value;
    const first_name = document.getElementById('prov-firstname').value;
    const last_name = document.getElementById('prov-lastname').value;

    const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
    if (authErr) {
        alert('Auth Error: ' + authErr.message);
        return;
    }

    const userId = authData.user.id;
    await supabase.from('profiles').upsert([{ id: userId, email, role: 'student', unique_identifier, first_name, last_name, status: 'active' }]);

    const tenantSelects = document.querySelectorAll('.student-tenant-select');
    for (let sel of tenantSelects) {
        if (sel.value) {
            await supabase.from('student_tenants').insert([{ user_id: userId, tenant_id: sel.value }]);
        }
    }

    alert('Student successfully provisioned with multi-organization access!');
    document.getElementById('provision-student-form').reset();
    loadDashboardStats();
});

document.getElementById('provision-tenant-admin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tenant_id = document.getElementById('admin-tenant-select').value;
    const email = document.getElementById('admin-prov-email').value;
    const password = document.getElementById('admin-prov-pass').value;

    const { data: authData, error } = await supabase.auth.signUp({ email, password });
    if (error) {
        alert('Error: ' + error.message);
        return;
    }

    await supabase.from('profiles').upsert([{ id: authData.user.id, email, role: 'admin', tenant_id, status: 'active' }]);
    alert('Tenant Admin successfully provisioned!');
    document.getElementById('provision-tenant-admin-form').reset();
});

async function fetchComplianceReports() {
    const tbody = document.getElementById('compliance-report-tbody');
    const { data: completions } = await supabase.from('student_completions').select('completed_at, courses(title, ceu_credits), profiles(first_name, last_name, unique_identifier)');
    if (!completions || completions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">No completions recorded.</td></tr>`;
        return;
    }
    complianceRecords = completions;
    tbody.innerHTML = completions.map(c => `
        <tr class="hover:bg-slate-900/50">
            <td class="p-3">${c.profiles?.first_name || ''}</td>
            <td class="p-3">${c.profiles?.last_name || ''}</td>
            <td class="p-3 font-mono text-blue-400">${c.profiles?.unique_identifier || ''}</td>
            <td class="p-3">${c.courses?.title || ''}</td>
            <td class="p-3">${c.courses?.ceu_credits || 0} CEUs</td>
            <td class="p-3 text-slate-400">${new Date(c.completed_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

window.exportComplianceCSV = function() {
    if (!complianceRecords || complianceRecords.length === 0) {
        alert('No data to export.');
        return;
    }
    let csv = 'First Name,Last Name,Student ID,Course Completed,CEUs,Date Completed\n';
    complianceRecords.forEach(c => {
        csv += `"${c.profiles?.first_name || ''}","${c.profiles?.last_name || ''}","${c.profiles?.unique_identifier || ''}","${c.courses?.title || ''}","${c.courses?.ceu_credits || 0}","${c.completed_at}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `Compliance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    a.click();
};
