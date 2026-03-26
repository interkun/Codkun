/**
 * js/app.js - Advanced App Shell & Router
 */
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const routes = {
    '#login': { 
        file: 'pages/login.html', 
        title: 'CloudWeaver | Login', 
        module: './pages/login.js' 
    },
    '#dashboard': { 
        file: 'pages/dashboard.html', 
        title: 'CloudWeaver | Dashboard', 
        module: './pages/dashboard.js' 
    }
};

const appState = {
    user: null,
    activeModule: null
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Listen for Authentication Changes
    onAuthStateChanged(auth, (user) => {
        const authStatus = document.getElementById('auth-status');
        if (user) {
            appState.user = user;
            authStatus.innerText = user.email.split('@')[0]; // Show username
            authStatus.className = "text-xs font-bold text-green-600 mr-2 border border-green-600 px-2 py-1 rounded";
            
            if (!window.location.hash || window.location.hash === '#login') {
                window.location.hash = '#dashboard';
            }
        } else {
            appState.user = null;
            authStatus.innerText = "Offline";
            authStatus.className = "text-xs font-bold text-red-500 mr-2 border border-red-500 px-2 py-1 rounded";
            window.location.hash = '#login';
        }
        handleRoute();
    });

    window.addEventListener('hashchange', handleRoute);
    setupShellListeners();
});

// 2. The Router Engine
async function handleRoute() {
    const hash = window.location.hash || '#login';
    const route = routes[hash];

    if (!route) return;

    // Auth Guard: Agar user login nahi hai aur dashboard par jana chahta hai
    if (!appState.user && hash !== '#login') {
        window.location.hash = '#login';
        return;
    }

    document.title = route.title;
    const appRoot = document.getElementById('app-root');
    appRoot.innerHTML = `<div class="flex items-center justify-center w-full h-full text-gray-400"><i class="fas fa-spinner fa-spin text-3xl"></i></div>`;

    try {
        const response = await fetch(route.file);
        const html = await response.text();
        appRoot.innerHTML = html;

        // Dynamic Module Loading
        if (route.module) {
            const pageModule = await import(route.module);
            if (pageModule.init) {
                // Pass user and db to the module so it can fetch private data
                pageModule.init(appState.user, db);
                appState.activeModule = pageModule;
            }
        }
    } catch (err) {
        console.error("Routing Error:", err);
        appRoot.innerHTML = `<div class="p-5 text-red-500">Error loading interface.</div>`;
    }
}

// 3. Global UI Listeners (Bridging Shell to Module)
function setupShellListeners() {
    const menuBtn = document.getElementById('menuBtn');
    const overlay = document.getElementById('overlay');
    const sidebar = document.getElementById('sidebar');

    const toggleSidebar = () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    };

    menuBtn.onclick = toggleSidebar;
    overlay.onclick = toggleSidebar;

    // Connect Shell Footer Buttons to the Active Dashboard Module
    document.getElementById('undoBtn').onclick = () => { if(appState.activeModule?.undo) appState.activeModule.undo(); };
    document.getElementById('redoBtn').onclick = () => { if(appState.activeModule?.redo) appState.activeModule.redo(); };
    document.getElementById('searchToggleBtn').onclick = () => { if(appState.activeModule?.toggleSearch) appState.activeModule.toggleSearch(); };
    document.getElementById('beautifyBtn').onclick = () => { if(appState.activeModule?.format) appState.activeModule.format(); };
    document.getElementById('globalRunBtn').onclick = () => { if(appState.activeModule?.run) appState.activeModule.run(); };
    
    // Logout Logic
    document.getElementById('userProfileBtn').onclick = () => {
        if(confirm("Do you want to logout?")) signOut(auth);
    };
}