import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://anwxrxievuluqsdjtaig.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K14cxWh7UoHcwGbpzFcKAg_McnHc9Hn';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global Auth Guard function for protected pages
export async function checkAuth(requiredRole) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = './index.html';
        return null;
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (!profile || (requiredRole && profile.role !== requiredRole)) {
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
            body = `<p class="mb-3">Welcome to the Griffin Consulting Learning Management System ("Platform"). By accessing, registering for, or using our platform, you agree to comply with and be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform.</p>
                    <ul class="list-disc pl-5 space-y-2">
                        <li><strong>Account Security:</strong> Users are responsible for maintaining the confidentiality of their account credentials and for all activities that occur under their account.</li>
                        <li><strong>Acceptable Use:</strong> Users agree not to misuse the platform, engage in unauthorized sharing of course credentials, upload malicious code, or harass instructors and peers.</li>
                        <li><strong>Service Availability:</strong> Griffin Consulting strives to maintain high availability but does not guarantee uninterrupted access to the platform. We reserve the right to modify, suspend, or discontinue any course or service at any time without notice.</li>
                        <li><strong>Account Termination:</strong> We reserve the right to suspend or terminate accounts that violate our acceptable use guidelines or intellectual property policies.</li>
                    </ul>`;
            break;
        case 'privacy':
            title = '2. Privacy Policy';
            body = `<p class="mb-3">Griffin Consulting respects your privacy and is committed to protecting your personal data in accordance with applicable data protection standards.</p>
                    <ul class="list-disc pl-5 space-y-2">
                        <li><strong>Data Collection:</strong> We collect personal information you provide during registration and course enrollment, including names, email addresses, course progress, quiz scores, and completion timestamps.</li>
                        <li><strong>Use of Data:</strong> Collected data is used solely to deliver training content, track certification progress, improve platform functionality, and communicate important updates regarding your courses.</li>
                        <li><strong>Third-Party Tools:</strong> We utilize secure third-party hosting and database infrastructure (such as Supabase and Netlify/GitHub Pages). We do not sell, rent, or trade your personal information to third parties.</li>
                    </ul>`;
            break;
        case 'ip':
            title = '3. Intellectual Property (IP) & Copyright Disclaimer';
            body = `<p class="mb-3">All content hosted on the Griffin Consulting LMS—including text, slide decks, video modules, facilitator guides, workbooks, and custom software tools—is the exclusive property of Griffin Consulting or its content licensors.</p>
                    <ul class="list-disc pl-5 space-y-2">
                        <li><strong>License Grant:</strong> Enrollment grants users a limited, non-exclusive, non-transferable, revocable license to access course materials for personal and professional development use only.</li>
                        <li><strong>Restrictions:</strong> Users may not copy, reproduce, distribute, republish, or create derivative works from platform content without explicit written permission from Griffin Consulting.</li>
                        <li><strong>DMCA Takedown Policy:</strong> If you believe that any material on our platform infringes upon your copyright, please submit a formal DMCA notice containing identification of the copyrighted work and your contact information to our compliance team.</li>
                    </ul>`;
            break;
        case 'outcomes':
            title = '4. Educational & Professional Outcome Disclaimer';
            body = `<p class="mb-3">The training courses, microlearning modules, and resources provided through the Griffin Consulting LMS are designed for professional development, skill enhancement, and organizational capacity building.</p>
                    <ul class="list-disc pl-5 space-y-2">
                        <li><strong>No Guarantee of Outcomes:</strong> Completion of courses or programs on this platform does not guarantee employment, promotion, salary increases, formal academic credit, or professional licensure, unless explicitly stated in a separate formal corporate or agency contract.</li>
                        <li><strong>Professional Application:</strong> Trainees and client organizations remain solely responsible for how they apply the concepts, strategies, and frameworks taught on the platform in real-world professional environments.</li>
                    </ul>`;
            break;
        case 'accessibility':
            title = '5. Accessibility & Third-Party Content Disclaimer';
            body = `<p class="mb-3">Griffin Consulting is committed to making digital learning accessible and compliant with modern usability standards (WCAG 2.1 Level AA).</p>
                    <ul class="list-disc pl-5 space-y-2">
                        <li><strong>Accessibility Commitment:</strong> We strive to ensure our platform and course materials meet high usability standards for all learners, including perceivable text alternatives, keyboard navigation, and robust assistive technology compatibility.</li>
                        <li><strong>External Links & Third-Party Content:</strong> Our platform may contain links to external websites, embedded third-party media, or references to external software. Griffin Consulting assumes no responsibility or liability for the content, privacy practices, or availability of third-party external resources.</li>
                    </ul>`;
            break;
    }

    // Create or show modal element
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
