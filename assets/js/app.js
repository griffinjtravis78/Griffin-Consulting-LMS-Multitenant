import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://affszlowgizrxzfzmavp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1Z-1jXB-qrmY8iJdzW2ecg_CxL0Hv-a';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

export async function checkAuth(requiredRole) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { window.location.href = './index.html'; return null; }

        const { data: profile } = await supabase.from('profiles').select('*, tenants(*)').eq('id', session.user.id).single();
        if (!profile || (requiredRole && requiredRole === 'admin' && profile.role !== 'admin' && profile.role !== 'super_admin') || (requiredRole && requiredRole !== 'admin' && profile.role !== requiredRole)) {
            window.location.href = './index.html';
            return null;
        }

        if (profile.tenants?.service_status && profile.tenants.service_status !== 'active') {
            alert(`Service suspended. Contact IT: ${profile.tenants.technical_contact_first_name || 'Support'} (${profile.tenants.technical_contact_email || 'support@org.gov'})`);
            await supabase.auth.signOut();
            window.location.href = './index.html';
            return null;
        }
        return profile;
    } catch {
        window.location.href = './index.html';
        return null;
    }
}

window.openLegalModal = function(type) {
    let title = '', body = '';
    switch(type) {
        case 'terms':
            title = 'Terms of Service & Acceptable Use';
            body = `<p class="mb-3">Welcome to Griffin Consulting Training Institute. By accessing our platform, you agree to these Terms of Service. Account sharing is strictly prohibited. Violations result in immediate termination.</p>`;
            break;
        case 'privacy':
            title = 'Privacy Policy (GDPR / CCPA Compliant)';
            body = `<p class="mb-3">We protect your personal data in compliance with GDPR and CCPA standards. You retain the right to data export and deletion.</p>`;
            break;
        case 'disclaimer':
            title = 'Legal & Educational Disclaimers';
            body = `<p class="mb-3"><strong>No Guarantee of Outcomes:</strong> Courses do not guarantee employment, promotions, or formal professional licensure unless explicitly contracted.</p>
                    <p class="mb-3"><strong>Professional Services:</strong> Content is for educational purposes only and does not constitute formal legal, financial, or therapeutic advice.</p>
                    <p class="mb-3"><strong>Earnings Disclaimer:</strong> Business case studies are illustrative and do not guarantee financial return.</p>`;
            break;
        case 'accessibility':
            title = 'Accessibility Statement (WCAG 2.1 AA)';
            body = `<p class="mb-3">We are committed to digital accessibility, adhering to WCAG 2.1 Level AA standards across all interfaces.</p>`;
            break;
    }

    let modal = document.getElementById('legal-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'legal-modal';
        modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `<div class="bg-slate-900 border border-slate-700 rounded-xl max-w-xl w-full p-6 text-slate-100 shadow-2xl space-y-4">
            <h3 id="m-title" class="text-lg font-bold text-blue-400"></h3>
            <div id="m-body" class="text-xs text-slate-300 max-h-[60vh] overflow-y-auto space-y-2"></div>
            <div class="text-right"><button onclick="document.getElementById('legal-modal').classList.add('hidden')" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold">Close</button></div>
        </div>`;
        document.body.appendChild(modal);
    }
    document.getElementById('m-title').textContent = title;
    document.getElementById('m-body').innerHTML = body;
    modal.classList.remove('hidden');
};
