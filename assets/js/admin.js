import { checkAuth, supabase } from './app.js';

let complianceRecords = [];
let currentAdminProfile = null;

window.switchAdminTab = function(tabName) {
    document.getElementById('admin-tab-courses').classList.add('hidden');
    document.getElementById('admin-tab-students').classList.add('hidden');
    document.getElementById('admin-tab-reports').classList.add('hidden');
    const tenantTab = document.getElementById('admin-tab-tenants');
    if (tenantTab) tenantTab.classList.add('hidden');

    document.getElementById('tab-btn-courses').className = 'px-3 py-1.5 text-xs font-semibold rounded text-slate-300 hover:text-white transition';
    document.getElementById('tab-btn-students').className = 'px-3 py-1.5 text-xs font-semibold rounded text-slate-300 hover:text-white transition';
    document.getElementById('tab-btn-reports').className = 'px-3 py-1.5 text-xs font-semibold rounded text-slate-300 hover:text-white transition';
    const tenantBtn = document.getElementById('tab-btn-tenants');
    if (tenantBtn && !tenantBtn.classList.contains('hidden')) {
        tenantBtn.className = 'px-3 py-1.5 text-xs font-semibold rounded text-purple-300 hover:text-white transition bg-purple-600/20 border border-purple-500/30';
    }

    document.getElementById(`admin-tab-${tabName}`).classList.remove('hidden');
    
    if (tabName === 'tenants') {
        tenantBtn.className = 'px-3 py-1.5 text-xs font-semibold rounded bg-purple-600 text-white transition';
        loadTenantsManagement();
    } else {
        document.getElementById(`tab-btn-${tabName}`).className = 'px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white transition';
    }
};

(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = './index.html';
        return;
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*, tenants(*)')
        .eq('id', session.user.id)
        .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
        window.location.href = './index.html';
        return;
    }

    // Check if tenant service is paused or archived
    if (profile.tenants && profile.tenants.service_status && profile.tenants.service_status !== 'active') {
        alert(`Service has been paused, temporarily. Please Contact your IT Dept for further information:\n${profile.tenants.technical_contact_first_name || 'IT'} ${profile.tenants.technical_contact_last_name || 'Support'} (${profile.tenants.technical_contact_email || 'support@org.gov'})`);
        await supabase.auth.signOut();
        window.location.href = './index.html';
        return;
    }

    currentAdminProfile = profile;

    if (currentAdminProfile.role === 'super_admin') {
        const tenantBtn = document.getElementById('tab-btn-tenants');
        if (tenantBtn) tenantBtn.classList.remove('hidden');
        document.getElementById('course-tenant-assignment-container').classList.remove('hidden');
        document.querySelector('nav h1').textContent = `Platform Super-Admin Portal — Ecosystem Control`;
        loadTenantSelectDropdowns();
    } else {
        const tenantName = currentAdminProfile.tenants?.name || 'Organization';
        document.querySelector('nav h1').textContent = `${tenantName} LMS — Admin Portal`;
        loadStudentTenantDropdowns();
    }

    loadDashboardStats();
    fetchAdminCourses();
    fetchComplianceReports();
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
                        <button onclick="window.deleteCourse(${course.id})" class="px-3 py-1 bg-red-600/20 text-red-400 rounded text-xs">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
    }
}

// Create Course Handler
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

// --- TENANT MANAGEMENT & PROFILES ---
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

// Create Tenant Profile Handler
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

// Provision Student Handler with Multi-Org Support
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
    await supabase.from('profiles').upsert([{ id: userId, email, role: 'student', unique_identifier, first_name, last_name }]);

    // Insert all selected multi-org associations
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

// Provision Tenant Admin
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

    await supabase.from('profiles').upsert([{ id: authData.user.id, email, role: 'admin', tenant_id }]);
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
