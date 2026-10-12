import { checkAuth, supabase } from './app.js';

let complianceRecords = [];
let currentAdminProfile = null;

window.handleAdminSignOut = async function() {
    await supabase.auth.signOut();
    window.location.href = './index.html';
};

window.switchAdminTab = function(tabName) {
    ['courses', 'students', 'students-list', 'admins-list', 'reports', 'tenants'].forEach(t => {
        const el = document.getElementById(`admin-tab-${t}`);
        if (el) el.classList.add('hidden');
        const btn = document.getElementById(`tab-btn-${t}`);
        if (btn) {
            btn.classList.remove('bg-blue-600', 'bg-purple-600', 'text-white');
            btn.classList.add('text-slate-300', 'hover:text-white');
        }
    });

    const targetTab = document.getElementById(`admin-tab-${tabName}`);
    if (targetTab) targetTab.classList.remove('hidden');

    const targetBtn = document.getElementById(`tab-btn-${tabName}`);
    if (targetBtn) {
        targetBtn.classList.remove('text-slate-300', 'hover:text-white', 'bg-blue-600', 'bg-purple-600');
        targetBtn.classList.add('text-white', tabName === 'tenants' ? 'bg-purple-600' : 'bg-blue-600');
    }

    if (tabName === 'tenants') loadTenantsManagement();
    if (tabName === 'students') loadStudentTenantDropdowns();
    if (tabName === 'students-list') loadStudentManagementTable();
    if (tabName === 'admins-list') loadAdminManagementTable();
};

(async () => {
    try {
        currentAdminProfile = await checkAuth('admin');
        if (!currentAdminProfile) return;

        const headerTitle = document.getElementById('admin-portal-header');
        const logoImg = document.getElementById('admin-tenant-logo');
        const tenantBtn = document.getElementById('tab-btn-tenants');

        if (currentAdminProfile.role === 'super_admin') {
            if (tenantBtn) tenantBtn.classList.remove('hidden');
            const courseTenantContainer = document.getElementById('course-tenant-assignment-container');
            if (courseTenantContainer) courseTenantContainer.classList.remove('hidden');
            
            if (headerTitle) headerTitle.textContent = `Griffin Consulting Training Institute — Super-Admin Ecosystem`;
            loadTenantSelectDropdowns();
        } else {
            const tenantName = currentAdminProfile.tenants?.name || 'Organization';
            if (headerTitle) headerTitle.textContent = `${tenantName} — Tenant Admin Portal`;
            // Strictly hide platform tenants tab for regular tenant admins
            if (tenantBtn) tenantBtn.classList.add('hidden');
        }

        if (logoImg && currentAdminProfile.tenants?.logo_url) {
            logoImg.src = currentAdminProfile.tenants.logo_url;
            logoImg.classList.remove('hidden');
        }

        loadDashboardStats();
        fetchAdminCourses();
        fetchComplianceReports();
        loadStudentTenantDropdowns();
        loadStudentManagementTable();
        loadAdminManagementTable();
    } catch (err) {
        console.error('Admin initialization error:', err);
    }
})();

