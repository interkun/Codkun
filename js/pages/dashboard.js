/**
 * js/pages/dashboard.js
 * Infinite Nested Folders + Scrolling Fix + Eruda Console
 */
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let editor;
let currentUser;
let currentDb;
let fileSystem = {};
let currentFile = 'index.html';
let searchCursor = null;

// ==========================================
// 1. INITIALIZATION & SCROLL FIX
// ==========================================
export async function init(user, db) {
    currentUser = user;
    currentDb = db;
    
    // CodeMirror Initialization
    editor = window.CodeMirror.fromTextArea(document.getElementById('code-editor'), {
        lineNumbers: true,
        theme: 'default',
        autoCloseTags: true,
        autoCloseBrackets: true,
        styleActiveLine: true,
        lineWrapping: false,
        indentUnit: 4,
        gutters: ["CodeMirror-lint-markers"],
        lint: true 
    });

    // SCROLLING FIX: Forcing CodeMirror to take full height and allow scroll
    setTimeout(() => {
        editor.setSize("100%", "100%");
        const cmScroll = document.querySelector('.CodeMirror-scroll');
        const cmCore = document.querySelector('.CodeMirror');
        if (cmScroll && cmCore) {
            cmScroll.style.overflowY = 'auto';
            cmScroll.style.overflowX = 'auto';
            cmCore.style.height = '100%';
            cmCore.style.position = 'absolute'; // Fixes flexbox bug
        }
        editor.refresh();
    }, 100);

    await loadUserWorkspace();
    setupEditorListeners();
    setupSearchAndButtons();
}

// ==========================================
// 2. FIREBASE SYNC LOGIC
// ==========================================
async function loadUserWorkspace() {
    try {
        const docRef = doc(currentDb, "workspaces", currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().files) {
            fileSystem = docSnap.data().files;
        } else {
            // First time default files
            fileSystem = {
                'index.html': { mode: 'htmlmixed', content: '<!DOCTYPE html>\n<html>\n<head>\n  <link rel="stylesheet" href="css/style.css">\n</head>\n<body>\n  <h1>Infinite Folders Ready! 🚀</h1>\n  <script src="js/app.js"><\/script>\n</body>\n</html>' },
                'css/style.css': { mode: 'css', content: 'body { text-align: center; padding: 20px; }' },
                'js/app.js': { mode: 'javascript', content: 'console.log("Eruda console loaded!");' }
            };
            saveToCloud();
        }
        
        loadIntoEditor(Object.keys(fileSystem)[0] || 'index.html');
        renderSidebarTree();
        
    } catch (error) {
        console.error("Error loading workspace:", error);
    }
}

async function saveToCloud() {
    const saveIndicator = document.getElementById('saveIndicator');
    if(saveIndicator) {
        saveIndicator.classList.remove('hidden');
        saveIndicator.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Saving...';
    }
    try {
        await setDoc(doc(currentDb, "workspaces", currentUser.uid), { files: fileSystem }, { merge: true });
        if(saveIndicator) {
            saveIndicator.innerHTML = '<i class="fas fa-check-circle mr-1"></i>Saved';
            setTimeout(() => saveIndicator.classList.add('hidden'), 2000);
        }
    } catch (error) {
        console.error("Save failed", error);
    }
}

// ==========================================
// 3. EDITOR & INFINITE CREATION LOGIC
// ==========================================
function loadIntoEditor(filepath) {
    currentFile = filepath;
    const fileData = fileSystem[filepath];
    
    document.getElementById('headerFileName').innerText = filepath.split('/').pop();
    
    editor.setOption('mode', fileData.mode);
    editor.setValue(fileData.content || "");
    
    renderTabs();
    setTimeout(() => editor.refresh(), 50);
}

function setupEditorListeners() {
    let syncTimeout;
    editor.on('change', () => {
        if(fileSystem[currentFile]) {
            fileSystem[currentFile].content = editor.getValue();
            clearTimeout(syncTimeout);
            syncTimeout = setTimeout(() => saveToCloud(), 1500);
        }
    });

    // Root Level Creation
    document.getElementById('newFileBtn').onclick = () => createNewItem('file', '');
    document.getElementById('newFolderBtn').onclick = () => createNewItem('folder', '');

    document.getElementById('selectAllBtn').onclick = () => { editor.execCommand("selectAll"); editor.focus(); };
    document.getElementById('copyBtn').onclick = () => { navigator.clipboard.writeText(editor.getValue()); alert("Code Copied!"); };
}

