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
        const courseTenantContainer = document.getElementById('course-tenant-assignment-container');
        if (courseTenantContainer) courseTenantContainer.classList.remove('hidden');
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
    loadStudentManagementTable();
    loadAdminManagementTable();
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

        document.getElementById('stat-total-courses').textContent = courseCount || 0;
        document.getElementById('stat-total-students').textContent = studentCount || 0;
        document.getElementById('stat-total-modules').textContent = lessonCount || 0;
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
                            ${course.thumbnail_url ? `<img src="${course.thumbnail_url}" class="w-16 h-16 rounded-lg object-cover border border-slate-700">` : ''}
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

                    <div id="course-modules-section-${course.id}" class="border-t border-slate-800 pt-4 space-y-3">
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
                            <p class="text-xs font-bold text-blue-400">+ Add Lesson or SCORM Module</p>
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
                                <input type="text" placeholder="Lesson ID (e.g. L-101)" required class="lesson-num-input px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100 font-mono">
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
    const selects = [document.getElementById('admin-tenant-select'), document.getElementById('course-tenant-id