async function loadDashboardStats() {
    try {
        let courseQuery = supabase.from('courses').select('*', { count: 'exact', head: true }).eq('archived', false);
        if (currentAdminProfile.role === 'admin' && currentAdminProfile.tenant_id) {
            courseQuery = courseQuery.eq('tenant_id', currentAdminProfile.tenant_id);
        }
        const { count: courseCount } = await courseQuery;
        
        const { count: studentCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
        const { count: lessonCount } = await supabase.from('lessons').select('*', { count: 'exact', head: true });

        const statCourses = document.getElementById('stat-total-courses');
        const statStudents = document.getElementById('stat-total-students');
        const statModules = document.getElementById('stat-total-modules');

        if (statCourses) statCourses.textContent = courseCount || 0;
        if (statStudents) statStudents.textContent = studentCount || 0;
        if (statModules) statModules.textContent = lessonCount || 0;
    } catch (err) {
        console.error('Error loading stats:', err);
    }
}

async function fetchAdminCourses() {
    const container = document.getElementById('admin-course-list');
    if (!container) return;
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
            const isArchived = course.archived;
            return `
                <div class="bg-slate-900 p-5 rounded-xl border ${isArchived ? 'border-red-900/50 opacity-75' : 'border-slate-700'} space-y-4">
                    <div class="flex justify-between items-start flex-wrap gap-4">
                        <div class="flex gap-4 items-center">
                            ${course.thumbnail_url ? `<img src="${course.thumbnail_url}" class="w-16 h-16 rounded-lg object-cover border border-slate-700" alt="${course.title}">` : ''}
                            <div>
                                <div class="flex items-center gap-2">
                                    <span class="text-xs font-mono bg-slate-800 text-blue-400 px-2 py-0.5 rounded">${course.course_number || 'NO ID'}</span>
                                    <h3 class="font-bold text-slate-100 text-base">${course.title} ${isArchived ? '<span class="text-xs text-red-400 font-normal">(Archived)</span>' : ''}</h3>
                                </div>
                                <p class="text-xs text-slate-400 mt-1">${course.description || ''}</p>
                                <div class="flex gap-3 mt-2 flex-wrap">
                                    <span class="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">${course.ceu_credits || 0} CEUs</span>
                                    <span class="text-xs bg-purple-600/20 text-purple-300 px-2 py-0.5 rounded">${course.tenants?.name || 'Global Course'}</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex gap-2 flex-wrap">
                            <button onclick="window.editCourse(${course.id})" class="px-3 py-1 bg-blue-600/20 text-blue-300 hover:bg-blue-600 hover:text-white rounded text-xs transition">Edit Course</button>
                            <button onclick="window.toggleCourseArchive(${course.id}, ${!isArchived})" class="px-3 py-1 ${isArchived ? 'bg-emerald-600/20 text-emerald-400' : 'bg-amber-600/20 text-amber-400'} rounded text-xs transition">${isArchived ? 'Restore' : 'Archive'}</button>
                            <button onclick="window.toggleCourseAccordion(${course.id})" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs">Toggle Modules ↕</button>
                        </div>
                    </div>

                    <div id="course-modules-section-${course.id}" class="hidden border-t border-slate-800 pt-4 space-y-3">
                        <div class="flex justify-between items-center">
                            <h4 class="text-xs font-semibold text-slate-300 uppercase tracking-wider">Course Modules & SCORM Packages</h4>
                            <span class="text-xs text-slate-400">${courseLessons.length} Modules</span>
                        </div>
                        <div class="space-y-2">
                            ${courseLessons.length > 0 ? courseLessons.map(l => `
                                <div class="flex justify-between items-center bg-slate-950 p-2.5 rounded border border-slate-800 text-xs">
                                    <div class="flex items-center gap-2">
                                        <span class="font-mono text-blue-400">[${l.lesson_number || 'MOD'}]</span>
                                        <span class="text-slate-200">[${l.lesson_type.toUpperCase()}]${l.title}</span>
                                    </div>
                                    <div class="flex gap-2">
                                        <button onclick="window.editLesson(${l.id})" class="text-blue-400 hover:text-blue-300">Edit</button>
                                        <button onclick="window.deleteLesson(${l.id})" class="text-red-400 hover:text-red-300">Remove</button>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-xs text-slate-500 italic">No modules added to this course yet.</p>'}
                        </div>

                        <form onsubmit="window.handleAddLesson(event, ${course.id})" class="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-3 mt-3">
                            <p class="text-xs font-bold text-blue-400">+ Add Lesson, Video or SCORM Module</p>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input type="text" placeholder="Lesson ID (e.g. L-101)" required class="lesson-num-input px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100 font-mono">
                                <input type="text" placeholder="Module Title" required class="lesson-title-input px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100">
                                <select required class="lesson-type-select px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100">
                                    <option value="scorm">SCORM / HTML5 Package</option>
                                    <option value="video">Video (MP4 / Stream)</option>
                                    <option value="pdf">PDF Document</option>
                                </select>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <input type="file" class="lesson-file-input text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-blue-600 file:text-white">
                                <input type="url" placeholder="Or paste External Content URL (https://...)" class="lesson-url-input px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100">
                            </div>
                            <button type="submit" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition">Save & Attach Module</button>
                        </form>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Exception in fetchAdminCourses:', err);
    }
};

