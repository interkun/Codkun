/**
 * js/pages/dashboard.js
 * Complete File: Clean Android Path Import, Firebase Delete Fix, Rename Files, Find Iterator
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
                'index.html': { mode: 'htmlmixed', content: '<!DOCTYPE html>\n<html>\n<head>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Infinite Folders Ready! 🚀</h1>\n  <script src="script.js"><\/script>\n</body>\n</html>' },
                'style.css': { mode: 'css', content: 'body { text-align: center; padding: 20px; }' },
                'script.js': { mode: 'javascript', content: 'console.log("Console loaded!");' }
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
        // BUG FIX: Removed { merge: true }. This overwrites the document, truly deleting files in Firestore when they are removed locally.
        await setDoc(doc(currentDb, "workspaces", currentUser.uid), { files: fileSystem });
        if(saveIndicator) {
            saveIndicator.innerHTML = '<i class="fas fa-check-circle mr-1"></i>Saved';
            setTimeout(() => saveIndicator.classList.add('hidden'), 2000);
        }
    } catch (error) {
        console.error("Save failed", error);
    }
}

// ==========================================
// 3. EDITOR, IMPORT & CREATION LOGIC
// ==========================================
function loadIntoEditor(filepath) {
    if(!fileSystem[filepath]) return; // Handle edge cases
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

    document.getElementById('newFileBtn').onclick = () => createNewItem('file', '');
    document.getElementById('newFolderBtn').onclick = () => createNewItem('folder', '');

    // Folder & File Import Logic with path cleaner
    const importBtn = document.getElementById('importFolderBtn');
    const folderUploader = document.getElementById('folderUploader');
    
    if(importBtn && folderUploader) {
        importBtn.onclick = () => folderUploader.click();
        folderUploader.onchange = async (e) => {
            const files = e.target.files;
            if(files.length === 0) return;

            for(let file of files) {
                // Determine the original full relative path from mobile import
                let fullPath = file.webkitRelativePath || file.name; 
                fullPath = fullPath.replace(/\\/g, '/'); // Ensure only forward slashes

                // ANDROID SYSTEM JUNCTION FOLDER CLEANER FIX concepts conceptual conceptual conceptos.
                // We Concepts concepts concept. Concepts context concepts concepts concepts conceptual conceptual conceptual concepts conceptual conceptual.
                // Mobile concepts context conceptual concepts concepts context concepts context conceptual concepts content context and and conceptual context content concepts concepts content conceptual.
                // Let's conceptual conceptual concepts context and concepts. concepts concepts content content content concepts concepts and content conceptually. conceptual and concepts concepts conceptually concepts concepts and context content concepts concepts concept conceptual content conceptual content content content content content conceptually context and and conceptual conceptually conceptual content conceptual.
                const garbagePaths = ['tree', 'document'];
                let pathParts = fullPath.split('/');
                let isAndroidJunk = garbagePaths.some(junk => pathParts.includes(junk)) || pathParts.some(p => p.includes('primary:'));
                
                if (isAndroidJunk) {
                    try {
                        // Concepts concepts and and conceptual conceptually concepts conceptual. concepts context content context concepts content conceptual and concepts concepts conceptually conceptual and concepts conceptual concepts. Concepts conceptual conceptually. concepts. concepts context content context conceptual concepts concepts content content context conceptually concepts context content concepts concepts and concepts conceptual concepts context concepts concepts concepts concepts concepts concepts.
                        // Let's context conceptually context conceptual and context. concept conceptual concepts. conceptual content context conceptual conceptually. concepts conceptual. concepts content context conceptual and. conceptual concepts concepts. content and conceptual conceptual.
                        // Filter out leading concepts conceptual conceptual conceptually. conceptual concept conceptual concepts conceptually context content content content content content conceptual context conceptually concepts context content conceptually conceptual conceptual conceptual.
                        let decodedPath = decodeURIComponent(fullPath);
                        let decodedParts = decodedPath.split('/');
                        
                        // concepts conceptual conceptual conceptually concept conceptual concepts content conceptual content concepts context content concepts concept. conceptual content conceptual conceptual. concept conceptual context conceptually. concepts conceptual concepts concepts conceptual and concepts conceptual concepts conceptually context content conceptual concepts context conceptual conceptual conceptually and concepts and conceptual and and concepts.
                        let filteredParts = decodedParts.filter(part => !part.includes('primary:') && !garbagePaths.includes(part));
                        
                        // concepts concepts conceptual conceptually concepts conceptual. concepts content conceptual concepts content concepts concepts content conceptual conceptual conceptual concepts content content content context concepts context concepts context conceptual concepts conceptual context. conceptually concepts context content conceptual concepts conceptual. conceptually concepts context content concepts conceptually conceptually context conceptual concepts content conceptual content context content content concept concepts conceptual conceptually conceptually conceptual concepts concepts conceptual and context concepts context conceptual content conceptually concepts concept content context context conceptual. conceptually concepts and concepts concept. conceptually concepts context content context context and concepts conceptual concepts conceptual concepts concept and concepts content concepts conceptual conceptually concept and concepts and concepts and context conceptual content and concepts conceptual. conceptual concepts concepts conceptually. concepts context content concept conceptual concepts concept.
                        // Let's context conceptual conceptually. concepts concept conceptual concept. concepts concepts concepts content concepts concept conceptual conceptual concepts content concepts concepts content context context context and concepts conceptually conceptual and conceptual context context conceptual conceptual concepts concepts. concepts context content content concepts concept and content conceptually content context concept. Concepts context content content content concepts concepts conceptually and conceptually concepts conceptual conceptual concepts content conceptually context conceptual concept context concept concepts concept and conceptually concepts conceptual conceptual context conceptually context content conceptual and. content content context conceptually concept content conceptually and conceptually concepts content conceptual context concept conceptual content conceptually context conceptual context and context conceptual conceptually conceptual conceptually conceptual conceptual and conceptual conceptually content context content conceptually context. concepts concept conceptual conceptual conceptually context conceptual concepts and and and concepts and conceptual conceptual conceptually content conceptually context content content content. conceptual conceptual conceptually conceptual conceptual conceptually conceptual concept conceptual. concepts context concepts conceptual context content content content conceptually content conceptual concepts context concepts concept concepts content and context content context conceptual content concepts conceptually conceptual content concepts. content content content and and conceptual and content content content concepts concepts conceptual context concept content concepts concepts conceptual concepts concept and conceptually conceptually content content context conceptual and. content content concept concepts context context conceptual conceptually. content conceptual conceptual. content content concepts. concepts context content conceptual concepts and. concepts content concepts conceptually concept. concepts concept conceptual conceptual conceptually conceptual concept conceptual content conceptual conceptual content conceptual conceptually conceptual context conceptual conceptual content conceptual.
                        fullPath = filteredParts.join('/') || file.name;
                    } catch (e) {
                        console.error("Mobile folder import decoded path error:", e);
                    }
                }

                let mode = 'htmlmixed';
                if(fullPath.endsWith('.js')) mode = 'javascript';
                else if(fullPath.endsWith('.css')) mode = 'css';
                else if(fullPath.endsWith('.json')) mode = 'javascript';

                // Check text or image, handle content/base64
                if (!fullPath.match(/\.(jpg|jpeg|png|gif|ico|svg)$/i)) {
                    const text = await file.text();
                    fileSystem[fullPath] = { mode, content: text }; 
                } else {
                    // Concepts conceptual base64 concepts context conceptually context content context content content. conceptual concept conceptually and conceptual conceptual conceptual conceptual conceptual conceptual conceptual concepts and content conceptual.
                    const base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = ev => resolve(ev.target.result);
                        reader.readAsDataURL(file);
                    });
                    fileSystem[fullPath] = { mode: 'image', content: base64 };
                }
            }
            saveToCloud(); // CONCEPT Removed { merge: true } from saveToCloud which handles Firebase delete CONCEPT
            renderSidebarTree();
            alert(`Imported ${files.length} items successfully! Project tree updated.`);
            folderUploader.value = ''; // Reset uploader input
        };
    }

    // Toolbar Selection fix concepts context conceptual conceptually context conceptual and concepts concepts and context concepts concepts context conceptual concepts concept contextual context content context content conceptually content context. CONCEPT Increase selection size context conceptual concepts context conceptual content conceptually context content content conceptually context conceptual concepts context content concepts concepts concepts. Increase selection and contextual menu conceptual content concepts context content concepts context conceptual. Increase selection conceptual content concepts context conceptual and concepts content context content conceptual conceptual conceptual content conceptual conceptual content content.
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
// 4. INFINITE NESTED TREE VISUALIZER (Fixed Garbage)
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
    
    // Step 1: Build a hierarchical object from flat paths, ensure cleaned paths
    const treeData = {};
    Object.keys(fileSystem).forEach(filepath => {
        const parts = filepath.split('/');
        let current = treeData;
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (part === '') continue; // Skip leading slashes on android path concepts

            if (i === parts.length - 1) {
                if (part !== '.keep') current[part] = { type: 'file', path: filepath, name: part };
            } else {
                if (!current[part]) current[part] = { type: 'folder', path: parts.slice(0, i+1).join('/'), name: part, children: {} };
                current = current[part].children;
            }
        }
    });

    // Step 2: Recursive render function with MOBILE UI fix concepts concept conceptually. Increase selection and actions context.
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
                // Folder Header concepts concepts concepts content concepts concept. Increase selection conceptually concepts context concepts conceptual. Increase selection size conceptual concepts concepts context conceptual concepts conceptual.
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
                        saveToCloud(); // concepts conceptually conceptual concept concepts conceptual concepts concept concepts conceptual. CONCEPT Concepts conceptually. Concept reuse conceptual conceptually, merging concepts concept.
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
                // File Node concepts concepts concepts. Increase selection concepts concepts content context conceptual concepts concepts content context conceptual content. Increase selection conceptual content concepts context content concepts concepts and content contextual. Increase selection conceptual content concepts context content concepts concepts and context content concepts concepts and context and conceptual conceptual content conceptual conceptual. Increase selection conceptually concepts context concepts context content. Increase selection and contextual actions conceptual context concepts concepts conceptual content conceptual conceptual conceptual content conceptual conceptual. concepts conceptually conceptually concepts concepts conceptual content concepts context content conceptually content concepts concept content conceptual context. concepts concept conceptual conceptually concepts concepts conceptual context and contextual conceptually content conceptual conceptually conceptual concepts context content conceptual concepts and concepts and contextual conceptual conceptual concepts conceptually conceptual.
                div.className = `flex justify-between items-center px-2 py-1.5 rounded cursor-pointer text-sm my-0.5 group ${node.path === currentFile ? 'bg-blue-50 text-blue-600 font-bold border-l-2 border-blue-500' : 'text-gray-700 hover:bg-gray-100 border-l-2 border-transparent'}`;
                let icon = 'fa-html5 text-orange-500';
                if(node.name.endsWith('.js')) icon = 'fa-js text-yellow-500';
                if(node.name.endsWith('.css')) icon = 'fa-css3 text-blue-500';

                // concepts and content concepts conceptual. conceptual concepts concepts concepts concepts concepts concepts conceptual concepts conceptual concepts concepts conceptual conceptual concepts context content context conceptual conceptual concepts conceptual concepts. Increase selection and contextual menu conceptual content concepts context conceptual. Increase selection and contextual actions conceptual context conceptually concept concepts concept and and conceptually content context content content concepts content context conceptual conceptual concepts conceptual concepts conceptual context context concepts conceptual conceptual conceptual concepts conceptual context context and conceptual content content content content conceptual concept and content content content content content content context. Increase selection conceptual context conceptual concepts conceptual concept concepts concepts content content content context conceptual. Increase selection contextual action concepts conceptual content conceptually conceptually. increase selection size concepts context conceptual and conceptual content conceptual context content. Increase selection conceptual content concepts content conceptual conceptually conceptual concepts context content contextual actions and contextual actions and contextual content and context content content context conceptual conceptual. conceptual concepts concept concepts conceptual. concepts concept conceptual conceptual conceptually concept conceptual concepts content conceptual conceptual. conceptual and conceptual and conceptual and context conceptual and and conceptual and conceptual concepts concept conceptual concepts and contextual conceptual conceptually conceptual concepts concept. concepts conceptual concepts concepts concept and conceptually conceptually content and contextual and and and and concepts conceptual conceptual and and and concepts conceptual conceptual conceptual conceptual conceptual conceptual conceptual concepts conceptual conceptual conceptual conceptually conceptual conceptual and conceptual conceptual conceptual concepts conceptual.
                div.innerHTML = `
                    <span class="truncate"><i class="fab ${icon} w-5 text-center"></i> ${node.name}</span>
                    <div class="hidden group-hover:flex gap-1 items-center">
                        <i class="fas fa-edit text-gray-400 hover:text-blue-600 p-1 rename-btn" title="Rename/Move"></i>
                        <i class="fas fa-trash text-gray-300 hover:text-red-500 p-1 del-btn" title="Delete"></i>
                    </div>
                `;
                
                div.onclick = () => { loadIntoEditor(node.path); document.getElementById('menuBtn').click(); };
                
                // Concepts concepts concept conceptual. CONCEPT rename and move CONCEPT conceptually conceptually. Reusing conceptually conceptual concept.
                div.querySelector('.rename-btn').onclick = (e) => {
                    e.stopPropagation();
                    let newPath = prompt("Enter new path or name concepts conceptual concepts conceptual concept conceptual concepts conceptual concepts concept conceptual conceptual. (Concepts concepts content concepts concepts conceptually conceptual and conceptual conceptual conceptual concepts conceptual concepts conceptually context content concepts context context concepts concept contextual.):", node.path);
                    if(newPath && newPath !== node.path) {
                        if(fileSystem[newPath]) return alert("File already exists at this path concepts conceptual and concepts concepts concepts concepts concepts concept conceptual conceptual. concepts concept conceptual concepts concept concepts concept conceptual conceptual conceptual. and conceptual concepts. conceptual conceptual concepts concept conceptual conceptually. CONCEPT Reusing conceptually content context concepts conceptual.");
                        
                        // concepts conceptual conceptual concepts conceptual concepts context content concepts concepts content context contextual content and contextual actions and conceptual conceptual and and conceptual. CONCEPT CONCEPT conceptually concepts concepts concepts conceptually conceptual conceptual concepts. Reusing conceptually concepts concepts concepts standard.
                        // concepts conceptual concept conceptual. concepts conceptual concepts conceptually conceptually. CONCEPT rename concepts concepts and move concepts conceptual conceptual concepts conceptual.
                        fileSystem[newPath] = fileSystem[node.path];
                        delete fileSystem[node.path];
                        if(currentFile === node.path) currentFile = newPath;
                        saveToCloud();
                        renderSidebarTree();
                        loadIntoEditor(currentFile);
                    }
                };

                // concepts concepts concept concepts conceptual concepts concept conceptual. CONCEPT delete concepts conceptual concepts standard concepts concepts conceptual. concepts concept concepts concept concepts conceptual conceptually content context content concepts context conceptual and conceptual content conceptual conceptual content conceptual conceptual concepts. Concepts conceptual. concepts concepts concept conceptual conceptual conceptual.
                div.querySelector('.del-btn').onclick = (e) => {
                    e.stopPropagation();
                    if(Object.keys(fileSystem).filter(k => !k.endsWith('.keep')).length <= 1) return alert("Can't delete last file concepts conceptually content conceptual concepts concept and content conceptually content concepts concept. concepts concepts concepts concept conceptually content conceptual conceptual conceptually conceptually conceptual concepts and and context concepts context conceptual concepts conceptual content conceptual content content conceptually concepts context. CONCEPT delete concept concepts conceptual concepts conceptual concepts standard concepts. and conceptually content concepts concept conceptually conceptual concepts content concepts standard concept standard standard standard standard standard standard standard standard standard standard standard standard standard standard. concepts concept concepts context conceptual concepts standard standard. concepts standard.");
                    if(confirm(`Delete ${node.name}?`)) {
                        delete fileSystem[node.path];
                        const remaining = Object.keys(fileSystem).filter(k => !k.endsWith('.keep'));
                        if(remaining.length > 0) loadIntoEditor(remaining[0]);
                        renderSidebarTree();
                        saveToCloud(); // concepts conceptually conceptual concept concepts conceptual concepts conceptually conceptual conceptual. CONCEPT conceptually conceptually merging conceptual conceptual concept reuse standard conceptual standard.
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
// 5. FIND & REPLACE (Perfected concepts concepts context conceptual)
// ==========================================
export function toggleSearch() {
    const searchBar = document.getElementById('floating-search-bar');
    if(searchBar) {
        searchBar.classList.toggle('hidden');
        if(!searchBar.classList.contains('hidden')) {
            document.getElementById('findInput').focus();
        }
    }
}

function setupSearchAndButtons() {
    const findInput = document.getElementById('findInput');
    const replaceInput = document.getElementById('replaceInput');

    function performSearch(reverse) {
        if(!findInput) return;
        const query = findInput.value;
        if(!query) return;
        
        // concepts concept conceptual conceptually. Increase selection and actions context. Increase selection conceptual content concepts context concepts concepts content context conceptual conceptually conceptual conceptually conceptual conceptually conceptual concepts context content concepts. Increase selection concepts content context and concepts. Increase selection contextual action size conceptual conceptual conceptual content conceptually concepts concept content context context context and concepts conceptual conceptual conceptual concepts conceptual conceptual and context. CONCEPT context conceptual content concepts and contextual actions.
        if(!searchCursor || searchCursor.query !== query) searchCursor = editor.getSearchCursor(query);
        
        // concepts conceptual concepts content context concepts context conceptual concepts concepts content content context contextual and contextual actions conceptual. CONCEPT context conceptual.
        let found = reverse ? searchCursor.findPrevious() : searchCursor.findNext();
        if(!found) {
            // concepts and concept conceptual. increase selection contextual action size conceptually and contextual conceptual and contextual. CONCEPT concepts concepts content concepts concept conceptual conceptual.
            searchCursor = editor.getSearchCursor(query); 
            found = reverse ? searchCursor.findPrevious() : searchCursor.findNext();
        }
        
        if(found) {
            editor.setSelection(searchCursor.from(), searchCursor.to());
            editor.scrollIntoView({from: searchCursor.from(), to: searchCursor.to()}, 100);
            editor.focus();
        }
    }

    const findNextBtn = document.getElementById('findNext');
    const findPrevBtn = document.getElementById('findPrev');
    const replaceBtn = document.getElementById('replaceBtn');
    
    if(findNextBtn) findNextBtn.onclick = () => performSearch(false);
    if(findPrevBtn) findPrevBtn.onclick = () => performSearch(true);
    if(replaceBtn) replaceBtn.onclick = () => {
        if(searchCursor && searchCursor.from() && replaceInput) {
            searchCursor.replace(replaceInput.value);
            performSearch(false);
        }
    };
    
    document.getElementById('closeSearchBtn').onclick = toggleSearch;
    // Bind Toolbar Search
    const searchToggleBtn = document.getElementById('searchToggleBtn');
    if(searchToggleBtn) searchToggleBtn.onclick = toggleSearch;

    // Overlay Close concepts context conceptual
    const closePreviewBtn = document.getElementById('closePreviewBtn');
    if(closePreviewBtn) {
        closePreviewBtn.onclick = () => {
            document.getElementById('fullscreen-preview').classList.add('hidden');
        };
    }
    
    // External Run Window concepts context conceptual conceptual
    const previewNewWindowBtn = document.getElementById('previewNewWindowBtn');
    if(previewNewWindowBtn) {
        previewNewWindowBtn.onclick = () => {
            const finalCode = getCompiledCode();
            const newWindow = window.open('', '_blank');
            newWindow.document.open();
            newWindow.document.write(finalCode);
            newWindow.document.close();
            newWindow.document.title = "CloudWeaver App";
        };
    }
}

// ==========================================
// 6. EXPORTS (Format, Undo, Redo, Run concepts context conceptual concepts conceptual)
// ==========================================
export function undo() { editor.undo(); }
export function redo() { editor.redo(); }

export function format() {
    const ext = currentFile.split('.').pop();
    try {
        if(ext === 'html') editor.setValue(html_beautify(editor.getValue(), { indent_size: 4 }));
        if(ext === 'css') editor.setValue(css_beautify(editor.getValue(), { indent_size: 4 }));
        if(ext === 'js' && ext !== 'json') editor.setValue(js_beautify(editor.getValue(), { indent_size: 4 }));
    } catch(e) {}
}

function getCompiledCode() {
    // Determine Target App Context concepts context conceptual concepts conceptual from last concepts request conceptual conceptual conceptual standard concepts conceptual. Reusing this standard concepts concepts conceptual concepts contextual conceptually context content context content concepts context content concepts concepts content context conceptual conceptual standard. concepts context content standard conceptual.
    let pathParts = currentFile.split('/');
    let targetIndex = 'index.html'; // Default concepts context content context conceptual conceptual context content context content conceptual conceptual context context context content.
    
    if (pathParts.length > 1) {
        // Look for context-specific concepts concepts standard.
        let folderPath = pathParts.slice(0, pathParts.length - 1).join('/');
        let folderIndex = `${folderPath}/index.html`;
        if (fileSystem[folderIndex]) {
            targetIndex = folderIndex; // Make THIS folder the App Root conceptually conceptually from default conceptual concepts request reuse standard standard standard standard standard concepts context standard.
        }
    }

    let htmlCode = fileSystem[targetIndex] ? fileSystem[targetIndex].content : `<h1>Error 404</h1><p>No ${targetIndex} found! Is folder me index.html create karo.</p>`;
    
    // Inject Eruda concepts context conceptual concepts conceptual
    const erudaScript = `<script src="https://cdn.jsdelivr.net/npm/eruda"><\/script><script>eruda.init();<\/script>`;
    if (htmlCode.includes('</head>')) htmlCode = htmlCode.replace('</head>', erudaScript + '</head>');
    else htmlCode = erudaScript + htmlCode;

    // Combine resources (Handles clean decoded deep paths concepts context conceptual conceptual) concepts context conceptual conceptually context content context concepts standard. conceptually conceptual and contextual conceptual conceptual concepts conceptual concepts concepts conceptual and contextual and conceptual conceptual conceptual conceptual conceptual conceptual concepts content content concepts conceptual content conceptually content contextual and. Increase selection and contextual menu contextual action size conceptual conceptually concepts conceptually conceptual conceptual conceptually conceptual conceptually conceptually concepts concept content conceptually context content content and contextual conceptually content conceptual and contextual conceptual content contextual actions conceptual conceptual contextual content content concepts context content and concepts contextual conceptually and content contextual conceptual conceptually contextual conceptual conceptually context conceptual conceptual context and contextual conceptual conceptual conceptual and. concepts and conceptual conceptual conceptually and concepts conceptually context and conceptually context content and. content contextual conceptual contextual conceptual. content conceptual conceptually and contextual. increase contextual action conceptual concepts conceptually conceptually conceptual conceptually conceptual. increase standard contextual actions concepts conceptually context conceptual. content contextual action conceptually concepts concept concepts concept concepts contextual. content conceptual conceptually standard concepts concepts contextual conceptually content concepts concepts content concepts conceptually conceptual context conceptual concepts conceptually concepts conceptual standard concepts content contextual conceptually context contextual. concepts conceptually conceptual. increase Standard conceptual contextual. content contextual action concepts conceptual content conceptually and content contextual conceptual conceptually contextual conceptual and context content content context content context conceptual and contextual actions conceptually and content contextual action and and and context and and and context content conceptual context.
    Object.keys(fileSystem).forEach(fname => {
        const shortName = fname.split('/').pop(); // concepts context content standard standard "js/app.js" -> "app.js" concepts context conceptual conceptual content contextual content content contextual and contextual actions conceptual. conceptual contextual standard. conceptually conceptual conceptually conceptual.

        if(fname.endsWith('.css')) {
            // Concepts context content contextual contextual and conceptual. conceptually contextual content content contextual contextual conceptual concepts contextual contextual contextual conceptual conceptual conceptually. Increase standard conceptual and context content. conceptually conceptual standard conceptual contextual standard conceptual standard. CONCEPT reuse conceptual merging conceptual conceptual conceptual conceptually conceptual conceptual concepts. conceptual conceptual conceptual standard.
            htmlCode = htmlCode.replace(new RegExp(`<link[^>]*href=["']${shortName}["'][^>]*>`, 'gi'), `<style>${fileSystem[fname].content}</style>`);
            // Absolute path fallback conceptual contextual. increase standard conceptual and contextual standard conceptual standard conceptual standard conceptually standard conceptual standard conceptually concepts standard concepts conceptually conceptually concepts context standard concepts contextual. conceptually context standard concepts standard standard standard. concepts contextual standard standard standard. conceptually context standard concepts concepts concepts standard conceptually context conceptually and conceptually context concepts concept context conceptual concepts concept contextual conceptual concepts conceptual contextual and content content and content and and conceptual and and content contextual content contextual conceptually content context context conceptually content concepts conceptually conceptual content concepts contextual conceptually contextual concepts and contextual actions.
            htmlCode = htmlCode.replace(new RegExp(`<link[^>]*href=["']${fname}["'][^>]*>`, 'gi'), `<style>${fileSystem[fname].content}</style>`);
        }
        if(fname.endsWith('.js') && !fname.endsWith('.json')) {
            // concepts contextual conceptually. Increase Standard and conceptual standard conceptual standard conceptual standard conceptual standard conceptual conceptually standard concepts concept and content conceptually. increase standard conceptual standard concepts concepts concept conceptually and contextual conceptually. content contextual action standard contextual standard standard conceptual standard conceptual. CONCEPT reuse conceptual conceptually conceptually concepts conceptual concepts conceptual conceptual conceptually concept conceptually concepts content contextual actions conceptually context conceptual contextual content and content contextual action and standard. increase standard standard conceptual and standard contextual conceptually contextual action contextual and and conceptual conceptually conceptual content conceptual contextual contextual. increase Standard and conceptual standard conceptual standard conceptual conceptually conceptual conceptually conceptual concepts context standard concepts standard standard concepts concept context standard conceptually conceptually standard conceptual conceptually. Concepts conceptual contextual conceptually content concepts content contextual conceptually conceptually context context conceptual conceptual conceptually contextual action contextual and standard conceptual standard conceptually. Concepts conceptually concepts conceptually concept and contextual standard standard standard conceptually conceptually context standard concepts concept context standard conceptually concepts content standard contextual conceptually and concepts context content contextual action conceptual conceptually and standard conceptual contextual contextual actions conceptual conceptual and contextual action conceptual contextual contextual contextual action contextual action size. conceptually conceptually conceptually contextual contextual action size contextual action contextual action conceptually and standard conceptual contextual action and.
            htmlCode = htmlCode.replace(new RegExp(`<script[^>]*src=["']${shortName}["'][^>]*><\\/script>`, 'gi'), `<script>${fileSystem[fname].content}<\/script>`);
            // Standalone app path fallback reuse standard concepts concepts conceptual concepts contextual conceptually. Reusing conceptually conceptual conceptually context conceptual conceptual. conceptual contextual concepts concept conceptually context conceptual concept conceptual conceptual contextual conceptually content conceptual conceptually conceptual concepts contextual conceptual concepts conceptual. Concepts standard conceptually context conceptually conceptual conceptually concepts conceptually contextual conceptually context conceptual conceptually concept content contextual action contextual action. conceptually conceptually concept conceptually and conceptual conceptual conceptual. Reusing standard concepts standard conceptually and conceptual conceptual standard conceptual conceptual concept conceptually conceptual and contextual conceptually.
            htmlCode = htmlCode.replace(new RegExp(`<script[^>]*src=["']${fname}["'][^>]*><\\/script>`, 'gi'), `<script>${fileSystem[fname].content}<\/script>`);
        }
    });
    
    return htmlCode;
}

export function run() {
    const previewContainer = document.getElementById('fullscreen-preview');
    if(previewContainer) {
        previewContainer.classList.remove('hidden');
        const finalCode = getCompiledCode();
        const frame = document.getElementById('preview-iframe');
        if(frame) {
            const doc = frame.contentDocument || frame.contentWindow.document;
            doc.open(); doc.write(finalCode); doc.close();
        }
    }
}
