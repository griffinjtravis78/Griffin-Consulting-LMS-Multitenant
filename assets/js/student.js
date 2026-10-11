import { checkAuth, supabase } from './app.js';

let allCourses = [];
let currentStudentProfile = null;
let currentStudentTenants = [];
let activeTenantId = null;

(async () => {
    currentStudentProfile = await checkAuth('student');
    if (!currentStudentProfile) return;

    const { data: studentTenants, error } = await supabase
        .from('student_tenants')
        .select('tenants(*)')
        .eq('user_id', currentStudentProfile.id);

    if (error || !studentTenants || studentTenants.length === 0) {
        if (currentStudentProfile.tenants) {
            currentStudentTenants = [{ tenants: currentStudentProfile.tenants }];
        } else {
            alert('No organization assigned to this account.');
            await supabase.auth.signOut();
            window.location.href = './index.html';
            return;
        }
    } else {
        currentStudentTenants = studentTenants;
    }

    activeTenantId = sessionStorage.getItem('active_tenant_id');
    let currentTenantObj = currentStudentTenants.map(st => st.tenants).find(t => t.id === activeTenantId);

    if (!currentTenantObj) {
        currentTenantObj = currentStudentTenants[0].tenants;
        activeTenantId = currentTenantObj.id;
        sessionStorage.setItem('active_tenant_id', activeTenantId);
    }

    if (currentTenantObj.service_status && currentTenantObj.service_status !== 'active') {
        alert(`Service has been paused, temporarily. Please Contact your IT Dept for further information:\n${currentTenantObj.technical_contact_first_name || 'IT'} ${currentTenantObj.technical_contact_last_name || 'Support'} (${currentTenantObj.technical_contact_email || 'support@org.gov'})`);
        await supabase.auth.signOut();
        window.location.href = './index.html';
        return;
    }

    const tenantName = currentTenantObj.name || 'Organization';
    const navTitle = document.querySelector('nav h1');
    if (navTitle) navTitle.textContent = `${tenantName} LMS — Student Portal`;

    const logoImg = document.getElementById('tenant-logo-img');
    if (logoImg && currentTenantObj.logo_url) {
        logoImg.src = currentTenantObj.logo_url;
        logoImg.classList.remove('hidden');
    }

    fetchStudentCourses(activeTenantId);
})();

window.switchStudentTab = function(tabName) {
    const tabCourses = document.getElementById('student-tab-courses');
    const tabProfile = document.getElementById('student-tab-profile');
    if (tabCourses) tabCourses.classList.add('hidden');
    if (tabProfile) tabProfile.classList.add('hidden');

    const btnCourses = document.getElementById('tab-btn-courses');
    const btnProfile = document.getElementById('tab-btn-profile');
    if (btnCourses) btnCourses.className = 'px-3 py-1.5 text-xs font-semibold rounded text-slate-300 hover:text-white transition';
    if (btnProfile) btnProfile.className = 'px-3 py-1.5 text-xs font-semibold rounded text-slate-300 hover:text-white transition';

    const targetTab = document.getElementById(`student-tab-${tabName}`);
    if (targetTab) targetTab.classList.remove('hidden');

    const targetBtn = document.getElementById(`tab-btn-${tabName}`);
    if (targetBtn) targetBtn.className = 'px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white transition';

    if (tabName === 'profile') {
        loadStudentProfileView();
    }
};

