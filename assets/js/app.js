import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://nfitvzrbaxsqemtayhft.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VVHJ5dltav1cf-pLsKMouQ_5G1Mw2kS';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// Global Auth Guard function with Tenant Context and Service Pause Intercept
export async function checkAuth(requiredRole) {
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            window.location.href = './index.html';
            return null;
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (profileError || !profile) {
            window.location.href = './index.html';
            return null;
        }

        if (requiredRole) {
            if (requiredRole === 'admin' && profile.role !== 'admin' && profile.role !== 'super_admin') {
                window.location.href = './index.html';
                return null;
            } else if (requiredRole !== 'admin' && profile.role !== requiredRole) {
                window.location.href = './index.html';
                return null;
            }
        }

        return profile;
    } catch (err) {
        console.error('Auth guard exception:', err);
        window.location.href = './index.html';
        return null;
    }
}

// Global Legal Disclaimers Modal Handler
window.openLegalModal = function(policyType) {
    let title = '';
    let body = '';

    switch(policyType) {
        case 'terms':
            title = '1. Terms of Service & Acceptable Use Policy';
            body = `<p class="mb-3">Welcome to Griffin Consulting Training Institute. By accessing, registering for, or using our platform, you agree to comply with and be bound by these Terms of Service.</p>
                    <ul class="list-disc pl-5 space-y-2">
                        <li><strong>Account Security:</strong> Users are responsible for maintaining the confidentiality of their account credentials. Account sharing is strictly prohibited.</li>
                        <li><strong>Acceptable Use:</strong> Users agree not to misuse the platform, engage in unauthorized sharing of course credentials, or upload malicious code.</li>
                        <li><strong>Service Availability:</strong> We strive to maintain high availability but do not guarantee uninterrupted access.</li>
                    </ul>`;
            break;
        case 'privacy':
            title = '2. Privacy Policy (GDPR / CCPA Compliant)';
            body = `<p class="mb-3">Griffin Consulting Training Institute respects your privacy and is committed to protecting your personal data in accordance with GDPR and CCPA standards.</p>
                    <ul class="list-disc pl-5 space-y-2">
                        <li><strong>Data Collection:</strong> We collect personal information provided during registration, course enrollment, and progress tracking.</li>
                        <li><strong>Use of Data:</strong> Data is used solely to deliver training content, track certification progress, and improve platform functionality.</li>
                        <li><strong>User Rights:</strong> You retain the right to data export, review, and account deletion upon formal request.</li>
                    </ul>`;
            break;
        case 'ip':
            title = '3. Intellectual Property (IP) & Copyright Disclaimer';
            body = `<p class="mb-3">All hosted content—including text, video modules, facilitator guides, and software tools—is the exclusive property of Griffin Consulting Training Institute or its content licensors.</p>`;
            break;
        case 'outcomes':
            title = '4. Educational & Professional Outcome Disclaimer';
            body = `<p class="mb-3">Courses are designed for professional development and capacity building without guaranteed employment outcomes, promotions, or salary increases unless explicitly contracted.</p>`;
            break;
        case 'accessibility':
            title = '5. Accessibility & WCAG 2.1 AA Compliance';
            body = `<p class="mb-3">Committed to digital accessibility and WCAG 2.1 Level AA standards compliance across all user interfaces and documents.</p>`;
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
                    <button onclick="document.getElementById('legal-modal').classList.add('hidden')" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    modal.classList.remove('hidden');
};
