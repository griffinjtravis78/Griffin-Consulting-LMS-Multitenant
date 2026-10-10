import { checkAuth, supabase } from './app.js';

let complianceRecords = [];
let currentAdminProfile = null;

// Tab Navigation
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
        loadTenantsList();
    } else {
        document.getElementById(`tab-btn-${tabName}`).className = 'px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white transition';
    }
};

// Verify admin authentication and check role privileges
(async () => {
    // Allows either 'admin' or 'super_admin' roles
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = './index.html';
        return;
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*, tenants(name, slug)')
        .eq('id', session.user.id)
        .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
        window.location.href = './index.html';
        return;
    }

    currentAdminProfile = profile;

    // If Super Admin, reveal Platform Tenants tab and configure header
    if (currentAdminProfile.role === 'super_admin') {
        const tenantBtn = document.getElementById('tab-btn-tenants');
        if (tenantBtn) tenantBtn.classList.remove('hidden');
        const navTitle = document.querySelector('nav h1');
        if (navTitle) navTitle.textContent = `Platform Super-Admin Portal — Ecosystem Control`;
    } else {
        const tenantName = currentAdminProfile.tenants?.name || 'Organization';
        const navTitle = document.querySelector('nav h1');
        if (navTitle) navTitle.textContent = `${tenantName} LMS — Admin Portal`;
    }

    loadDashboardStats();
    fetchAdminCourses();
    fetchComplianceReports();
})();

