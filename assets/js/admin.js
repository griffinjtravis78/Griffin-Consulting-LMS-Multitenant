import { checkAuth, supabase } from './app.js';

let complianceRecords = [];

// Tab Navigation (Defined globally right away)
window.switchAdminTab = function(tabName) {
    document.getElementById('admin-tab-courses').classList.add('hidden');
    document.getElementById('admin-tab-students').classList.add('hidden');
    document.getElementById('admin-tab-reports').classList.add('hidden');

    document.getElementById('tab-btn-courses').className = 'px-3 py-1.5 text-xs font-semibold rounded text-slate-300 hover:text-white transition';
    document.getElementById('tab-btn-students').className = 'px-3 py-1.5 text-xs font-semibold rounded text-slate-300 hover:text-white transition';
    document.getElementById('tab-btn-reports').className = 'px-3 py-1.5 text-xs font-semibold rounded text-slate-300 hover:text-white transition';

    document.getElementById(`admin-tab-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-btn-${tabName}`).className = 'px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white transition';
};

// Verify admin authentication on load
(async () => {
    const user = await checkAuth('admin');
    if (user) {
        loadDashboardStats();
        fetchAdminCourses();
        fetchComplianceReports();
    }
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
            container.innerHTML = `<p class="text-slate-400 text-sm italic">No courses created yet. Use the form to add your first course.</p>`;
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

                    <!-- Lessons Section -->
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

                        <!-- Add Lesson Inline Form (Hybrid URL & File Upload Workflow) -->
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

// Dynamic Input Toggle between URL and File Upload
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

    const { error } = await supabase.from('courses').insert([{ title, description, ceu_credits, thumbnail_url }]);
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

    const { error: dbError } = await supabase.from('lessons').insert([
        {
            course_id: courseId,
            title: title,
            lesson_type: lesson_type,
            content_url: content_url
        }
    ]);

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
    row.className = 'grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900 p-3 rounded-lg border border-slate-700 agent-row relative';
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
    row.className = 'bg-slate-900 p-4 rounded-lg border border-slate-700 org-row space-y-3 relative';
    row.innerHTML = `
        <div class="flex justify-between items-center">
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Additional Organization</span>
            <button type="button" onclick="this.closest('.org-row').remove()" class="px-2.5 py-1 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded text-xs transition">Remove Org</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label class="block text-xs font-medium text-slate-400 mb-1">Organization Name</label>
                <input type="text" required class="org-name-input w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100" placeholder="Agency or Company Name">
            </div>
            <div>
                <label class="block text-xs font-medium text-slate-400 mb-1">Org Phone</label>
                <input type="text" required class="org-phone-input w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100" placeholder="e.g. 555-987-6543">
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

    const { error: profileError } = await supabase.from('profiles').upsert([{
        id: userId, email, role: 'student', unique_identifier, first_name, last_name, phone, street_address, street_address_2, city, state, zip
    }]);

    if (profileError) {
        errorBox.textContent = 'Profile Error: ' + profileError.message;
        errorBox.classList.remove('hidden');
        return;
    }

    const agentRows = document.querySelectorAll('.agent-row');
    for (let row of agentRows) {
        const agent_id = row.querySelector('.agent-id-input').value;
        const agent_state = row.querySelector('.agent-state-input').value;
        await supabase.from('student_agent_licenses').insert([{ user_id: userId, agent_id, agent_state }]);
    }

    const orgRows = document.querySelectorAll('.org-row');
    for (let row of orgRows) {
        const org_name = row.querySelector('.org-name-input').value;
        const org_phone = row.querySelector('.org-phone-input').value;
        const org_street = row.querySelector('.org-street-input').value;
        const org_street_2 = row.querySelector('.org-street2-input').value;
        const org_city = row.querySelector('.org-city-input').value;
        const org_state = row.querySelector('.org-state-input').value;
        const org_zip = row.querySelector('.org-zip-input').value;
        await supabase.from('student_organizations').insert([{ user_id: userId, org_name, org_phone, org_street, org_street_2, org_city, org_state, org_zip }]);
    }

    successBox.textContent = `Student ${first_name} ${last_name} (ID: ${unique_identifier}) successfully provisioned!`;
    successBox.classList.remove('hidden');
    document.getElementById('provision-student-form').reset();
    loadDashboardStats();
    fetchComplianceReports();
});

// --- COMPLIANCE REPORTS LOGIC ---
async function fetchComplianceReports() {
    const tbody = document.getElementById('compliance-report-tbody');
    const { data: completions, error } = await supabase
        .from('student_completions')
        .select('completed_at, courses(title, ceu_credits), profiles(first_name, last_name, unique_identifier)')
        .order('completed_at', { ascending: false });

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
    a.setAttribute('download', `Griffin_Consulting_Compliance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    a.click();
};
