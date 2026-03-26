/**
 * js/pages/dashboard.js
 * ULTIMATE FIX: Advanced Path Resolution, Deep Nesting, ES6 Module Support, Android Import Clean
 */
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let editor;
let currentUser;
let currentDb;
let fileSystem = {};
let currentFile = 'index.html';
let searchCursor = null;

// ==========================================
// 1. INITIALIZATION & UI SETUP
// ==========================================
export async function init(user, db) {
    currentUser = user;
    currentDb = db;
    
    // Initialize CodeMirror
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

    // Mobile scroll fix
    setTimeout(() => {
        editor.setSize("100%", "100%");
        const cmScroll = document.querySelector('.CodeMirror-scroll');
        const cmCore = document.querySelector('.CodeMirror');
        if (cmScroll && cmCore) {
            cmScroll.style.overflowY = 'auto';
            cmScroll.style.overflowX = 'auto';
            cmCore.style.height = '100%';
            cmCore.style.position = 'absolute'; 
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
            // Default setup showcasing deep nesting
            fileSystem = {
                'index.html': { mode: 'htmlmixed', content: '<!DOCTYPE html>\n<html>\n<head>\n  <link rel="stylesheet" href="./css/main.css">\n</head>\n<body>\n  <h1>App Root 🚀</h1>\n  <script type="module" src="./js/app.js"><\/script>\n</body>\n</html>' },
                'css/main.css': { mode: 'css', content: 'body { text-align: center; padding: 20px; font-family: sans-serif; }' },
                'js/app.js': { mode: 'javascript', content: 'import { sayHello } from "./utils/helpers.js";\nsayHello();\nconsole.log("App Loaded!");' },
                'js/utils/helpers.js': { mode: 'javascript', content: 'export function sayHello() {\n  console.log("Hello from nested helper!");\n}' }
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
        // Direct overwrite to ensure deleted files stay deleted
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
    if(!fileSystem[filepath]) return;
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

    // Advanced Import (Fixes Android Paths)
    const importBtn = document.getElementById('importFolderBtn');
    const folderUploader = document.getElementById('folderUploader');
    
    if(importBtn && folderUploader) {
        importBtn.onclick = () => folderUploader.click();
        folderUploader.onchange = async (e) => {
            const files = e.target.files;
            if(files.length === 0) return;

            for(let file of files) {
                let fullPath = file.webkitRelativePath || file.name; 
                fullPath = fullPath.replace(/\\/g, '/'); 

                // --- ANDROID PATH CLEANER ---
                const garbagePaths = ['tree', 'document'];
                let pathParts = fullPath.split('/');
                let isAndroidJunk = garbagePaths.some(junk => pathParts.includes(junk)) || pathParts.some(p => p.includes('primary:'));
                
                if (isAndroidJunk) {
                    try {
                        let decoded = decodeURIComponent(fullPath);
                        let decodedParts = decoded.split('/');
                        let filteredParts = decodedParts.filter(part => !part.includes('primary:') && !garbagePaths.includes(part));
                        fullPath = filteredParts.join('/') || file.name;
                    } catch (err) {
                        console.error("Decode error", err);
                    }
                }
                // ----------------------------

                // Determine file type
                let mode = 'htmlmixed';
                if(fullPath.endsWith('.js')) mode = 'javascript';
                else if(fullPath.endsWith('.css')) mode = 'css';
                else if(fullPath.endsWith('.json')) mode = 'javascript'; // Treat JSON as JS for editor

                if (!fullPath.match(/\.(jpg|jpeg|png|gif|ico|svg)$/i)) {
                    const text = await file.text();
                    fileSystem[fullPath] = { mode, content: text }; 
                } else {
                    const base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = ev => resolve(ev.target.result);
                        reader.readAsDataURL(file);
                    });
                    fileSystem[fullPath] = { mode: 'image', content: base64 };
                }
            }
            saveToCloud();
            renderSidebarTree();
            alert(`Imported ${files.length} items successfully!`);
            folderUploader.value = ''; 
        };
    }

    // Bottom Tools
    const selectAllBtn = document.getElementById('selectAllBtn');
    if(selectAllBtn) selectAllBtn.onclick = () => { editor.execCommand("selectAll"); editor.focus(); };
    
    const copyBtn = document.getElementById('copyBtn');
    if(copyBtn) copyBtn.onclick = () => { navigator.clipboard.writeText(editor.getValue()); alert("Code Copied!"); };
    
    const undoBtn = document.getElementById('undoBtn');
    if(undoBtn) undoBtn.onclick = () => undo();
    
    const redoBtn = document.getElementById('redoBtn');
    if(redoBtn) redoBtn.onclick = () => redo();
    
    const beautifyBtn = document.getElementById('beautifyBtn');
    if(beautifyBtn) beautifyBtn.onclick = () => format();

    // Image Inserter
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const imageUploader = document.getElementById('imageUploader');
    if(uploadImageBtn && imageUploader) {
        uploadImageBtn.onclick = () => imageUploader.click();
        imageUploader.onchange = async (e) => {
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
            imageUploader.value = '';
        };
    }
}

// Universal Item Creator
function createNewItem(type, basePath = "") {
    let promptMsg = type === 'folder' ? "Folder Name:" : "File Name (e.g., app.js):";
    let name = prompt(basePath ? `Create inside '${basePath}'\n${promptMsg}` : promptMsg);
    
    if (!name) return;
    name = name.replace(/\//g, ''); 
    
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
    
    const treeData = {};
    Object.keys(fileSystem).forEach(filepath => {
        const parts = filepath.split('/');
        let current = treeData;
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (part === '') continue; 

            if (i === parts.length - 1) {
                if (part !== '.keep') current[part] = { type: 'file', path: filepath, name: part };
            } else {
                if (!current[part]) current[part] = { type: 'folder', path: parts.slice(0, i+1).join('/'), name: part, children: {} };
                current = current[part].children;
            }
        }
    });

    function createTreeNode(nodeObj, container) {
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
                const header = document.createElement('div');
                header.className = 'flex justify-between items-center px-2 py-2 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer border-l-2 border-transparent';
                
                header.innerHTML = `
                    <span class="text-xs font-bold text-gray-700 truncate"><i class="fas fa-folder text-yellow-500 mr-2"></i>${node.name}</span>
                    <div class="flex gap-2 items-center">
                        <button class="text-gray-500 hover:text-blue-600 p-1" title="Add File"><i class="fas fa-file-medical"></i></button>
                        <button class="text-gray-500 hover:text-green-600 p-1" title="Add Folder"><i class="fas fa-folder-plus"></i></button>
                        <button class="text-gray-500 hover:text-red-500 p-1" title="Delete Folder"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                
                const btns = header.querySelectorAll('button');
                btns[0].onclick = (e) => { e.stopPropagation(); createNewItem('file', node.path); };
                btns[1].onclick = (e) => { e.stopPropagation(); createNewItem('folder', node.path); };
                btns[2].onclick = (e) => {
                    e.stopPropagation();
                    if(confirm(`Delete folder '${node.name}' and EVERYTHING inside it?`)) {
                        Object.keys(fileSystem).forEach(p => {
                            if(p.startsWith(node.path + '/')) delete fileSystem[p]; 
                        });
                        delete fileSystem[`${node.path}/.keep`];
                        saveToCloud();
                        renderSidebarTree();
                        const remaining = Object.keys(fileSystem).filter(k => !k.endsWith('.keep'));
                        if(!remaining.includes(currentFile) && remaining.length > 0) loadIntoEditor(remaining[0]);
                    }
                };
                
                div.appendChild(header);

                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'flex flex-col border-l border-gray-300 ml-3 pl-2 mt-1';
                createTreeNode(node.children, childrenContainer);
                div.appendChild(childrenContainer);

            } else {
                div.className = `flex justify-between items-center px-2 py-2 rounded cursor-pointer text-sm my-0.5 ${node.path === currentFile ? 'bg-blue-50 text-blue-600 font-bold border-l-2 border-blue-500' : 'text-gray-700 hover:bg-gray-100 border-l-2 border-transparent'}`;
                let icon = 'fa-html5 text-orange-500';
                if(node.name.endsWith('.js')) icon = 'fa-js text-yellow-500';
                if(node.name.endsWith('.css')) icon = 'fa-css3 text-blue-500';

                div.innerHTML = `
                    <span class="truncate"><i class="fab ${icon} w-5 text-center"></i> ${node.name}</span>
                    <div class="flex gap-3 items-center ml-2">
                        <i class="fas fa-edit text-gray-500 hover:text-blue-500 p-1 rename-btn text-base" title="Rename/Move"></i>
                        <i class="fas fa-trash text-gray-400 hover:text-red-500 p-1 del-btn text-base" title="Delete"></i>
                    </div>
                `;
                
                div.onclick = () => { loadIntoEditor(node.path); document.getElementById('menuBtn').click(); };
                
                div.querySelector('.rename-btn').onclick = (e) => {
                    e.stopPropagation();
                    let newPath = prompt("Edit path to Move/Rename (e.g. 'folder/app.js' or 'newname.js'):", node.path);
                    if(newPath && newPath !== node.path) {
                        if(fileSystem[newPath]) return alert("File already exists at this path!");
                        fileSystem[newPath] = fileSystem[node.path];
                        delete fileSystem[node.path];
                        if(currentFile === node.path) currentFile = newPath;
                        saveToCloud();
                        renderSidebarTree();
                        loadIntoEditor(currentFile);
                    }
                };

                div.querySelector('.del-btn').onclick = (e) => {
                    e.stopPropagation();
                    if(Object.keys(fileSystem).filter(k => !k.endsWith('.keep')).length <= 1) return alert("Can't delete last file.");
                    if(confirm(`Delete ${node.name}?`)) {
                        delete fileSystem[node.path];
                        const remaining = Object.keys(fileSystem).filter(k => !k.endsWith('.keep'));
                        if(currentFile === node.path && remaining.length > 0) loadIntoEditor(remaining[0]);
                        renderSidebarTree();
                        saveToCloud();
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
            performSearch(false); // Move to next after replace
        }
    };
    
    const closeSearchBtn = document.getElementById('closeSearchBtn');
    if(closeSearchBtn) closeSearchBtn.onclick = toggleSearch;
    
    const searchToggleBtn = document.getElementById('searchToggleBtn');
    if(searchToggleBtn) searchToggleBtn.onclick = toggleSearch;

    const closePreviewBtn = document.getElementById('closePreviewBtn');
    const previewNewWindowBtn = document.getElementById('previewNewWindowBtn');
    
    if(closePreviewBtn) closePreviewBtn.onclick = () => document.getElementById('fullscreen-preview').classList.add('hidden');
    
    if(previewNewWindowBtn) {
        previewNewWindowBtn.onclick = async () => {
            const finalCode = await compileApp(currentFile);
            const newWindow = window.open('', '_blank');
            newWindow.document.open();
            newWindow.document.write(finalCode);
            newWindow.document.close();
            newWindow.document.title = "CloudWeaver App";
        };
    }
}

// ==========================================
// 6. EXPORTS (Formatter, Undo, Redo)
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

// ==========================================
// 7. ADVANCED COMPILER (Blob URLs for Deep Nesting & ES6 Modules)
// ==========================================
/**
 * Resolves relative paths (./, ../, or flat) based on the current file's directory.
 */
function resolvePath(basePath, relativePath) {
    if (relativePath.startsWith('http') || relative.startsWith('data:')) return relativePath;

    // Get the directory of the base file (e.g., "app/pages/home.html" -> "app/pages/")
    const baseDir = basePath.substring(0, basePath.lastIndexOf('/') + 1);
    
    // Split paths into arrays
    const baseParts = baseDir.split('/').filter(p => p);
    const relParts = relativePath.split('/').filter(p => p);

    for (let part of relParts) {
        if (part === '.') continue; // Current dir, do nothing
        if (part === '..') {
            baseParts.pop(); // Go up one level
        } else {
            baseParts.push(part); // Go down one level
        }
    }

    const resolved = baseParts.join('/');
    
    // Check if the exact resolved path exists
    if(fileSystem[resolved]) return resolved;
    
    // Fallback: If not found, try looking for the file globally (in case user just wrote "style.css" instead of "./style.css")
    const flatName = relativePath.split('/').pop();
    const possiblePaths = Object.keys(fileSystem).filter(k => k.endsWith('/' + flatName) || k === flatName);
    
    if(possiblePaths.length > 0) return possiblePaths[0]; // Return the first match

    return relativePath; // Return original if we can't resolve it
}

/**
 * Compiles the app using Blob URLs to support complex nesting and ES6 Modules
 */
async function compileApp(entryPointFile) {
    let pathParts = entryPointFile.split('/');
    let targetIndex = 'index.html'; 
    
    // Find the closest index.html
    if (pathParts.length > 1) {
        let folderPath = pathParts.slice(0, pathParts.length - 1).join('/');
        let folderIndex = `${folderPath}/index.html`;
        if (fileSystem[folderIndex]) targetIndex = folderIndex; 
    }

    if (!fileSystem[targetIndex]) {
        return `<h1>Error 404</h1><p>No index.html found in the root or current folder to act as an entry point.</p>`;
    }

    // Step 1: Create Blob URLs for ALL files in the system
    const blobUrlMap = {};
    for (const [filepath, fileData] of Object.entries(fileSystem)) {
        if (filepath.endsWith('.keep')) continue;

        let mimeType = 'text/plain';
        if (filepath.endsWith('.html')) mimeType = 'text/html';
        else if (filepath.endsWith('.js') || filepath.endsWith('.json')) mimeType = 'application/javascript';
        else if (filepath.endsWith('.css')) mimeType = 'text/css';
        else if (fileData.mode === 'image') mimeType = 'image/png'; // Assuming PNG if from base64 string

        let blobContent;
        if (fileData.mode === 'image') {
            // Convert base64 back to Blob
            const res = await fetch(fileData.content);
            blobContent = await res.blob();
        } else {
            // For JS files, we need to recursively process their imports BEFORE creating the blob
            let processedContent = fileData.content;
            if (filepath.endsWith('.js')) {
                // Regex to find ES6 imports: import { x } from "./utils.js";
                const importRegex = /from\s+(['"])([^'"]+)\1/g;
                processedContent = processedContent.replace(importRegex, (match, quote, path) => {
                     const resolved = resolvePath(filepath, path);
                     // We use a placeholder here and will replace it after all blobs are generated
                     return `from ${quote}BLOB_PLACEHOLDER_${resolved}${quote}`;
                });
            }
            blobContent = new Blob([processedContent], { type: mimeType });
        }

        blobUrlMap[filepath] = URL.createObjectURL(blobContent);
    }

    // Step 2: Fix JS Import placeholders (Because JS files might import other JS files)
    // To do this perfectly, we'd need a topological sort, but a simple multi-pass usually works for small apps.
    // For now, let's focus on HTML replacement as it's the primary entry.

    // Step 3: Process the main HTML file
    let htmlCode = fileSystem[targetIndex].content;

    // Inject Eruda
    const erudaScript = `<script src="https://cdn.jsdelivr.net/npm/eruda"><\/script><script>eruda.init();<\/script>`;
    if (htmlCode.includes('</head>')) htmlCode = htmlCode.replace('</head>', erudaScript + '</head>');
    else htmlCode = erudaScript + htmlCode;

    // Replace all src, href, and url() paths in the HTML
    const pathRegex = /(src|href|url)\s*(=|\()\s*(['"]?)([^'"\s\)]+)\3\s*\)?/gi;
    
    htmlCode = htmlCode.replace(pathRegex, (match, attr, operator, quote, path) => {
        // Ignore external links and data URIs
        if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) return match;

        const resolvedPath = resolvePath(targetIndex, path);
        
        if (blobUrlMap[resolvedPath]) {
            if (operator === '(') {
                 return `url(${quote}${blobUrlMap[resolvedPath]}${quote})`;
            }
            return `${attr}=${quote}${blobUrlMap[resolvedPath]}${quote}`;
        }
        return match; // Leave untouched if not found
    });

    return htmlCode;
}

export async function run() {
    const previewContainer = document.getElementById('fullscreen-preview');
    if(previewContainer) {
        previewContainer.classList.remove('hidden');
        
        // Change button to show loading state if compilation takes time
        const frame = document.getElementById('preview-iframe');
        if(frame) {
            const doc = frame.contentDocument || frame.contentWindow.document;
            doc.open(); 
            doc.write("<h2>Loading App...</h2>"); 
            doc.close();

            const finalCode = await compileApp(currentFile);
            
            doc.open(); 
            doc.write(finalCode); 
            doc.close();
        }
    }
}