// Load Dashboard Metrics
async function loadDashboardStats() {
    try {
        const { count: courseCount } = await supabase.from('courses').select('*', { count: 'exact', head: true });
        const { count: studentCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
        const { count: lessonCount } = await supabase.from('lessons').select('*', { count: 'exact', head: true });

        document.getElementById('stat-total-courses').textContent = courseCount || 0;
        document.getElementById('stat-total-students').textContent = studentCount || 0;
        document.getElementById('stat-total-modules').textContent = lessonCount || 0;
    } catch (err) {
        console.error('Error loading dashboard stats:', err);
    }
}

// Fetch and Render Courses in Admin Portal
async function fetchAdminCourses() {
    const container = document.getElementById('admin-course-list');
    try {
        const { data: courses, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false });

        if (error) {
            container.innerHTML = `<p class="text-red-400 text-sm italic">Error loading courses: ${error.message}</p>`;
            return;
        }

        if (!courses || courses.length === 0) {
            container.innerHTML = `<p class="text-slate-400 text-sm italic">No courses created yet for this organization.</p>`;
            return;
        }

        const { data: allLessons } = await supabase.from('lessons').select('*');

        container.innerHTML = courses.map(course => {
            const courseLessons = allLessons ? allLessons.filter(l => l.course_id === course.id) : [];
            return `
                <div class="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-4">
                    <div class="flex justify-between items-start flex-wrap gap-4">
                        <div class="flex gap-4 items-center">
                            ${course.thumbnail_url ? `<img src="${course.thumbnail_url}" alt="${course.title}" class="w-16 h-16 rounded-lg object-cover border border-slate-700">` : ''}
                            <div>
                                <h3 class="font-bold text-slate-100 text-base">${course.title}</h3>
                                <p class="text-xs text-slate-400 mt-0.5">${course.description || 'No description provided.'}</p>
                                <div class="flex gap-3 mt-2">
                                    <span class="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">${course.ceu_credits || 0} CEU Credits</span>
                                    <span class="text-xs text-slate-400">${courseLessons.length} Lessons</span>
                                </div>
                            </div>
                        </div>
                        <button onclick="window.deleteCourse(${course.id})" class="px-3 py-1 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded text-xs font-semibold transition">Delete Course</button>
                    </div>

                    <div class="border-t border-slate-800 pt-3">
                        <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Published Lessons</h4>
                        <div class="space-y-2">
                            ${courseLessons.length > 0 ? courseLessons.map(l => `
                                <div class="flex justify-between items-center bg-slate-800 p-2.5 rounded-lg border border-slate-700 text-xs">
                                    <span class="text-slate-200">📄 [${l.lesson_type.toUpperCase()}]${l.title}</span>
                                    <div class="flex gap-3">
                                        <a href="${l.content_url}" target="_blank" class="text-blue-400 hover:underline">View Asset</a>
                                        <button onclick="window.deleteLesson(${l.id})" class="text-red-400 hover:underline">Remove</button>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-xs text-slate-500 italic">No lessons added to this course yet.</p>'}
                        </div>

                        <form onsubmit="window.handleUploadLesson(event, ${course.id})" class="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                            <input type="text" id="lesson-title-${course.id}" placeholder="Lesson Title" required class="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100">
                            <select id="lesson-type-${course.id}" onchange="window.toggleLessonInput(${course.id}, this.value)" class="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100">
                                <option value="scorm">SCORM / HTML5 (Netlify URL)</option>
                                <option value="video">Video (MP4 URL)</option>
                                <option value="pdf">PDF Document (File Upload)</option>
                            </select>
                            <div id="lesson-input-container-${course.id}">
                                <input type="text" id="lesson-url-${course.id}" placeholder="Paste Netlify URL (https://...)" required class="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100">
                            </div>
                            <button type="submit" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition">Add Module</button>
                        </form>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Exception in fetchAdminCourses:', err);
        container.innerHTML = `<p class="text-red-400 text-sm italic">Error: ${err.message}</p>`;
    }
}

window.toggleLessonInput = function(courseId, selectedType) {
    const container = document.getElementById(`lesson-input-container-${courseId}`);
    if (selectedType === 'pdf') {
        container.innerHTML = `<input type="file" id="lesson-file-${courseId}" accept=".pdf" required class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500">`;
    } else {
        container.innerHTML = `<input type="text" id="lesson-url-${courseId}" placeholder="Paste Netlify URL (https://...)" required class="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100">`;
    }
};

// Create Course Form Handler
document.getElementById('create-course-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('course-title').value;
    const description = document.getElementById('course-desc').value;
    const ceu_credits = parseFloat(document.getElementById('course-ceu').value) || 0;
    const thumbInput = document.getElementById('course-thumbnail');
    const thumbFile = thumbInput.files[0];

    let thumbnail_url = null;
    if (thumbFile) {
        const thumbPath = `thumbnails/${Date.now()}_${thumbFile.name}`;
        const { error: uploadErr } = await supabase.storage.from('lms-content').upload(thumbPath, thumbFile);
        if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('lms-content').getPublicUrl(thumbPath);
            thumbnail_url = urlData.publicUrl;
        }
    }

    const coursePayload = { 
        title, 
        description, 
        ceu_credits, 
        thumbnail_url
    };

    // If regular admin, attach tenant_id. Super admins can also attach tenant_id if desired or leave null.
    if (currentAdminProfile.role === 'admin' && currentAdminProfile.tenant_id) {
        coursePayload.tenant_id = currentAdminProfile.tenant_id;
    }

    const { error } = await supabase.from('courses').insert([coursePayload]);

    if (error) {
        alert('Error creating course: ' + error.message);
    } else {
        document.getElementById('create-course-form').reset();
        loadDashboardStats();
        fetchAdminCourses();
    }
});

window.deleteCourse = async function(courseId) {
    if (!confirm('Are you sure you want to delete this course and all its modules?')) return;
    const { error } = await supabase.from('courses').delete().eq('id', courseId);
    if (error) {
        alert('Error deleting course: ' + error.message);
    } else {
        loadDashboardStats();
        fetchAdminCourses();
    }
};

