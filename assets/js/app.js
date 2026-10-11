import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://affszlowgizrxzfzmavp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1Z-1jXB-qrmY8iJdzW2ecg_CxL0Hv-a';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// Global Auth Guard function with Tenant Context and Service Pause Intercept
export async function checkAuth(requiredRole) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = './index.html';
        return null;
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*, tenants(*)')
        .eq('id', session.user.id)
        .single();

    if (profileError || !profile || (requiredRole && profile.role !== requiredRole)) {
        window.location.href = './index.html';
        return null;
    }

    // Check if user's assigned tenant service is paused or archived (for single-tenant / admin contexts)
    if (profile.tenants && profile.tenants.service_status && profile.tenants.service_status !== 'active') {
        alert(`Service has been paused, temporarily. Please Contact your IT Dept for further information:\n${profile.tenants.technical_contact_first_name || 'IT'} ${profile.tenants.technical_contact_last_name || 'Support'} (${profile.tenants.technical_contact_email || 'support@org.gov'})`);
        await supabase.auth.signOut();
        window.location.href = './index.html';
        return null;
    }

    return profile;
}

// Global Legal Disclaimers Modal Handler
window.openLegalModal = function(policyType) {
    let title = '';
    let body = '';

    switch(policyType) {
        case 'terms':
            title = '1. Terms of Service & Acceptable Use Policy';
            body = `<p class="mb-3">Welcome to the Multi-Tenant LMS Platform ("Platform"). By accessing, registering for, or using our platform, you agree to comply with and be bound by these Terms of Service.</p>
                    <ul class="list-disc pl-5 space-y-2">
                        <li><strong>Account Security:</strong> Users are responsible for maintaining the confidentiality of their account credentials.</li>
                        <li><strong>Acceptable Use:</strong> Users agree not to misuse the platform or upload malicious code.</li>
                        <li><strong>Service Availability:</strong> We strive to maintain high availability but do not guarantee uninterrupted access.</li>
                    </ul>`;
            break;
        case 'privacy':
            title = '2. Privacy Policy';
            body = `<p class="mb-3">We respect your privacy and protect personal data in accordance with applicable standards.</p>
                    <ul class="list-disc pl-5 space-y-2">
                        <li><strong>Data Collection:</strong> We collect information provided during registration, course enrollment, and progress tracking.</li>
                        <li><strong>Use of Data:</strong> Data is used solely to deliver training content, track certification progress, and improve functionality.</li>
                    </ul>`;
            break;
        case 'ip':
            title = '3. Intellectual Property (IP) & Copyright Disclaimer';
            body = `<p class="mb-3">All hosted content is the exclusive property of its respective organization or licensors.</p>`;
            break;
        case 'outcomes':
            title = '4. Educational & Professional Outcome Disclaimer';
            body = `<p class="mb-3">Courses are designed for professional development and capacity building without guaranteed employment outcomes.</p>`;
            break;
        case 'accessibility':
            title = '5. Accessibility & Third-Party Content Disclaimer';
            body = `<p class="mb-3">Committed to digital accessibility and WCAG standards compliance.</p>`;
            break;
    }

    let modal = document.getElementById('legal-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'legal-modal';
        modal.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-slate-800 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
                <div class="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h3 id="modal-title" class="text-lg font-bold text-blue-400"></h3>
                    <button onclick="document.getElementById('legal-modal').classList.add('hidden')" class="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
                </div>
                <div id="modal-body" class="p-6 overflow-y-auto text-slate-300 text-sm space-y-4"></div>
                <div class="p-4 border-t border-slate-700 text-right">
                    <button onclick="document.getElementById('legal-modal').classList.add('hidden')" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    modal.classList.remove('hidden');
};
