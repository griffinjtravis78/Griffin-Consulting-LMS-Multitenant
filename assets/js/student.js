import { checkAuth, supabase } from './app.js';

let allCourses = [];
let currentStudentProfile = null;
let currentStudentTenants = [];
let activeTenantId = null;

(async () => {
    currentStudentProfile = await checkAuth('student');
    if (!currentStudentProfile) return;

    // Fetch multi-org associations from student_tenants junction table
    const { data: studentTenants, error } = await supabase
        .from('student_tenants')
        .select('tenants(*)')
        .eq('user_id', currentStudentProfile.id);

    if (error || !studentTenants || studentTenants.length === 0) {
        // Fallback to profiles.tenant_id if junction table entry is missing
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

    // Determine active tenant from session or default to first
    activeTenantId = sessionStorage.getItem('active_tenant_id');
    let currentTenantObj = currentStudentTenants.map(st => st.tenants).find(t => t.id === activeTenantId);

    if (!currentTenantObj) {
        currentTenantObj = currentStudentTenants[0].tenants;
        activeTenantId = currentTenantObj.id;
        sessionStorage.setItem('active_tenant_id', activeTenantId);
    }

    // Service pause verification modal/alert intercept
    if (currentTenantObj.service_status && currentTenantObj.service_status !== 'active') {
        alert(`Service has been paused, temporarily. Please Contact your IT Dept for further information:\n${currentTenantObj.technical_contact_first_name || 'IT'} ${currentTenantObj.technical_contact_last_name || 'Support'} (${currentTenantObj.technical_contact_email || 'support@org.gov'})`);
        await supabase.auth.signOut();
        window.location.href = './index.html';
        return;
    }

    // Update Navigation Header Title and Branding Logo
    const tenantName = currentTenantObj.name || 'Organization';
    const navTitle = document.querySelector('nav h1');
    if (navTitle) navTitle.textContent = `${tenantName} LMS — Student Portal`;

    const logoImg = document.getElementById('tenant-logo-img');
    if (logoImg && currentTenantObj.logo_url) {
        logoImg.src = currentTenantObj.logo_url;
        logoImg.classList.remove('hidden');
    }

    // Render support ticket link if configured
    const ticketLink = document.getElementById('ticket-support-link');
    if (ticketLink && currentTenantObj.issue_link) {
        ticketLink.href = currentTenantObj.issue_link;
        ticketLink.classList.remove('hidden');
    }

    // Render multi-org dropdown selector if assigned to multiple organizations
    if (currentStudentTenants.length > 1) {
        const switcher = document.getElementById('student-org-switcher');
        if (switcher) {
            switcher.innerHTML = currentStudentTenants.map(st => 
                `<option value="${st.tenants.id}" ${st.tenants.id === activeTenantId ? 'selected' : ''}>${st.tenants.name}</option>`
            ).join('');
            switcher.classList.remove('hidden');
        }
    }

    fetchStudentCourses(activeTenantId);
    loadStudentProfileData();
})();

window.switchStudentOrg = function(tenantId) {
    sessionStorage.setItem('active_tenant_id', tenantId);
    location.reload();
};

// Tab Navigation for Student Portal
window.switchStudentTab = function(tabName) {
    document.getElementById('student-tab-courses').classList.add('hidden');
    document.getElementById('student-tab-profile').classList.add('hidden');

    document.getElementById('tab-btn-courses').className = 'px-3 py-1.5 text-xs font-semibold rounded text-slate-300 hover:text-white transition';
    document.getElementById('tab-btn-profile').className = 'px-3 py-1.5 text-xs font-semibold rounded text-slate-300 hover:text-white transition';

    document.getElementById(`student-tab-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-btn-${tabName}`).className = 'px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white transition';

    if (tabName === 'profile') {
        loadStudentProfileData();
    }
};

async function fetchStudentCourses(tenantId) {
    const container = document.getElementById('student-course-list');
    try {
        // Fetch courses matching tenant_id or global (tenant_id IS NULL)
        const { data: courses, error } = await supabase
            .from('courses')
            .select('*')
            .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
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
        container.innerHTML = `<p class="text-red-400 text-sm">Error: ${err.message}</p>`;
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
    viewer.innerHTML = `
        <div class="flex justify-between items-start mb-4">
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
                <div class="flex justify-between items-center bg-slate-900 p-3 rounded-lg border border-slate-700">
                    <span class="text-sm text-slate-200">▶ [${l.lesson_type.toUpperCase()}]${l.title}</span>
                    <button onclick="window.playLesson('${l.lesson_type}', '${l.content_url}', '${l.title}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition">Launch</button>
                </div>
            `).join('') : '<p class="text-xs text-slate-500 italic">No modules published for this course yet.</p>'}
        </div>

        <div id="media-player-box" class="mb-6"></div>

        <div class="border-t border-slate-700 pt-4 flex justify-between items-center">
            <span class="text-xs text-slate-400">Status: <strong class="${isCompleted ? 'text-emerald-400' : 'text-amber-400'}">${isCompleted ? 'Completed / Verified' : 'In Progress'}</strong></span>
            ${!isCompleted ? `<button onclick="window.markCourseComplete(${course.id})" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition">Mark Course Completed</button>` : `<span class="text-xs text-emerald-400 font-semibold">✓ Completed & Recorded to Transcript</span>`}
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
        mediaElement = `<iframe src="${url}" class="w-full h-[500px] rounded-lg border border-slate-700"></iframe>`;
    } else {
        mediaElement = `
            <div class="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                <div class="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center text-xs">
                    <span class="font-semibold text-blue-400">Interactive SCORM / HTML5 Player</span>
                    <div class="flex gap-2">
                        <a href="${url}" target="_blank" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold">Open in Full Window ↗</a>
                        <a href="${url}" download class="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded font-semibold">Download Archive</a>
                    </div>
                </div>
                <iframe src="${url}" class="w-full h-[500px] bg-white border-0"></iframe>
            </div>
        `;
    }

    box.innerHTML = `
        <div class="border-t border-slate-700 pt-4 mt-4">
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
        alert('Course successfully marked as completed! Recorded to your official transcript.');
        window.selectCourse(courseId);
    }
};

async function loadStudentProfileData() {
    if (!currentStudentProfile) return;

    document.getElementById('prof-firstname').value = currentStudentProfile.first_name || '';
    document.getElementById('prof-lastname').value = currentStudentProfile.last_name || '';
    document.getElementById('prof-phone').value = currentStudentProfile.phone || '';
    document.getElementById('prof-street').value = currentStudentProfile.street_address || '';
    document.getElementById('prof-street2').value = currentStudentProfile.street_address_2 || '';
    document.getElementById('prof-city').value = currentStudentProfile.city || '';
    document.getElementById('prof-state').value = currentStudentProfile.state || '';
    document.getElementById('prof-zip').value = currentStudentProfile.zip || '';

    const { data: licenses } = await supabase.from('student_agent_licenses').select('*').eq('user_id', currentStudentProfile.id);
    const agentContainer = document.getElementById('profile-agent-list');
    if (agentContainer) {
        if (licenses && licenses.length > 0) {
            agentContainer.innerHTML = licenses.map(l => `
                <div class="bg-slate-900 p-3 rounded-lg border border-slate-700 flex justify-between items-center text-xs">
                    <span><strong>Agent ID:</strong> ${l.agent_id} | <strong>State:</strong> ${l.agent_state}</span>
                </div>
            `).join('');
        } else {
            agentContainer.innerHTML = `<p class="text-xs text-slate-500 italic">No agent licenses recorded.</p>`;
        }
    }

    const { data: orgs } = await supabase.from('student_organizations').select('*').eq('user_id', currentStudentProfile.id);
    const orgContainer = document.getElementById('profile-org-list');
    if (orgContainer) {
        if (orgs && orgs.length > 0) {
            orgContainer.innerHTML = orgs.map(o => `
                <div class="bg-slate-900 p-3 rounded-lg border border-slate-700 text-xs space-y-1">
                    <p><strong>Organization:</strong> ${o.org_name} (${o.org_phone || 'No Phone'})</p>
                    <p class="text-slate-400">Address: ${o.org_street} ${o.org_street_2 ? o.org_street_2 + ', ' : ''}${o.org_city}, ${o.org_state} ${o.org_zip}</p>
                </div>
            `).join('');
        } else {
            orgContainer.innerHTML = `<p class="text-xs text-slate-500 italic">No organization records found.</p>`;
        }
    }

    const { data: auditLogs } = await supabase
        .from('profile_audit_log')
        .select('*')
        .eq('user_id', currentStudentProfile.id)
        .order('changed_at', { ascending: false });

    const auditTbody = document.getElementById('audit-ledger-tbody');
    if (auditTbody) {
        if (auditLogs && auditLogs.length > 0) {
            auditTbody.innerHTML = auditLogs.map(log => `
                <tr class="hover:bg-slate-900/50">
                    <td class="p-3 text-slate-400">${new Date(log.changed_at).toLocaleString()}</td>
                    <td class="p-3 text-blue-400">${log.changed_by || 'System / Self'}</td>
                    <td class="p-3 text-slate-300"><pre class="text-[11px] bg-slate-900 p-2 rounded max-h-24 overflow-y-auto">${JSON.stringify(log.old_data, null, 2)}</pre></td>
                </tr>
            `).join('');
        } else {
            auditTbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-500 italic">No audit history recorded yet.</td></tr>`;
        }
    }
}

