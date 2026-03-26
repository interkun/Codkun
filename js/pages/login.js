// js/pages/login.js
import { auth } from '../firebase.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

let isSignUpMode = false;

// app.js is function ko automatically call karega jab login page load hoga
export function init() {
    const form = document.getElementById('login-form');
    const switchBtn = document.getElementById('auth-switch-btn');
    const submitBtn = document.getElementById('auth-submit-btn');
    const title = document.getElementById('auth-title');
    const switchText = document.getElementById('auth-switch-text');
    const errorDiv = document.getElementById('auth-error');

    // 1. Switch Mode (Sign In <-> Sign Up)
    switchBtn.onclick = (e) => {
        e.preventDefault();
        isSignUpMode = !isSignUpMode;
        
        title.innerText = isSignUpMode ? "Create Account" : "Welcome Back";
        submitBtn.querySelector('span').innerText = isSignUpMode ? "Register Now" : "Sign In";
        switchText.innerText = isSignUpMode ? "Already have an account?" : "Don't have an account?";
        switchBtn.innerText = isSignUpMode ? "Sign In" : "Create Account";
        errorDiv.classList.add('hidden');
    };

    // 2. Form Submission
    form.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
        errorDiv.classList.add('hidden');

        try {
            if (isSignUpMode) {
                await createUserWithEmailAndPassword(auth, email, password);
                alert("Account created! Welcome to Chatkun.");
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            // Login hote hi onAuthStateChanged (app.js) dashboard par bhej dega
        } catch (error) {
            console.error(error);
            errorDiv.innerText = error.message.replace("Firebase: ", "");
            errorDiv.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>${isSignUpMode ? "Register Now" : "Sign In"}</span> <i class="fas fa-arrow-right text-xs"></i>`;
        }
    };
}