window.handleUploadLesson = async function(e, courseId) {
    e.preventDefault();
    const title = document.getElementById(`lesson-title-${courseId}`).value;
    const lesson_type = document.getElementById(`lesson-type-${courseId}`).value;
    let content_url = '';

    if (lesson_type === 'pdf') {
        const fileInput = document.getElementById(`lesson-file-${courseId}`);
        const file = fileInput.files[0];
        if (!file) {
            alert('Please select a PDF file to upload.');
            return;
        }

        const filePath = `lessons/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage.from('lms-content').upload(filePath, file);
        if (uploadErr) {
            alert('Error uploading file: ' + uploadErr.message);
            return;
        }

        const { data: urlData } = supabase.storage.from('lms-content').getPublicUrl(filePath);
        content_url = urlData.publicUrl;
    } else {
        const urlInput = document.getElementById(`lesson-url-${courseId}`);
        content_url = urlInput.value.trim();
        if (!content_url) {
            alert('Please provide a valid content URL.');
            return;
        }
    }

    const lessonPayload = {
        course_id: courseId,
        title: title,
        lesson_type: lesson_type,
        content_url: content_url
    };

    if (currentAdminProfile.role === 'admin' && currentAdminProfile.tenant_id) {
        lessonPayload.tenant_id = currentAdminProfile.tenant_id;
    }

    const { error: dbError } = await supabase.from('lessons').insert([lessonPayload]);

    if (dbError) {
        alert('Error saving lesson record: ' + dbError.message);
    } else {
        loadDashboardStats();
        fetchAdminCourses();
    }
};

window.deleteLesson = async function(lessonId) {
    if (!confirm('Remove this lesson module?')) return;
    const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
    if (error) {
        alert('Error removing lesson: ' + error.message);
    } else {
        loadDashboardStats();
        fetchAdminCourses();
    }
};

// --- STUDENT PROVISIONING LOGIC ---
window.addAgentRow = function() {
    const container = document.getElementById('agent-rows-container');
    const row = document.createElement('div');
    row.className = 'grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950 p-3 rounded-lg border border-slate-800 agent-row relative';
    row.innerHTML = `
        <div>
            <label class="block text-xs font-medium text-slate-400 mb-1">Agent ID</label>
            <input type="text" required class="agent-id-input w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100" placeholder="e.g., AG-88492">
        </div>
        <div class="flex gap-2 items-end">
            <div class="flex-grow">
                <label class="block text-xs font-medium text-slate-400 mb-1">Agent State</label>
                <input type="text" required class="agent-state-input w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100" placeholder="e.g., MO">
            </div>
            <button type="button" onclick="this.closest('.agent-row').remove()" class="px-3 py-2 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded text-xs transition">Remove</button>
        </div>
    `;
    container.appendChild(row);
};

window.addOrgRow = function() {
    const container = document.getElementById('org-rows-container');
    const row = document.createElement('div');
    row.className = 'bg-slate-950 p-4 rounded-lg border border-slate-800 org-row space-y-3 relative';
    row.innerHTML = `
        <div class="flex justify-between items-center">
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Additional Organization</span>
            <button type="button" onclick="this.closest('.org-row').remove()" class="px-2.5 py-1 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded text-xs transition">Remove Org</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label class="block text-xs font-medium text-slate-400 mb-1">Organization Name</label>
                <input type="text" required class="org-name-input w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100" placeholder="Agency Name">
            </div>
            <div>
                <label class="block text-xs font-medium text-slate-400 mb-1">Org Phone</label>
                <input type="text" required class="org-phone-input w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100" placeholder="555-987-6543">
            </div>
            <div>
                <label class="block text-xs font-medium text-slate-400 mb-1">Org Street Address</label>
                <input type="text" required class="org-street-input w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100">
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
                <label class="block text-xs font-medium text-slate-400 mb-1">Org Street 2</label>
                <input type="text" class="org-street2-input w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100" placeholder="Suite, Bldg">
            </div>
            <div>
                <label class="block text-xs font-medium text-slate-400 mb-1">City</label>
                <input type="text" required class="org-city-input w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100">
            </div>
            <div>
                <label class="block text-xs font-medium text-slate-400 mb-1">State</label>
                <input type="text" required class="org-state-input w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100" placeholder="MO">
            </div>
            <div>
                <label class="block text-xs font-medium text-slate-400 mb-1">Zip Code</label>
                <input type="text" required class="org-zip-input w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100">
            </div>
        </div>
    `;
    container.appendChild(row);
};

// Provision Student Form Handler
document.getElementById('provision-student-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const successBox = document.getElementById('student-success-msg');
    const errorBox = document.getElementById('student-error-msg');
    successBox.classList.add('hidden');
    errorBox.classList.add('hidden');

    const email = document.getElementById('prov-email').value;
    const password = document.getElementById('prov-pass').value;
    const unique_identifier = document.getElementById('prov-uid').value;
    const first_name = document.getElementById('prov-firstname').value;
    const last_name = document.getElementById('prov-lastname').value;
    const phone = document.getElementById('prov-phone').value;
    const street_address = document.getElementById('prov-street').value;
    const street_address_2 = document.getElementById('prov-street2').value;
    const city = document.getElementById('prov-city').value;
    const state = document.getElementById('prov-state').value;
    const zip = document.getElementById('prov-zip').value;

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) {
        errorBox.textContent = 'Auth Error: ' + authError.message;
        errorBox.classList.remove('hidden');
        return;
    }

    const userId = authData.user.id;
    const profilePayload = {
        id: userId, 
        email, 
        role: 'student', 
        unique_identifier, 
        first_name, 
        last_name, 
        phone, 
        street_address, 
        street_address_2, 
        city, 
        state, 
        zip
    };

    if (currentAdminProfile.tenant_id) {
        profilePayload.tenant_id = currentAdminProfile.tenant_id;
    }

    const { error: profileError } = await supabase.from('profiles').upsert([profilePayload]);

    if (profileError) {
        errorBox.textContent = 'Profile Error: ' + profileError.message;
        errorBox.classList.remove('hidden');
        return;
    }

    const agentRows = document.querySelectorAll('.agent-row');
    for (let row of agentRows) {
        const agent_id = row.querySelector('.agent-id-input').value;
        const agent_state = row.querySelector('.agent-state-input').value;
        const agentPayload = { user_id: userId, agent_id, agent_state };
        if (currentAdminProfile.tenant_id) agentPayload.tenant_id = currentAdminProfile.tenant_id;
        await supabase.from('student_agent_licenses').insert([agentPayload]);
    }

    const orgRows = document.querySelectorAll('.org-row');
    for (let row of orgRows) {
        const orgPayload = {
            user_id: userId,
            org_name: row.querySelector('.org-name-input').value,
            org_phone: row.querySelector('.org-phone-input').value,
            org_street: row.querySelector('.org-street-input').value,
            org_street_2: row.querySelector('.org-street2-input').value,
            org_city: row.querySelector('.org-city-input').value,
            org_state: row.querySelector('.org-state-input').value,
            org_zip: row.querySelector('.org-zip-input').value
        };
        if (currentAdminProfile.tenant_id) orgPayload.tenant_id = currentAdminProfile.tenant_id;
        await supabase.from('student_organizations').insert([orgPayload]);
    }

    successBox.textContent = `Student ${first_name} ${last_name} (ID: ${unique_identifier}) successfully provisioned!`;
    successBox.classList.remove('hidden');
    document.getElementById('provision-student-form').reset();
    loadDashboardStats();
    fetchComplianceReports();
});

// --- SUPER ADMIN TENANT MANAGEMENT LOGIC ---
async function loadTenantsList() {
    const tbody = document.getElementById('tenants-table-tbody');
    const select = document.getElementById('admin-tenant-select');

    try {
        const { data: tenants, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });

        if (error || !tenants || tenants.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-500 italic">No tenant organizations found.</td></tr>`;
            if (select) select.innerHTML = `<option value="">-- No Tenants Available --</option>`;
            return;
        }

        tbody.innerHTML = tenants.map(t => `
            <tr class="hover:bg-slate-950/50">
                <td class="p-3 font-semibold text-purple-300">${t.name}</td>
                <td class="p-3 font-mono text-slate-400">${t.slug}</td>
                <td class="p-3 font-mono text-[11px] text-slate-500">${t.id}</td>
                <td class="p-3 text-slate-400">${new Date(t.created_at).toLocaleDateString()}</td>
            </tr>
        `).join('');

        if (select) {
            select.innerHTML = `<option value="">-- Choose Tenant --</option>` + tenants.map(t => `<option value="${t.id}">${t.name} (${t.slug})</option>`).join('');
        }
    } catch (err) {
        console.error('Error loading tenants list:', err);
    }
}