window.toggleCourseAccordion = function(courseId) {
    const sec = document.getElementById(`course-modules-section-${courseId}`);
    if (sec) sec.classList.toggle('hidden');
};

window.toggleCourseArchive = async function(courseId, archiveState) {
    const { error } = await supabase.from('courses').update({ archived: archiveState }).eq('id', courseId);
    if (error) alert('Error: ' + error.message);
    else {
        loadDashboardStats();
        fetchAdminCourses();
    }
};

window.editCourse = async function(courseId) {
    const { data: c, error } = await supabase.from('courses').select('*').eq('id', courseId).single();
    if (error || !c) return;

    document.getElementById('course-id-field').value = c.id;
    if (document.getElementById('course-number')) document.getElementById('course-number').value = c.course_number || '';
    document.getElementById('course-title').value = c.title || '';
    document.getElementById('course-desc').value = c.description || '';
    document.getElementById('course-ceu').value = c.ceu_credits || 0;
    if (document.getElementById('course-tenant-id')) {
        document.getElementById('course-tenant-id').value = c.tenant_id || '';
    }

    if (document.getElementById('course-form-heading')) document.getElementById('course-form-heading').textContent = `Edit Course: ${c.title}`;
    if (document.getElementById('course-submit-btn')) document.getElementById('course-submit-btn').textContent = 'Update Course';
    if (document.getElementById('cancel-course-edit')) document.getElementById('cancel-course-edit').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.resetCourseForm = function() {
    document.getElementById('create-course-form').reset();
    document.getElementById('course-id-field').value = '';
    if (document.getElementById('course-form-heading')) document.getElementById('course-form-heading').textContent = 'Create New Course';
    if (document.getElementById('course-submit-btn')) document.getElementById('course-submit-btn').textContent = 'Create Course';
    if (document.getElementById('cancel-course-edit')) document.getElementById('cancel-course-edit').classList.add('hidden');
};

window.editLesson = async function(lessonId) {
    const { data: l, error } = await supabase.from('lessons').select('*').eq('id', lessonId).single();
    if (error || !l) return;

    const newTitle = prompt('Edit Lesson Title:', l.title);
    if (newTitle === null) return;
    const newNum = prompt('Edit Lesson ID / Number:', l.lesson_number || '');
    if (newNum === null) return;

    const { error: upErr } = await supabase.from('lessons').update({ title: newTitle, lesson_number: newNum }).eq('id', lessonId);
    if (upErr) {
        alert('Error updating lesson: ' + upErr.message);
    } else {
        loadDashboardStats();
        fetchAdminCourses();
    }
};

window.deleteLesson = async function(lessonId) {
    const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
    if (error) alert('Error: ' + error.message);
    else {
        loadDashboardStats();
        fetchAdminCourses();
    }
};

window.handleAddLesson = async function(e, courseId) {
    e.preventDefault();
    const form = e.target;
    const lesson_number = form.querySelector('.lesson-num-input').value;
    const title = form.querySelector('.lesson-title-input').value;
    const lesson_type = form.querySelector('.lesson-type-select').value;
    const file = form.querySelector('.lesson-file-input').files[0];
    const externalUrl = form.querySelector('.lesson-url-input').value.trim();

    let content_url = externalUrl;

    if (!content_url && !file) {
        alert('Please either upload a file or provide an external content URL.');
        return;
    }

    if (file) {
        const path = `lessons/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from('lms-content').upload(path, file);
        if (upErr) {
            alert('Upload Error: ' + upErr.message);
            return;
        }

        const { data } = supabase.storage.from('lms-content').getPublicUrl(path);
        content_url = data.publicUrl;
    }

    const { error: insErr } = await supabase.from('lessons').insert([{
        course_id: courseId,
        lesson_number,
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

document.getElementById('create-course-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('course-id-field').value;
    const course_number = document.getElementById('course-number') ? document.getElementById('course-number').value : null;
    const title = document.getElementById('course-title').value;
    const description = document.getElementById('course-desc').value;
    const ceu_credits = parseFloat(document.getElementById('course-ceu').value) || 0;
    const thumbFile = document.getElementById('course-thumbnail').files[0];

    let thumbnail_url = undefined;
    if (thumbFile) {
        const path = `thumbnails/${Date.now()}_${thumbFile.name}`;
        const { error: upErr } = await supabase.storage.from('lms-content').upload(path, thumbFile);
        if (!upErr) {
            const { data } = supabase.storage.from('lms-content').getPublicUrl(path);
            thumbnail_url = data.publicUrl;
        }
    }

    const payload = { course_number, title, description, ceu_credits };
    if (thumbnail_url !== undefined) payload.thumbnail_url = thumbnail_url;

    if (currentAdminProfile.role === 'super_admin') {
        const tSel = document.getElementById('course-tenant-id').value;
        payload.tenant_id = tSel || null;
    } else if (currentAdminProfile.tenant_id) {
        payload.tenant_id = currentAdminProfile.tenant_id;
    }

    let error;
    if (editId) {
        const res = await supabase.from('courses').update(payload).eq('id', editId);
        error = res.error;
    } else {
        const res = await supabase.from('courses').insert([payload]);
        error = res.error;
    }

    if (error) {
        alert('Error: ' + error.message);
    } else {
        alert(editId ? 'Course successfully updated!' : 'Course successfully created!');
        window.resetCourseForm();
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

// --- TENANT CREATE / EDIT HANDLERS ---
document.getElementById('create-tenant-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('edit-tenant-id').value;
    const name = document.getElementById('t-name').value;
    const slug = document.getElementById('t-slug').value.trim().toLowerCase().replace(/\s+/g, '-');
    const logoFile = document.getElementById('t-logo').files[0];

    let logo_url = undefined;
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
        issue_link: document.getElementById('t-issuelink').value
    };
    if (logo_url) payload.logo_url = logo_url;

    let error;
    if (editId) {
        const res = await supabase.from('tenants').update(payload).eq('id', editId);
        error = res.error;
    } else {
        payload.service_status = 'active';
        const res = await supabase.from('tenants').insert([payload]);
        error = res.error;
    }

    if (error) {
        alert('Error: ' + error.message);
    } else {
        alert(editId ? 'Tenant successfully updated!' : 'Tenant profile successfully created!');
        window.resetTenantForm();
        loadTenantsManagement();
    }
});

window.resetTenantForm = function() {
    document.getElementById('create-tenant-form').reset();
    document.getElementById('edit-tenant-id').value = '';
    document.getElementById('tenant-form-heading').textContent = 'Create Full Tenant Profile';
    document.getElementById('tenant-submit-btn').textContent = 'Save Organization Profile';
    document.getElementById('cancel-tenant-edit').classList.add('hidden');
};

window.editTenant = async function(tenantId) {
    const { data: t, error } = await supabase.from('tenants').select('*').eq('id', tenantId).single();
    if (error || !t) return;

    document.getElementById('edit-tenant-id').value = t.id;
    document.getElementById('t-name').value = t.name || '';
    document.getElementById('t-slug').value = t.slug || '';
    document.getElementById('t-street').value = t.street_address || '';
    document.getElementById('t-street2').value = t.street_address_2 || '';
    document.getElementById('t-city').value = t.city || '';
    document.getElementById('t-state').value = t.state || '';
    document.getElementById('t-zip').value = t.zip || '';
    document.getElementById('t-phone').value = t.phone || '';
    document.getElementById('t-website').value = t.website || '';
    document.getElementById('t-train-first').value = t.training_contact_first_name || '';
    document.getElementById('t-train-last').value = t.training_contact_last_name || '';
    document.getElementById('t-train-email').value = t.training_contact_email || '';
    document.getElementById('t-train-phone').value = t.training_contact_phone || '';
    document.getElementById('t-tech-first').value = t.technical_contact_first_name || '';
    document.getElementById('t-tech-last').value = t.technical_contact_last_name || '';
    document.getElementById('t-tech-email').value = t.technical_contact_email || '';
    document.getElementById('t-tech-phone').value = t.technical_contact_phone || '';
    document.getElementById('t-issuelink').value = t.issue_link || '';

    document.getElementById('tenant-form-heading').textContent = `Edit Tenant: ${t.name}`;
    document.getElementById('tenant-submit-btn').textContent = 'Update Organization Profile';
    document.getElementById('cancel-tenant-edit').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

async function loadTenantsManagement() {
    const tbody = document.getElementById('tenants-table-tbody');
    if (!tbody) return;
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
            <td class="p-3 text-right relative">
                <div class="inline-block relative">
                    <button onclick="window.toggleActionMenu(event, '${t.id}')" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold">⋮</button>
                    <div id="menu-${t.id}" class="hidden absolute right-0 mt-2 w-36 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1 text-left">
                        <button onclick="window.editTenant('${t.id}')" class="w-full px-3 py-1.5 text-xs text-blue-300 hover:bg-slate-700">Edit Profile</button>
                        <button onclick="window.toggleTenantStatus('${t.id}', '${t.service_status === 'active' ? 'paused' : 'active'}')" class="w-full px-3 py-1.5 text-xs text-amber-300 hover:bg-slate-700">${t.service_status === 'active' ? 'Pause' : 'Activate'}</button>
                        <button onclick="window.toggleTenantStatus('${t.id}', 'archived')" class="w-full px-3 py-1.5 text-xs text-red-400 hover:bg-slate-700">Archive</button>
                    </div>
                </div>
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
    if (!tbody) return;
    
    const { data: students, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false });

    if (error || !students || students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">No students found.</td></tr>`;
        return;
    }

    const { data: allStudentTenants } = await supabase.from('student_tenants').select('user_id, tenant_id, tenants(name)');

    // Scope students for regular tenant admins
    let filteredStudents = students;
    if (currentAdminProfile.role === 'admin' && currentAdminProfile.tenant_id) {
        const tenantStudentIds = (allStudentTenants || [])
            .filter(st => st.tenant_id === currentAdminProfile.tenant_id)
            .map(st => st.user_id);
        filteredStudents = students.filter(s => tenantStudentIds.includes(s.id));
    }

    if (filteredStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">No students found for this organization.</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredStudents.map(s => {
        const studentOrgs = allStudentTenants ? allStudentTenants.filter(st => st.user_id === s.id).map(st => st.tenants?.name).filter(Boolean) : [];
        const orgNames = studentOrgs.length > 0 ? studentOrgs.join(', ') : 'Unassigned';
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
                            <button onclick="window.editStudent('${s.id}')" class="w-full px-3 py-1.5 text-xs text-blue-300 hover:bg-slate-700">Edit Profile</button>
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

window.editStudent = async function(userId) {
    const { data: s, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error || !s) return;

    window.switchAdminTab('students');
    document.getElementById('edit-student-id').value = s.id;
    document.getElementById('prov-email').value = s.email || '';
    document.getElementById('prov-uid').value = s.unique_identifier || '';
    document.getElementById('prov-firstname').value = s.first_name || '';
    document.getElementById('prov-lastname').value = s.last_name || '';
    
    document.getElementById('prov-pass').removeAttribute('required');
    document.getElementById('prov-pass-container').classList.add('hidden');

    document.getElementById('provision-student-heading').textContent = `Edit Student: ${s.first_name || ''} ${s.last_name || ''}`;
    document.getElementById('student-submit-btn').textContent = 'Update Student Participant';
    document.getElementById('cancel-student-edit').classList.remove('hidden');

    const { data: stData } = await supabase.from('student_tenants').select('tenant_id').eq('user_id', userId);
    const container = document.getElementById('student-tenants-container');
    container.innerHTML = '';
    
    if (stData && stData.length > 0) {
        for (let st of stData) {
            await window.addStudentTenantRow();
            const rows = container.querySelectorAll('.student-tenant-row');
            const lastRow = rows[rows.length - 1];
            if (lastRow) lastRow.querySelector('select').value = st.tenant_id;
        }
    } else {
        await window.addStudentTenantRow();
    }
};

window.resetStudentForm = function() {
    document.getElementById('provision-student-form').reset();
    document.getElementById('edit-student-id').value = '';
    document.getElementById('prov-pass').setAttribute('required', 'true');
    document.getElementById('prov-pass-container').classList.remove('hidden');
    document.getElementById('provision-student-heading').textContent = 'Provision New Student Participant';
    document.getElementById('student-submit-btn').textContent = 'Provision Student Participant';
    document.getElementById('cancel-student-edit').classList.add('hidden');
    loadStudentTenantDropdowns();
};

document.getElementById('provision-student-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('edit-student-id').value;
    const email = document.getElementById('prov-email').value;
    const unique_identifier = document.getElementById('prov-uid').value;
    const first_name = document.getElementById('prov-firstname').value;
    const last_name = document.getElementById('prov-lastname').value;

    if (editId) {
        await supabase.from('profiles').update({ email, unique_identifier, first_name, last_name }).eq('id', editId);
        await supabase.from('student_tenants').delete().eq('user_id', editId);
        const tenantSelects = document.querySelectorAll('.student-tenant-select');
        for (let sel of tenantSelects) {
            if (sel.value) {
                await supabase.from('student_tenants').insert([{ user_id: editId, tenant_id: sel.value }]);
            }
        }
        alert('Student successfully updated!');
    } else {
        const password = document.getElementById('prov-pass').value;
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
        alert('Student successfully provisioned!');
    }

    window.resetStudentForm();
    loadDashboardStats();
    loadStudentManagementTable();
});

window.loadAdminManagementTable = async function() {
    const tbody = document.getElementById('admin-admins-tbody');
    if (!tbody) return;

    let adminQuery = supabase
        .from('profiles')
        .select('*, tenants(name)')
        .in('role', ['admin', 'super_admin'])
        .order('created_at', { ascending: false });

    // Scope admins for regular tenant admins
    if (currentAdminProfile.role === 'admin' && currentAdminProfile.tenant_id) {
        adminQuery = adminQuery.eq('tenant_id', currentAdminProfile.tenant_id);
    }

    const { data: admins } = await adminQuery;

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
    loadAdminManagementTable();
});

async function fetchComplianceReports() {
    const tbody = document.getElementById('compliance-report-tbody');
    if (!tbody) return;
    const { data: completions } = await supabase.from('student_completions').select('completed_at, courses(title, ceu_credits), profiles(first_name, last_name, unique_identifier)');
    if (!completions || completions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">No completions recorded.</td></tr>`;
        return;
    }
    complianceRecords = completions;
    tbody.innerHTML = completions.map(c => `
        <tr class="hover:bg-slate-900/50">
            <td class="p-3">${c.profiles?.first_name || ''} ${c.profiles?.last_name || ''}</td>
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
