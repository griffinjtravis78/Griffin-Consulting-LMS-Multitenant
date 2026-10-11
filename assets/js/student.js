import { checkAuth, supabase } from './app.js';

let allCourses = [], currentStudentProfile = null, currentStudentTenants = [], activeTenantId = null;

(async () => {
    currentStudentProfile = await checkAuth('student');
    if (!currentStudentProfile) return;

    const { data: st } = await supabase.from('student_tenants').select('tenants(*)').eq('user_id', currentStudentProfile.id);
    currentStudentTenants = st && st.length > 0 ? st : (currentStudentProfile.tenants ? [{ tenants: currentStudentProfile.tenants }] : []);
    
    activeTenantId = sessionStorage.getItem('active_tenant_id') || currentStudentTenants[0]?.tenants?.id;
    sessionStorage.setItem('active_tenant_id', activeTenantId);
    const tenantObj = currentStudentTenants.map(t => t.tenants).find(t => t.id === activeTenantId) || currentStudentTenants[0]?.tenants;

    if (tenantObj?.service_status && tenantObj.service_status !== 'active') {
        alert('Service suspended. Contact IT support.');
        await supabase.auth.signOut();
        window.location.href = './index.html';
        return;
    }

    document.querySelector('nav h1').textContent = `${tenantObj?.name || 'Organization'} LMS — Student Portal`;
    const logoImg = document.getElementById('tenant-logo-img');
    if (logoImg && tenantObj?.logo_url) { logoImg.src = tenantObj.logo_url; logoImg.classList.remove('hidden'); }

    fetchStudentCourses(activeTenantId);
})();

window.switchStudentTab = (tab) => {
    ['courses', 'profile'].forEach(t => {
        document.getElementById(`student-tab-${t}`)?.classList.add('hidden');
        document.getElementById(`tab-btn-${t}`)?.className = 'px-3 py-1.5 text-xs font-semibold rounded text-slate-300 hover:text-white transition';
    });
    document.getElementById(`student-tab-${tab}`)?.classList.remove('hidden');
    document.getElementById(`tab-btn-${tab}`).className = 'px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white transition';
    if (tab === 'profile') loadStudentProfileView();
};

async function fetchStudentCourses(tenantId) {
    const container = document.getElementById('student-course-grid');
    if (!container) return;
    const { data: courses } = await supabase.from('courses').select('*').or(`tenant_id.eq.${tenantId},tenant_id.is.null`).eq('archived', false);
    const { data: lessons } = await supabase.from('lessons').select('*');
    allCourses = (courses || []).map(c => ({ ...c, lessons: lessons ? lessons.filter(l => l.course_id === c.id) : [] }));

    container.innerHTML = allCourses.map(c => `
        <div class="bg-slate-900 rounded-lg border border-slate-700 hover:border-blue-500 transition cursor-pointer overflow-hidden" onclick="window.selectCourse(${c.id})">
            ${c.thumbnail_url ? `<img src="${c.thumbnail_url}" alt="${c.title}" class="w-full h-32 object-cover border-b border-slate-700">` : ''}
            <div class="p-4">
                <h4 class="font-bold text-slate-200 text-sm">${c.title}</h4>
                <p class="text-xs text-slate-400 mt-1 line-clamp-2">${c.description || ''}</p>
                <div class="flex justify-between items-center mt-3 text-xs">
                    <span class="bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded">${c.lessons.length} Modules</span>
                    <span class="text-emerald-400 font-semibold">${c.ceu_credits || 0} CEUs</span>
                </div>
            </div>
        </div>`).join('');
}

window.selectCourse = async (courseId) => {
    const course = allCourses.find(c => c.id === courseId);
    if (!course) return;
    const { data: comp } = await supabase.from('student_completions').select('*').eq('user_id', currentStudentProfile.id).eq('course_id', courseId).maybeSingle();

    const viewer = document.getElementById('lesson-viewer-container');
    if (!viewer) return;

    viewer.innerHTML = `
        <div class="bg-slate-900 border border-slate-700 rounded-xl p-6 space-y-6">
            <div class="flex justify-between items-start">
                <div><h3 class="text-lg font-bold text-blue-400">${course.title}</h3><p class="text-xs text-slate-400 mt-1">${course.description || ''}</p></div>
                <span class="text-xs bg-emerald-600/20 text-emerald-400 px-3 py-1 rounded font-semibold">${course.ceu_credits || 0} CEU Credits</span>
            </div>
            <div class="space-y-2">
                ${course.lessons.map(l => `<div class="flex justify-between items-center bg-slate-950 p-3 rounded border border-slate-800 text-xs">
                    <span class="text-slate-200">[${l.lesson_type.toUpperCase()}]${l.title}</span>
                    <button onclick="window.playLesson('${l.lesson_type}', '${l.content_url}', '${l.title}')" class="px-3 py-1 bg-blue-600 text-white rounded font-semibold">Launch</button>
                </div>`).join('')}
            </div>
            <div id="media-player-box"></div>
            <div class="border-t border-slate-800 pt-4 flex justify-between items-center text-xs">
                <span>Status: <strong class="${comp ? 'text-emerald-400' : 'text-amber-400'}">${comp ? 'Completed / Verified' : 'In Progress'}</strong></span>
                ${!comp ? `<button onclick="window.markCourseComplete(${course.id})" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold">Mark Course Completed</button>` : `<button onclick="window.generateCertificate(${course.id})" class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-semibold">View Official Certificate 🖨️</button>`}
            </div>
        </div>`;
};