// Create Tenant Organization Form Handler
document.getElementById('create-tenant-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const successBox = document.getElementById('tenant-success-msg');
    const errorBox = document.getElementById('tenant-error-msg');
    successBox.classList.add('hidden');
    errorBox.classList.add('hidden');

    const name = document.getElementById('tenant-name').value;
    const slug = document.getElementById('tenant-slug').value.trim().toLowerCase().replace(/\s+/g, '-');

    const { error } = await supabase.from('tenants').insert([{ name, slug }]);

    if (error) {
        errorBox.textContent = 'Error creating tenant: ' + error.message;
        errorBox.classList.remove('hidden');
    } else {
        successBox.textContent = `Organization "${name}" successfully created!`;
        successBox.classList.remove('hidden');
        document.getElementById('create-tenant-form').reset();
        loadTenantsList();
    }
});

// Provision Tenant Admin Form Handler
document.getElementById('provision-tenant-admin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const successBox = document.getElementById('admin-success-msg');
    const errorBox = document.getElementById('admin-error-msg');
    successBox.classList.add('hidden');
    errorBox.classList.add('hidden');

    const tenant_id = document.getElementById('admin-tenant-select').value;
    const email = document.getElementById('admin-prov-email').value;
    const password = document.getElementById('admin-prov-pass').value;

    if (!tenant_id) {
        errorBox.textContent = 'Please select a tenant organization.';
        errorBox.classList.remove('hidden');
        return;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) {
        errorBox.textContent = 'Auth Error: ' + authError.message;
        errorBox.classList.remove('hidden');
        return;
    }

    const userId = authData.user.id;

    const { error: profileError } = await supabase.from('profiles').upsert([{
        id: userId,
        email: email,
        role: 'admin',
        tenant_id: tenant_id,
        first_name: 'Tenant',
        last_name: 'Administrator'
    }]);

    if (profileError) {
        errorBox.textContent = 'Profile Mapping Error: ' + profileError.message;
        errorBox.classList.remove('hidden');
        return;
    }

    successBox.textContent = `Tenant Administrator for ${email} successfully provisioned!`;
    successBox.classList.remove('hidden');
    document.getElementById('provision-tenant-admin-form').reset();
});

