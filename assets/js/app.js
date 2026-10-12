import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://nfitvzrbaxsqemtayhft.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5maXR2enJiYXhzcWVtdGF5aGZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjQ3ODQ5NjIwNTN9.placeholder_key_sig'; // Replace with active anon key if needed

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global Authentication Guard
export async function checkAuth(requiredRole = 'student') {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = './index.html';
        return null;
    }

    const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*, tenants(*)')
        .eq('id', session.user.id)
        .single();

    if (profErr || !profile) {
        alert('User profile not found.');
        await supabase.auth.signOut();
        window.location.href = './index.html';
        return null;
    }

    if (requiredRole === 'admin' && profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN') {
        alert('Access denied: Administrator privileges required.');
        window.location.href = './student.html';
        return null;
    }

    return profile;
}

// Login Form Event Listener (if present on index.html)
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                alert('Sign In Failed: ' + error.message);
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

            if (profile && (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN')) {
                window.location.href = './admin.html';
            } else {
                window.location.href = './student.html';
            }
        });
    }
});

// Legal Modal Handlers
window.openLegalModal = function(type) {
    const modal = document.getElementById('legal-modal');
    const title = document.getElementById('legal-modal-title');
    const body = document.getElementById('legal-modal-body');
    if (!modal) return;

    title.textContent = type;
    body.innerHTML = `
        <p>Welcome to Griffin Consulting Training Institute. By accessing, registering for, or using our platform, you agree to comply with and be bound by these policies.</p>
        <ul class="list-disc pl-4 space-y-1 mt-2">
            <li><strong>Account Security:</strong> Users are responsible for maintaining confidentiality of credentials.</li>
            <li><strong>Acceptable Use:</strong> Misuse, unauthorized credential sharing, or malicious uploads are strictly prohibited.</li>
            <li><strong>Service Availability:</strong> We strive for high availability while conducting scheduled maintenance.</li>
        </ul>
    `;
    modal.classList.remove('hidden');
};

window.closeLegalModal = function() {
    const modal = document.getElementById('legal-modal');
    if (modal) modal.classList.add('hidden');
};