// Universal Item Creator (Handles deep nesting)
function createNewItem(type, basePath = "") {
    let promptMsg = type === 'folder' ? "Folder Name:" : "File Name (e.g., app.js):";
    let name = prompt(basePath ? `Create inside '${basePath}'\n${promptMsg}` : promptMsg);
    
    if (!name) return;
    name = name.replace(/\//g, ''); // Prevent slashes in name
    
    let fullPath = basePath ? `${basePath}/${name}` : name;

    if (type === 'folder') {
        let keepPath = `${fullPath}/.keep`;
        if(fileSystem[keepPath]) return alert("Folder already exists!");
        fileSystem[keepPath] = { mode: 'xml', content: '' };
    } else {
        if(fileSystem[fullPath]) return alert("File already exists!");
        let mode = 'htmlmixed';
        if(name.endsWith('.js')) mode = 'javascript';
        if(name.endsWith('.css')) mode = 'css';
        fileSystem[fullPath] = { mode, content: '' };
        loadIntoEditor(fullPath);
    }

    renderSidebarTree();
    saveToCloud();
}

// ==========================================
// 4. INFINITE NESTED TREE VISUALIZER (Recursive Algorithm)
// ==========================================
function renderTabs() {
    const tabsContainer = document.getElementById('headerTabs');
    if(!tabsContainer) return;
    tabsContainer.innerHTML = '';
    
    Object.keys(fileSystem).forEach(filepath => {
        if(filepath.endsWith('.keep')) return; 
        const tab = document.createElement('div');
        tab.className = `h-tab ${filepath === currentFile ? 'active' : ''}`;
        tab.innerText = filepath.split('/').pop();
        tab.onclick = () => loadIntoEditor(filepath);
        tabsContainer.appendChild(tab);
    });
}

function renderSidebarTree() {
    const treeContainer = document.getElementById('fileTree');
    if(!treeContainer) return;
    treeContainer.innerHTML = '';
    
    // Step 1: Build a hierarchical object from flat paths
    const treeData = {};
    Object.keys(fileSystem).forEach(filepath => {
        const parts = filepath.split('/');
        let current = treeData;
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                if (part !== '.keep') current[part] = { type: 'file', path: filepath, name: part };
            } else {
                if (!current[part]) current[part] = { type: 'folder', path: parts.slice(0, i+1).join('/'), name: part, children: {} };
                current = current[part].children;
            }
        }
    });

    // Step 2: Recursive render function
    function createTreeNode(nodeObj, container) {
        // Sort folders first, then files
        const keys = Object.keys(nodeObj).sort((a, b) => {
            const typeA = nodeObj[a].type;
            const typeB = nodeObj[b].type;
            if (typeA === typeB) return a.localeCompare(b);
            return typeA === 'folder' ? -1 : 1;
        });

        keys.forEach(key => {
            const node = nodeObj[key];
            const div = document.createElement('div');
            
            if (node.type === 'folder') {
                div.className = 'flex flex-col mt-1';
                // Folder Header
                const header = document.createElement('div');
                header.className = 'flex justify-between items-center px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded group cursor-pointer border-l-2 border-transparent hover:border-yellow-400';
                header.innerHTML = `
                    <span class="text-xs font-bold text-gray-700 truncate"><i class="fas fa-folder text-yellow-500 mr-2"></i>${node.name}</span>
                    <div class="hidden group-hover:flex gap-1">
                        <button class="text-gray-400 hover:text-blue-600 p-1" title="Add File"><i class="fas fa-file-medical"></i></button>
                        <button class="text-gray-400 hover:text-green-600 p-1" title="Add Folder"><i class="fas fa-folder-plus"></i></button>
                        <button class="text-gray-400 hover:text-red-500 p-1" title="Delete Folder"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                
                // Attach Folder Actions
                const btns = header.querySelectorAll('button');
                btns[0].onclick = (e) => { e.stopPropagation(); createNewItem('file', node.path); };
                btns[1].onclick = (e) => { e.stopPropagation(); createNewItem('folder', node.path); };
                btns[2].onclick = (e) => {
                    e.stopPropagation();
                    if(confirm(`Delete folder '${node.name}' and EVERYTHING inside it?`)) {
                        Object.keys(fileSystem).forEach(p => {
                            if(p.startsWith(node.path + '/')) delete fileSystem[p]; // Delete nested contents
                        });
                        delete fileSystem[`${node.path}/.keep`];
                        saveToCloud();
                        renderSidebarTree();
                        
                        // Load fallback file if current deleted
                        const remaining = Object.keys(fileSystem).filter(k => !k.endsWith('.keep'));
                        if(!remaining.includes(currentFile) && remaining.length > 0) loadIntoEditor(remaining[0]);
                    }
                };
                
                div.appendChild(header);

                // Nested Children Container (Indented)
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'flex flex-col border-l border-gray-300 ml-3 pl-2 mt-1';
                createTreeNode(node.children, childrenContainer);
                div.appendChild(childrenContainer);

            } else {
                // File Node
                div.className = `flex justify-between items-center px-2 py-1.5 rounded cursor-pointer text-sm my-0.5 group ${node.path === currentFile ? 'bg-blue-50 text-blue-600 font-bold border-l-2 border-blue-500' : 'text-gray-700 hover:bg-gray-100 border-l-2 border-transparent'}`;
                let icon = 'fa-html5 text-orange-500';
                if(node.name.endsWith('.js')) icon = 'fa-js text-yellow-500';
                if(node.name.endsWith('.css')) icon = 'fa-css3 text-blue-500';

                div.innerHTML = `
                    <span class="truncate"><i class="fab ${icon} w-5 text-center"></i> ${node.name}</span>
                    <i class="fas fa-trash text-gray-300 hover:text-red-500 p-1 hidden group-hover:block"></i>
                `;
                
                div.onclick = () => { loadIntoEditor(node.path); document.getElementById('menuBtn').click(); };
                
                // Delete File
                div.querySelector('.fa-trash').onclick = (e) => {
                    e.stopPropagation();
                    if(Object.keys(fileSystem).filter(k => !k.endsWith('.keep')).length <= 1) return alert("Can't delete last file.");
                    if(confirm(`Delete ${node.name}?`)) {
                        delete fileSystem[node.path];
                        const remaining = Object.keys(fileSystem).filter(k => !k.endsWith('.keep'));
                        if(remaining.length > 0) loadIntoEditor(remaining[0]);
                        renderSidebarTree();
                        saveToCloud();
                    }
                };
            }
            container.appendChild(div);
        });
    }

    // Start rendering from root
    createTreeNode(treeData, treeContainer);
}

// ==========================================
// 5. FIND & REPLACE (Perfected)
// ==========================================
export function toggleSearch() {
    const searchBar = document.getElementById('floating-search-bar');
    searchBar.classList.toggle('hidden');
    if(!searchBar.classList.contains('hidden')) {
        document.getElementById('findInput').focus();
    }
}

function setupSearchAndButtons() {
    const findInput = document.getElementById('findInput');
    const replaceInput = document.getElementById('replaceInput');

    function performSearch(reverse) {
        const query = findInput.value;
        if(!query) return;
        
        if(!searchCursor || searchCursor.query !== query) searchCursor = editor.getSearchCursor(query);
        
        let found = reverse ? searchCursor.findPrevious() : searchCursor.findNext();
        if(!found) {
            searchCursor = editor.getSearchCursor(query); 
            found = reverse ? searchCursor.findPrevious() : searchCursor.findNext();
        }
        
        if(found) {
            editor.setSelection(searchCursor.from(), searchCursor.to());
            editor.scrollIntoView({from: searchCursor.from(), to: searchCursor.to()}, 100);
            editor.focus();
        }
    }

    document.getElementById('findNext').onclick = () => performSearch(false);
    document.getElementById('findPrev').onclick = () => performSearch(true);
    document.getElementById('replaceBtn').onclick = () => {
        if(searchCursor && searchCursor.from()) {
            searchCursor.replace(replaceInput.value);
            performSearch(false);
        }
    };
    document.getElementById('closeSearchBtn').onclick = toggleSearch;

    // Overlay Close
    document.getElementById('closePreviewBtn').onclick = () => {
        document.getElementById('fullscreen-preview').classList.add('hidden');
    };
    
    // External Run Window
    document.getElementById('previewNewWindowBtn').onclick = () => {
        const finalCode = getCompiledCode();
        const newWindow = window.open('', '_blank');
        newWindow.document.open();
        newWindow.document.write(finalCode);
        newWindow.document.close();
        newWindow.document.title = "CloudWeaver App";
    };
}

// ==========================================
// 6. EXPORTS (Format, Undo, Redo, Run)
// ==========================================
export function undo() { editor.undo(); }
export function redo() { editor.redo(); }

export function format() {
    const ext = currentFile.split('.').pop();
    try {
        if(ext === 'html') editor.setValue(html_beautify(editor.getValue(), { indent_size: 4 }));
        if(ext === 'css') editor.setValue(css_beautify(editor.getValue(), { indent_size: 4 }));
        if(ext === 'js') editor.setValue(js_beautify(editor.getValue(), { indent_size: 4 }));
    } catch(e) {}
}

function getCompiledCode() {
    let htmlCode = fileSystem['index.html'] ? fileSystem['index.html'].content : '<h1>No index.html</h1>';
    
    // Inject Eruda
    const erudaScript = `<script src="https://cdn.jsdelivr.net/npm/eruda"><\/script><script>eruda.init();<\/script>`;
    if (htmlCode.includes('</head>')) htmlCode = htmlCode.replace('</head>', erudaScript + '</head>');
    else htmlCode = erudaScript + htmlCode;

    // Combine resources (Handles deep paths dynamically)
    Object.keys(fileSystem).forEach(fname => {
        if(fname.endsWith('.css')) htmlCode = htmlCode.replace(new RegExp(`<link[^>]*href=["']${fname}["'][^>]*>`, 'gi'), `<style>${fileSystem[fname].content}</style>`);
        if(fname.endsWith('.js')) htmlCode = htmlCode.replace(new RegExp(`<script[^>]*src=["']${fname}["'][^>]*><\\/script>`, 'gi'), `<script>${fileSystem[fname].content}<\/script>`);
    });
    
    return htmlCode;
}

export function run() {
    document.getElementById('fullscreen-preview').classList.remove('hidden');
    const finalCode = getCompiledCode();
    const frame = document.getElementById('preview-iframe');
    const doc = frame.contentDocument || frame.contentWindow.document;
    doc.open(); doc.write(finalCode); doc.close();
}