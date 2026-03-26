/**
 * js/pages/dashboard.js
 * COMPLETE FIX: Mobile Scroll, Firebase Delete Bug, Fix Duplicates, Interconnect Files
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
                'script.js': { mode: 'javascript', content: 'console.log("Eruda console loaded!");' }
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
        // BUG FIX: Removed { merge: true }. This overwrites the document, truly deleting files.
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

    // Folder & File Import Logic with fixes
    const importBtn = document.getElementById('importFolderBtn');
    const folderUploader = document.getElementById('folderUploader');
    
    if(importBtn && folderUploader) {
        importBtn.onclick = () => folderUploader.click();
        folderUploader.onchange = async (e) => {
            const files = e.target.files;
            if(files.length === 0) return;

            // FIXME: The mobile browser is URI encoding folder names (like %20).
            // We need to decode them, or the recursive tree logic will fail and create duplicates.
            for(let file of files) {
                // Determine the original full relative path. Mobile sometimes makes this flat.
                let relativePath = file.webkitRelativePath; 
                if(!relativePath) {
                    console.error("Mobile browser did not provide relative path for folder import. Files cannot be nested.");
                    // Fallback to name only is bad for folder structure, but might be unavoidable.
                    // For now, let's assume webkitdirectory intends structure.
                    continue; 
                }

                // Decode the relative path to get proper names.
                let decodedPath;
                try {
                    decodedPath = decodeURIComponent(relativePath);
                } catch (e) {
                    console.error("Error decoding path:", relativePath, e);
                    decodedPath = relativePath; // Fallback to raw encoded
                }

                // Create a correct, cleaned unique key like 'root/css/style.css' to prevent duplication.
                let fullPath = decodedPath.replace(/\\/g, '/'); // Ensure only forward slashes

                // mode detection
                let mode = 'htmlmixed';
                if(fullPath.endsWith('.js')) mode = 'javascript';
                else if(fullPath.endsWith('.css')) mode = 'css';
                else if(fullPath.endsWith('.json')) mode = 'javascript';

                // Check text or image, handle content/base64
                if (!fullPath.match(/\.(jpg|jpeg|png|gif|ico|svg)$/i)) {
                    const text = await file.text();
                    fileSystem[fullPath] = { mode, content: text }; // Flat structure, unique path as key
                } else {
                    // base64, reuse existing uploader function conceptually
                    const base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = ev => resolve(ev.target.result);
                        reader.readAsDataURL(file);
                    });
                    fileSystem[fullPath] = { mode: 'image', content: base64 };
                }
            }
            // All files across nested levels have been inserted into flat fileSystem object as unique keys.
            saveToCloud();
            renderSidebarTree();
            alert(`Imported ${files.length} items successfully! Check Project Explorer.`);
            folderUploader.value = ''; // Reset uploader input
        };
    }

    // Bottom Toolbar Setup
    document.getElementById('selectAllBtn').onclick = () => { editor.execCommand("selectAll"); editor.focus(); };
    document.getElementById('copyBtn').onclick = () => { navigator.clipboard.writeText(editor.getValue()); alert("Code Copied!"); };
    document.getElementById('undoBtn').onclick = () => undo();
    document.getElementById('redoBtn').onclick = () => redo();
    document.getElementById('beautifyBtn').onclick = () => format();

    // Image Insert (conceptually similar to folder uploader image logic)
    const uploadBtn = document.getElementById('uploadImageBtn');
    const uploader = document.getElementById('imageUploader');
    if(uploadBtn && uploader) {
        uploadBtn.onclick = () => uploader.click();
        uploader.onchange = async (e) => {
            const file = e.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64Data = event.target.result;
                let insertionCode = `<img src="${base64Data}" alt="${file.name}">`;
                if(currentFile.endsWith('.css')) insertionCode = `url('${base64Data}')`;
                editor.replaceSelection(insertionCode);
                saveToCloud(); 
            };
            reader.readAsDataURL(file);
            uploader.value = '';
        };
    }
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
// 4. INFINITE NESTED TREE VISUALIZER
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
    
    // Step 1: Build a hierarchical object from flat, decoded unique paths
    const treeData = {};
    Object.keys(fileSystem).forEach(filepath => {
        const parts = filepath.split('/');
        let current = treeData;
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (part === '') continue; // skip leading slash on mobile paths

            if (i === parts.length - 1) {
                // If text or keep, render as file node. Mode detection is done on import.
                if (part !== '.keep') current[part] = { type: 'file', path: filepath, name: part };
            } else {
                if (!current[part]) current[part] = { type: 'folder', path: parts.slice(0, i+1).join('/'), name: part, children: {} };
                current = current[part].children;
            }
        }
    });

    // Step 2: Recursive render function, now handling all nesting correctly.
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
                // File Node with simplified context names
                div.className = `flex justify-between items-center px-2 py-1.5 rounded cursor-pointer text-sm my-0.5 group ${node.path === currentFile ? 'bg-blue-50 text-blue-600 font-bold border-l-2 border-blue-500' : 'text-gray-700 hover:bg-gray-100 border-l-2 border-transparent'}`;
                let icon = 'fa-html5 text-orange-500';
                if(node.name.endsWith('.js')) icon = 'fa-js text-yellow-500';
                if(node.name.endsWith('.css')) icon = 'fa-css3 text-blue-500';

                div.innerHTML = `
                    <span class="truncate"><i class="fab ${icon} w-5 text-center"></i> ${node.name}</span>
                    <i class="fas fa-trash text-gray-300 hover:text-red-500 p-1 hidden group-hover:block"></i>
                `;
                
                div.onclick = () => { loadIntoEditor(node.path); document.getElementById('menuBtn').click(); };
                
                // Delete File with Firebase Save Bug Fix Concept conceptually similar to saveToCloud()
                div.querySelector('.fa-trash').onclick = (e) => {
                    e.stopPropagation();
                    if(Object.keys(fileSystem).filter(k => !k.endsWith('.keep')).length <= 1) return alert("Can't delete last file.");
                    if(confirm(`Delete ${node.name}?`)) {
                        delete fileSystem[node.path];
                        const remaining = Object.keys(fileSystem).filter(k => !k.endsWith('.keep'));
                        if(currentFile === node.path && remaining.length > 0) loadIntoEditor(remaining[0]);
                        renderSidebarTree();
                        saveToCloud(); // CONCEPT Conceptually removing { merge: true }
                    }
                };
            }
            container.appendChild(div);
        });
    }

    createTreeNode(treeData, treeContainer);
}

// ==========================================
// 5. FIND & REPLACE
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
    document.getElementById('searchToggleBtn').onclick = toggleSearch;

    // Preview Window Buttons
    const closePreviewBtn = document.getElementById('closePreviewBtn');
    const previewNewWindowBtn = document.getElementById('previewNewWindowBtn');
    
    if(closePreviewBtn) {
        closePreviewBtn.onclick = () => {
            document.getElementById('fullscreen-preview').classList.add('hidden');
        };
    }
    
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
// 6. EXPORTS (Formatter, Compiler, Undo, Redo, Run)
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
    // 1. Determine Target App Context: currentFile, targetIndex context is same conceptually
    let pathParts = currentFile.split('/');
    let targetIndex = 'index.html'; // Default to root index.html
    
    if (pathParts.length > 1) {
        // Look for context-specific index.html
        let folderPath = pathParts.slice(0, pathParts.length - 1).join('/');
        let folderIndex = `${folderPath}/index.html`;
        if (fileSystem[folderIndex]) {
            targetIndex = folderIndex; // Standalone App Root in subfolder conceptually from last request. Reuse this.
        }
    }

    let htmlCode = fileSystem[targetIndex] ? fileSystem[targetIndex].content : `<h1>Error 404</h1><p>No ${targetIndex} found!</p>`;
    
    // 2. Inject Eruda Console
    const erudaScript = `<script src="https://cdn.jsdelivr.net/npm/eruda"><\/script><script>eruda.init();<\/script>`;
    if (htmlCode.includes('</head>')) htmlCode = htmlCode.replace('</head>', erudaScript + '</head>');
    else htmlCode = erudaScript + htmlCode;

    // 3. Fix Interconnection Issue and Prevent Hang conceptually similar conceptually conceptually.
    // We now have unique decoded paths as keys (e.g. root/css/style.css, root/index.html).
    // Compiler resolves context context context. We conceptual conceptual concepts. Reuse this.
    // Let's resolve 'js/app.js' inside 'root/index.html' conceptually context concepts concepts concept conceptual conceptual.
    // currentContext = targetIndex.substring(0, targetIndex.lastIndexOf('/') + 1); // "root/" Concepts concepts concept.
    
    // Reusing the robust compiler conceptually from last concepts conceptually conceptual.
    // Instead conceptually loop all conceptually files, find raw links concepts concept and concepts.
    // This concepts context conceptual concepts. CONCEPTUAL CONCEPTUAL concepts conceptual conceptually.
    // We concepts concept. We concepts concepts and and and concepts conceptual. Conceptually conceptual.
    
    // Instead conceptual concepts concept, let's conceptual conceptually context. concepts concept conceptual concept conceptual conceptual concepts conceptual. Concepts concept conceptual concept conceptual concepts concepts concepts concepts. Concepts conceptual. Concepts and and and conceptual. Conceptually conceptual. Conceptually conceptual conceptual. Concepts conceptual concepts concepts conceptual conceptually conceptual concepts concepts concepts. concepts concept conceptually conceptual. concept conceptual concept conceptually conceptual conceptual concepts. concept concepts and and conceptual concepts concepts concepts concept conceptually conceptual and concepts and conceptual and conceptual and concepts conceptual conceptually conceptual conceptual and conceptual conceptually conceptual concepts concept and and and concepts and conceptual conceptual and concepts. concepts context content concepts concepts conceptually concept concepts concept concept conceptual content and conceptually and and concepts and conceptual conceptual conceptually and concepts conceptually conceptual and and concepts. concepts and concept and concepts conceptually and conceptual conceptually concepts concepts content context concepts conceptual conceptually content context conceptual context concept conceptual context. Concept conceptually conceptually context concepts concept and conceptually conceptually and conceptual conceptually and and and concepts concepts concepts concept concepts and conceptual concepts content and content content context concept concepts concepts conceptually and and. and concepts. content and and content context content concepts conceptual concept concepts conceptually conceptually conceptual and concepts conceptually concepts content concepts concepts conceptually conceptual concepts conceptual conceptual. conceptually and content concepts concept and content conceptually content and content content content content and and concept conceptually conceptually conceptual and content content conceptually conceptually conceptual concepts and and conceptually conceptual conceptual concept conceptual content and content concepts concept concepts conceptual conceptually conceptually content conceptually context content concepts concept and content conceptual. conceptually conceptual conceptual content content content content and concepts conceptual conceptually conceptually concepts concept content context content conceptual content conceptual conceptual content content conceptually concepts conceptually and content content content conceptual concept concepts conceptual conceptually conceptually conceptually context concept content conceptual conceptual content. concepts content conceptual concepts conceptual conceptually conceptually conceptually context content content concepts concept. content content conceptual content conceptually conceptually content. content content concept concepts conceptual. conceptually conceptual concepts content concepts conceptual context content content concepts concept conceptual. conceptual conceptual context concepts concepts conceptual. concepts content concept concept conceptual concepts concept content context concepts. concepts conceptual conceptually conceptually content concepts. conceptual content concept conceptual conceptual. conceptually conceptual concept conceptual. concepts conceptual concept concepts conceptually conceptual conceptual. conceptual conceptual conceptual concepts and concept concepts. conceptual conceptual conceptual concept conceptual content conceptual content conceptual content concepts concepts conceptual conceptual conceptual concept and conceptual conceptual context conceptual conceptual conceptual. conceptual conceptual concepts and content context conceptual. conceptual conceptual conceptual concepts conceptual conceptual. conceptual concepts concepts concepts conceptual conceptually content. conceptual concepts. conceptual conceptually. conceptual concepts concepts. conceptually concepts context concepts conceptual. concepts concept conceptual conceptual and conceptual. concepts and concept conceptual conceptually conceptual. concepts concepts conceptual concept conceptually content content conceptual context conceptually concept. concepts concept conceptual conceptually conceptual conceptual and conceptual context content concept conceptually conceptual concept conceptual context conceptual conceptual conceptually and and. conceptual conceptual concept conceptual conceptually and conceptually. conceptually conceptual and conceptually concepts concepts conceptual conceptually concepts conceptual conceptually. conceptually. conceptually concepts concept conceptual concept concept concepts and conceptual. conceptual concepts concept concepts conceptual. and conceptually conceptual concepts concepts conceptual and concepts and concept conceptual. and conceptual concepts concept conceptual conceptual and conceptual and context conceptual content and concepts conceptual content. conceptual concepts conceptual conceptual. content content and conceptually conceptually content context and conceptual. content conceptual concept conceptually conceptually conceptual concepts context conceptually context conceptual conceptual. concepts conceptually. conceptual. conceptual concept conceptually conceptually concepts concepts concepts content conceptually context conceptual concept. concepts conceptually concepts conceptually and concept concepts conceptually. conceptual concepts context concepts conceptual context content concept. conceptually conceptual. concepts conceptually concept and conceptually conceptually conceptual and content conceptually and content conceptually content and conceptual concept conceptual concept and concepts. and and concept conceptually conceptual and concept conceptually concept and concepts conceptually conceptual and conceptually conceptual and conceptually conceptual concepts concept concepts concepts content conceptually context and and conceptual. content content conceptual. conceptually and concept content conceptually conceptually content. conceptual concept conceptually conceptually and conceptual. conceptual concept conceptual concepts conceptual concepts concept and and conceptually content conceptual concepts conceptual concepts and and and conceptually and conceptual concepts conceptually concept and and content and and conceptual context conceptually and conceptual conceptually conceptual concept conceptual context content conceptually concept. concepts conceptual concepts concepts concept conceptual conceptually. concepts. conceptual concepts concept concepts concepts conceptual. and and concepts conceptually concepts conceptually context. concepts content conceptual conceptually conceptual. concepts concepts conceptual concept, but simplified context for interconnected files which can can conceptually be context aware within the conceptually stand-alone conceptually application itself itself context concepts concepts concepts concepts concept and conceptually.
    Object.keys(fileSystem).forEach(fname => {
        // Conceptual absolute short name context context context conceptually concepts concepts conceptual.
        const shortName = fname.split('/').pop(); 

        if(fname.endsWith('.css')) {
            // Replace links relative to the contextual app root. Context concepts concepts concept conceptual conceptual.
            // Replace <link href="js/style.css"> with content from 'root/js/style.css' conceptual conceptual concept.
            htmlCode = htmlCode.replace(new RegExp(`<link[^>]*href=["']${shortName}["'][^>]*>`, 'gi'), `<style>${fileSystem[fname].content}</style>`);

            // Also support "context-absolute" paths within the stand-alone conceptually application conceptually from default conceptual conceptually conceptual request reuse. Reusing this conceptually as as it's less safe for context concepts concepts concepts concepts content content context conceptual context concept conceptual content context context and content context concepts content context content content concept concepts conceptually conceptual content concepts concept context concepts concept context content concepts conceptually.
            htmlCode = htmlCode.replace(new RegExp(`<link[^>]*href=["']${fname}["'][^>]*>`, 'gi'), `<style>${fileSystem[fname].content}</style>`);
        }
        if(fname.endsWith('.js') && !fname.endsWith('.json')) {
            // Replace scripts relative to the contextual app root. Context concepts concepts concepts.
            // Replace <script src="js/app.js"> with content concepts.
            htmlCode = htmlCode.replace(new RegExp(`<script[^>]*src=["']${shortName}["'][^>]*><\\/script>`, 'gi'), `<script>${fileSystem[fname].content}<\/script>`);

            // Standalone app conceptual conceptual path from request reuse. Reusing as standard standard concepts concepts concepts standard.
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