document.getElementById('update-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const successBox = document.getElementById('profile-success-msg');
    const errorBox = document.getElementById('profile-error-msg');
    if (successBox) successBox.classList.add('hidden');
    if (errorBox) errorBox.classList.add('hidden');

    const first_name = document.getElementById('prof-firstname').value;
    const last_name = document.getElementById('prof-lastname').value;
    const phone = document.getElementById('prof-phone').value;
    const street_address = document.getElementById('prof-street').value;
    const street_address_2 = document.getElementById('prof-street2').value;
    const city = document.getElementById('prof-city').value;
    const state = document.getElementById('prof-state').value;
    const zip = document.getElementById('prof-zip').value;

    const { error } = await supabase.from('profiles').update({
        first_name, last_name, phone, street_address, street_address_2, city, state, zip
    }).eq('id', currentStudentProfile.id);

    if (error) {
        if (errorBox) {
            errorBox.textContent = 'Error updating profile: ' + error.message;
            errorBox.classList.remove('hidden');
        }
    } else {
        if (successBox) {
            successBox.textContent = 'Profile successfully updated!';
            successBox.classList.remove('hidden');
        }
        
        const { data: updated } = await supabase.from('profiles').select('*, tenants(*)').eq('id', currentStudentProfile.id).single();
        if (updated) currentStudentProfile = updated;
        
        loadStudentProfileData();
    }
});