window.playLesson = (type, url, title) => {
    document.getElementById('media-player-box').innerHTML = `<div class="mt-4"><h4 class="text-xs font-semibold text-slate-300 mb-2">Now Playing: ${title}</h4><iframe src="${url}" class="w-full h-[450px] rounded border border-slate-700 bg-white"></iframe></div>`;
};

window.markCourseComplete = async (courseId) => {
    await supabase.from('student_completions').insert([{ user_id: currentStudentProfile.id, course_id: courseId, status: 'Completed / Verified', tenant_id: activeTenantId }]);
    alert('Course marked complete! Certificate unlocked.');
    window.selectCourse(courseId);
};

window.generateCertificate = async (courseId) => {
    const course = allCourses.find(c => c.id === courseId);
    const tenantObj = currentStudentTenants.find(t => t.tenants.id === activeTenantId)?.tenants;
    const { data: comp } = await supabase.from('student_completions').select('completed_at').eq('user_id', currentStudentProfile.id).eq('course_id', courseId).maybeSingle();

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Certificate of Completion</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-slate-100 flex items-center justify-center min-h-screen p-8 font-serif">
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
    </body></html>`);
    win.document.close();
};

function loadStudentProfileView() {
    const container = document.getElementById('student-tab-profile');
    if (!container) return;
    const tenantObj = currentStudentTenants.find(t => t.tenants.id === activeTenantId)?.tenants;

    container.innerHTML = `
        <div class="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-2xl mx-auto space-y-6">
            <h2 class="text-lg font-bold text-blue-400">Student Profile & Credentials</h2>
            <form id="student-profile-form" class="space-y-4 text-xs">
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="block text-slate-400 mb-1">Email Address (Admin Locked)</label><input type="email" disabled value="${currentStudentProfile.email || ''}" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-500 cursor-not-allowed"></div>
                    <div><label class="block text-slate-400 mb-1">Student ID (Admin Locked)</label><input type="text" disabled value="${currentStudentProfile.unique_identifier || ''}" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-500 cursor-not-allowed"></div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="block text-slate-400 mb-1">First Name (Admin Locked)</label><input type="text" disabled value="${currentStudentProfile.first_name || ''}" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-500 cursor-not-allowed"></div>
                    <div><label class="block text-slate-400 mb-1">Last Name (Admin Locked)</label><input type="text" disabled value="${currentStudentProfile.last_name || ''}" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-500 cursor-not-allowed"></div>
                </div>
                <div><label class="block text-slate-400 mb-1">Organization (Admin Locked)</label><input type="text" disabled value="${tenantObj?.name || 'Unassigned'}" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-500 cursor-not-allowed"></div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="block text-slate-400 mb-1">Department</label><input type="text" id="prof-dept" value="${currentStudentProfile.department || ''}" class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"></div>
                    <div><label class="block text-slate-400 mb-1">Division</label><input type="text" id="prof-div" value="${currentStudentProfile.division || ''}" class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"></div>
                </div>
                <div><label class="block text-slate-400 mb-1">Phone Number</label><input type="text" id="prof-phone" value="${currentStudentProfile.phone || ''}" class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"></div>
                <div><label class="block text-slate-400 mb-1">Street Address</label><input type="text" id="prof-street" value="${currentStudentProfile.street_address || ''}" class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"></div>
                <button type="submit" class="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold transition focus:ring-2 focus:ring-blue-500">Save Profile Updates</button>
            </form>
        </div>`;

    document.getElementById('student-profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = { 
            department: document.getElementById('prof-dept').value, 
            division: document.getElementById('prof-div').value, 
            phone: document.getElementById('prof-phone').value, 
            street_address: document.getElementById('prof-street').value 
        };
        const { error } = await supabase.from('profiles').update(payload).eq('id', currentStudentProfile.id);
        if (error) alert('Error updating profile: ' + error.message);
        else alert('Profile successfully updated!');
    });
}