async function fetchComplianceReports() {
    const tbody = document.getElementById('compliance-report-tbody');
    let query = supabase.from('student_completions').select('completed_at, courses(title, ceu_credits), profiles(first_name, last_name, unique_identifier)');
    
    // If regular admin, filter by tenant. Super admin sees all.
    if (currentAdminProfile.role === 'admin' && currentAdminProfile.tenant_id) {
        query = query.eq('tenant_id', currentAdminProfile.tenant_id);
    }

    const { data: completions, error } = await query.order('completed_at', { ascending: false });

    if (error || !completions || completions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">No course completions recorded yet.</td></tr>`;
        return;
    }

    complianceRecords = completions;

    tbody.innerHTML = completions.map(c => `
        <tr class="hover:bg-slate-900/50">
            <td class="p-3">${c.profiles?.first_name || 'N/A'}</td>
            <td class="p-3">${c.profiles?.last_name || 'N/A'}</td>
            <td class="p-3 font-mono text-blue-400">${c.profiles?.unique_identifier || 'N/A'}</td>
            <td class="p-3 font-semibold">${c.courses?.title || 'N/A'}</td>
            <td class="p-3">${c.courses?.ceu_credits || 0} CEUs</td>
            <td class="p-3 text-slate-400">${new Date(c.completed_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

window.exportComplianceCSV = function() {
    if (!complianceRecords || complianceRecords.length === 0) {
        alert('No compliance data available to export.');
        return;
    }

    let csv = 'Student First Name,Student Last Name,Unique Student ID,Course Completed,CEUs,Date Completed\n';
    complianceRecords.forEach(c => {
        csv += `"${c.profiles?.first_name || ''}","${c.profiles?.last_name || ''}","${c.profiles?.unique_identifier || ''}","${c.courses?.title || ''}","${c.courses?.ceu_credits || 0}","${new Date(c.completed_at).toLocaleDateString()}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `Compliance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    a.click();
};