async function fetchStudentCourses(tenantId) {
    const container = document.getElementById('student-course-grid');
    if (!container) return;
    try {
        const { data: courses, error } = await supabase
            .from('courses')
            .select('*')
            .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
            .eq('archived', false)
            .order('created_at', { ascending: false });

        if (error) {
            container.innerHTML = `<p class="text-red-400 text-sm">Error: ${error.message}</p>`;
            return;
        }

        if (!courses || courses.length === 0) {
            container.innerHTML = `<p class="text-slate-400 text-sm">No courses available for this organization at this time.</p>`;
            return;
        }

        const { data: allLessons } = await supabase.from('lessons').select('*');

        allCourses = courses.map(c => ({
            ...c,
            lessons: allLessons ? allLessons.filter(l => l.course_id === c.id) : []
        }));

        container.innerHTML = allCourses.map(course => `
            <div class="bg-slate-900 rounded-lg border border-slate-700 hover:border-blue-500 transition cursor-pointer overflow-hidden" onclick="window.selectCourse(${course.id})">
                ${course.thumbnail_url ? `<img src="${course.thumbnail_url}" alt="${course.title}" class="w-full h-32 object-cover border-b border-slate-700">` : ''}
                <div class="p-4">
                    <h4 class="font-bold text-slate-200 text-sm">${course.title}</h4>
                    <p class="text-xs text-slate-400 mt-1 line-clamp-2">${course.description || 'No description.'}</p>
                    <div class="flex justify-between items-center mt-3">
                        <span class="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">${course.lessons.length} Modules</span>
                        <span class="text-xs text-emerald-400 font-semibold">${course.ceu_credits ? course.ceu_credits + ' CEUs' : ''}</span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Exception in fetchStudentCourses:', err);
    }
}

window.selectCourse = async function(courseId) {
    const course = allCourses.find(c => c.id === courseId);
    if (!course) return;

    const { data: completion } = await supabase
        .from('student_completions')
        .select('*')
        .eq('user_id', currentStudentProfile.id)
        .eq('course_id', courseId)
        .maybeSingle();

    const isCompleted = !!completion;

    const viewer = document.getElementById('lesson-viewer-container');
    if (!viewer) return;

    viewer.innerHTML = `
        <div class="bg-slate-900 border border-slate-700 rounded-xl p-6 space-y-6 shadow-xl">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="text-xl font-bold text-blue-400">${course.title}</h3>
                    <p class="text-slate-400 text-sm mt-1">${course.description || ''}</p>
                </div>
                <div class="text-right">
                    <span class="text-xs bg-emerald-600/20 text-emerald-400 px-3 py-1 rounded-full font-semibold">${course.ceu_credits || 0} CEU Credits</span>
                </div>
            </div>
            
            <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Course Modules</h4>
            <div class="space-y-2 mb-6">
                ${course.lessons && course.lessons.length > 0 ? course.lessons.map(l => `
                    <div class="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <span class="text-sm text-slate-200">▶ [${l.lesson_type.toUpperCase()}]${l.title}</span>
                        <button onclick="window.playLesson('${l.lesson_type}', '${l.content_url}', '${l.title}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition">Launch</button>
                    </div>
                `).join('') : '<p class="text-xs text-slate-500 italic">No modules published for this course yet.</p>'}
            </div>

            <div id="media-player-box" class="mb-6"></div>

            <div class="border-t border-slate-800 pt-4 flex justify-between items-center">
                <span class="text-xs text-slate-400">Status: <strong class="${isCompleted ? 'text-emerald-400' : 'text-amber-400'}">${isCompleted ? 'Completed / Verified' : 'In Progress'}</strong></span>
                ${!isCompleted ? `<button onclick="window.markCourseComplete(${course.id})" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition">Mark Course Completed</button>` : `<button onclick="window.generateCertificate(${course.id})" class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition shadow-lg">View Official Certificate 🖨️</button>`}
            </div>
        </div>
    `;
};

window.playLesson = function(type, url, title) {
    const box = document.getElementById('media-player-box');
    if (!box) return;

    let mediaElement = '';
    if (type === 'video') {
        mediaElement = `<video controls class="w-full rounded-lg border border-slate-700 shadow-lg max-h-[450px]"><source src="${url}" type="video/mp4">Your browser does not support the video tag.</video>`;
    } else if (type === 'pdf') {
        mediaElement = `<iframe src="${url}" class="w-full h-[500px] rounded-lg border border-slate-700 bg-white"></iframe>`;
    } else {
        mediaElement = `
            <div class="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                <div class="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center text-xs">
                    <span class="font-semibold text-blue-400">Interactive SCORM / HTML5 Player</span>
                    <a href="${url}" target="_blank" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold">Open in Full Window ↗</a>
                </div>
                <iframe src="${url}" class="w-full h-[500px] bg-white border-0"></iframe>
            </div>
        `;
    }

    box.innerHTML = `
        <div class="border-t border-slate-800 pt-4 mt-4">
            <h4 class="text-sm font-semibold text-slate-300 mb-2">Now Playing: ${title}</h4>
            ${mediaElement}
        </div>
    `;
};

window.markCourseComplete = async function(courseId) {
    const { error } = await supabase.from('student_completions').insert([{
        user_id: currentStudentProfile.id,
        course_id: courseId,
        status: 'Completed / Verified',
        tenant_id: activeTenantId
    }]);

    if (error) {
        alert('Error recording completion: ' + error.message);
    } else {
        alert('Course successfully marked as completed! Official certificate unlocked.');
        window.selectCourse(courseId);
    }
};

window.generateCertificate = async function(courseId) {
    const course = allCourses.find(c => c.id === courseId);
    const tenantObj = currentStudentTenants.find(t => t.tenants.id === activeTenantId)?.tenants;
    const { data: comp } = await supabase.from('student_completions').select('completed_at').eq('user_id', currentStudentProfile.id).eq('course_id', courseId).maybeSingle();

    const win = window.open('', '_blank');
    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Certificate of Completion - Griffin Consulting Training Institute</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-200 flex items-center justify-center min-h-screen p-8 font-serif">
            <div class="bg-white border-8 border-double border-amber-700 p-12 max-w-4xl w-full text-center relative shadow-2xl space-y-6">
                <div class="absolute bottom-8 left-8 flex items-center gap-3">
                    <img src="./image_7e43b526.jpg" class="w-24 h-24 object-contain" alt="Institute Seal">
                    <div class="text-left text-[10px] text-slate-500 font-sans">Griffin Consulting Training Institute<br>Official State & Professional Seal</div>
                </div>
                <h1 class="text-3xl font-bold tracking-widest text-slate-800 uppercase">Certificate of Completion</h1>
                <p class="text-sm italic text-slate-600">This certifies that</p>
                <p class="text-2xl font-bold text-slate-900">${currentStudentProfile.first_name || ''} ${currentStudentProfile.last_name || ''}</p>
                <p class="text-xs text-slate-500">${tenantObj?.name || 'Associated Organization'}</p>
                <p class="text-sm italic text-slate-600">has successfully completed the training curriculum</p>
                <p class="text-xl font-bold text-blue-800">${course.title}</p>
                <p class="text-xs text-slate-500">Date of Completion: ${new Date(comp?.completed_at || Date.now()).toLocaleDateString()}</p>
                <div class="pt-8 flex justify-end">
                    <div class="text-center">
                        <p class="font-signature text-xl text-slate-800 italic">Travis J Griffin</p>
                        <div class="w-48 border-t border-slate-400 mt-1"></div>
                        <p class="text-xs font-sans font-bold text-slate-700 mt-1">Travis J Griffin</p>
                        <p class="text-[10px] font-sans text-slate-500">Training Director, Appointing Authority</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
    win.document.close();
};

function loadStudentProfileView() {
    const container = document.getElementById('student-tab-profile');
    if (!container) return;
    const tenantObj = currentStudentTenants.find(t => t.tenants.id === activeTenantId)?.tenants;

    container.innerHTML = `
        <div class="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-2xl mx-auto space-y-6 shadow-xl">
            <h2 class="text-lg font-bold text-blue-400">Student Profile & Credentials</h2>
            <form id="student-profile-form" class="space-y-4 text-xs">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-slate-400 mb-1">Email Address (Admin Locked)</label>
                        <input type="email" disabled value="${currentStudentProfile.email || ''}" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-500 cursor-not-allowed">
                    </div>
                    <div>
                        <label class="block text-slate-400 mb-1">Student ID (Admin Locked)</label>
                        <input type="text" disabled value="${currentStudentProfile.unique_identifier || ''}" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-500 cursor-not-allowed">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-slate-400 mb-1">First Name (Admin Locked)</label>
                        <input type="text" disabled value="${currentStudentProfile.first_name || ''}" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-500 cursor-not-allowed">
                    </div>
                    <div>
                        <label class="block text-slate-400 mb-1">Last Name (Admin Locked)</label>
                        <input type="text" disabled value="${currentStudentProfile.last_name || ''}" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-500 cursor-not-allowed">
                    </div>
                </div>
                <div>
                    <label class="block text-slate-400 mb-1">Organization (Admin Locked)</label>
                    <input type="text" disabled value="${tenantObj?.name || 'Unassigned'}" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-500 cursor-not-allowed">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-slate-400 mb-1">Department</label>
                        <input type="text" id="prof-dept" value="${currentStudentProfile.department || ''}" class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100">
                    </div>
                    <div>
                        <label class="block text-slate-400 mb-1">Division</label>
                        <input type="text" id="prof-div" value="${currentStudentProfile.division || ''}" class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100">
                    </div>
                </div>
                <div>
                    <label class="block text-slate-400 mb-1">Phone Number</label>
                    <input type="text" id="prof-phone" value="${currentStudentProfile.phone || ''}" class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100">
                </div>
                <div>
                    <label class="block text-slate-400 mb-1">Street Address</label>
                    <input type="text" id="prof-street" value="${currentStudentProfile.street_address || ''}" class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100">
                </div>
                <button type="submit" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold transition focus:ring-2 focus:ring-blue-500">Save Profile Updates</button>
            </form>
        </div>
    `;

    document.getElementById('student-profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            department: document.getElementById('prof-dept').value,
            division: document.getElementById('prof-div').value,
            phone: document.getElementById('prof-phone').value,
            street_address: document.getElementById('prof-street').value
        };

        const { error } = await supabase.from('profiles').update(payload).eq('id', currentStudentProfile.id);
        if (error) {
            alert('Error updating profile: ' + error.message);
        } else {
            alert('Profile successfully updated!');
        }
    });
}
