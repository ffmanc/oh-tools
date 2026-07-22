/* =========================================
   DYNAMIC CONFIGURATION (Defaults)
   ========================================= */
let SHOW_SLOT_DATA = false;
let SHOW_BUILDER_MODULE = true;
let SHOW_ISOLATION_MODULE = true;
let SHOW_TECH_SEARCH_MODULE = true;
let SHOW_DEV_SEARCH_MODULE = true;
/* ========================================= */

let deviations = [];
let traits = [];
let techniquesData = []; 
let shopsData = []; 
let shopDeviationNames = new Set(); 
let shopDeviationArena = {}; 

let currentCategoryFilter = 'All';
let currentSlotFilter = 'All';
let currentDeviantTypeFilter = 'All';
let currentShopFilter = 'All';
let userSelectedTraits = []; 
let isListExpanded = false; 
let allUniqueTechniques = [];

const sourceSelect = document.getElementById('sourceDev');
const builderDevSelect = document.getElementById('builderDevSelect');
const techniqueSelect = document.getElementById('targetTechnique');
const searchTechniqueSelect = document.getElementById('searchTechniqueSelect');
const tooltip = document.getElementById('technique-tooltip');

/* === SETTINGS LOGIC === */
function toggleSettingsModal() {
    document.getElementById('settingsModal').classList.toggle('hidden');
}

function toggleGlobalSetting(type) {
    // 1. Update Boolean
    if (type === 'SLOT') SHOW_SLOT_DATA = document.getElementById('chkSlotData').checked;
    if (type === 'BUILDER') SHOW_BUILDER_MODULE = document.getElementById('chkBuilder').checked;
    if (type === 'ISOLATION') SHOW_ISOLATION_MODULE = document.getElementById('chkIsolation').checked;
    if (type === 'TECH_SEARCH') SHOW_TECH_SEARCH_MODULE = document.getElementById('chkTechSearch').checked;
    if (type === 'DEV_SEARCH') SHOW_DEV_SEARCH_MODULE = document.getElementById('chkDevSearch').checked;

    // 2. Apply Visibility Changes
    applyVisibilitySettings();
}

function applyVisibilitySettings() {
    // A. Toggle Panels
    toggleDisplay('panel-builder', SHOW_BUILDER_MODULE);
    toggleDisplay('panel-isolation', SHOW_ISOLATION_MODULE);
    toggleDisplay('panel-tech-search', SHOW_TECH_SEARCH_MODULE);
    toggleDisplay('panel-dev-search', SHOW_DEV_SEARCH_MODULE);

    // B. Toggle Slot Data UI elements
    const slotBtns = document.querySelectorAll('.slot-btn');
    const separator = document.getElementById('slotFilterSep');
    
    if (SHOW_SLOT_DATA) {
        slotBtns.forEach(btn => btn.style.display = '');
        if(separator) separator.style.display = '';
    } else {
        slotBtns.forEach(btn => btn.style.display = 'none');
        if(separator) separator.style.display = 'none';
    }

    // C. Re-render components that rely on Slot Data text
    buildTraitsTable();   // Redraws the Trait Library table
    generatePlan();       // Redraws the Planner results (to add/remove warnings)
    renderSelectedTraits(); // Redraws selected traits in builder
}

function toggleDisplay(id, shouldShow) {
    const el = document.getElementById(id);
    if(el) el.style.display = shouldShow ? 'block' : 'none';
}
/* ====================== */


function safeTooltip(str) {
    if (!str) return "No description";
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, " ");
}

async function init() {
    try {
        // Load i18n locales before anything else
        if (typeof loadLocale === 'function') {
            await loadLocale(currentLang);
            if (typeof fetchOnlineTranslations === 'function') {
                await fetchOnlineTranslations();
            }
            if (typeof trackUniqueVisit === 'function') {
                trackUniqueVisit();
            }
        }

        let devRes;
        try {
            devRes = await fetch('Databases/deviations.json');
            if (!devRes.ok) throw new Error("Not found");
        } catch (e) {
            console.warn("Databases/deviations.json not found, falling back to Databases/data.json");
            devRes = await fetch('Databases/data.json');
        }

        const [traitRes, techRes, shopRes] = await Promise.all([
            fetch('Databases/traits.json?v=' + Date.now()),
            fetch('Databases/techniques.json'),
            fetch('Databases/shops.json')
        ]);

        if (devRes.ok) {
            deviations = await devRes.json();
            deviations.sort((a,b) => a.name.localeCompare(b.name));
        }
        if (traitRes.ok) {
            traits = await traitRes.json();
        }
        if (techRes.ok) {
            techniquesData = await techRes.json();
        }
        if (shopRes.ok) {
            shopsData = await shopRes.json();
            shopsData.forEach(arena => {
                arena.items.forEach(item => {
                    if (item.type === "Species Code") {
                        shopDeviationNames.add(item.name);
                        shopDeviationArena[item.name] = arena.arena; 
                    }
                });
            });
        }

        populateUI();
        renderDeviants(); 
        auditData(); 
        applyVisibilitySettings(); // Ensure defaults are applied on load
        if (typeof applyi18n === 'function') {
            applyi18n();
        }
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

function filterTraitDropdown() {
    const input = document.getElementById('traitInput');
    const dropdown = document.getElementById('traitDropdown');
    const filter = input.value.toUpperCase();
    
    dropdown.innerHTML = "";
    
    if (filter.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

    const matches = traits.filter(t => {
        const trans = typeof translateTrait === 'function' ? translateTrait(t.name) : t;
        return t.name.toUpperCase().includes(filter) || trans.name.toUpperCase().includes(filter);
    });
    
    if (matches.length > 0) {
        dropdown.style.display = 'block';
        matches.slice(0, 10).forEach(t => {
            const div = document.createElement('div');
            div.className = 'trait-option';
            
            // DYNAMIC: Only show slot text if enabled
            const slotStr = (SHOW_SLOT_DATA && t.slot) ? ` [S${t.slot}]` : '';
            const trans = typeof translateTrait === 'function' ? translateTrait(t.name) : t;
            
            div.innerHTML = `${trans.name} <span>[${t.source}]${slotStr}</span>`;
            div.onclick = () => selectTraitFromDropdown(t.name, t.source, trans.name);
            dropdown.appendChild(div);
        });
    } else {
        dropdown.style.display = 'none';
    }
}

function selectTraitFromDropdown(name, source, localName) {
    const input = document.getElementById('traitInput');
    input.value = `${localName || name} [${source}]`;
    document.getElementById('traitDropdown').style.display = 'none';
}

function toggleArenaShops() { 
    document.getElementById('arenaShops').classList.toggle('hidden'); 
    document.getElementById('btnArenaShops').classList.toggle('active');
}

function toggleTechniquesLibrary() { 
    document.getElementById('techniquesLibrary').classList.toggle('hidden'); 
    document.getElementById('btnTechniquesLib').classList.toggle('active');
}

function toggleLibrary() { 
    document.getElementById('traitsLibrary').classList.toggle('hidden'); 
    document.getElementById('btnLib').classList.toggle('active');
}

function applyShopFilter(filter, btn) {
    currentShopFilter = filter;
    document.querySelectorAll('#shop-filters .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    buildArenaShops();
}

function buildArenaShops() { 
    const searchText = document.getElementById('searchArenaShop').value.toUpperCase();
    
    document.getElementById('arenaShopsContainer').innerHTML = shopsData.map(shop => {
        const filteredItems = shop.items.filter(i => {
            const localName = i.type === "Species Code" 
                ? (typeof translateDeviationName === 'function' ? translateDeviationName(i.name) : i.name)
                : (typeof translateTechnique === 'function' ? translateTechnique(i.name).name : i.name);
            const matchesType = (currentShopFilter === 'All') || (i.type === currentShopFilter);
            const matchesSearch = i.name.toUpperCase().includes(searchText) || localName.toUpperCase().includes(searchText);
            return matchesType && matchesSearch;
        });

        if (filteredItems.length === 0) return '';

        return `
        <div class="arena-card">
            <div class="arena-header">${shop.arena}</div>
            <div class="arena-scroll">
                <table class="arena-table">
                    ${filteredItems.map(i => {
                        const isChaos = i.name.includes("Chaos");
                        const costColor = isChaos ? "var(--chaos-cost)" : "#ffd700";
                        const displayCost = i.cost !== undefined ? i.cost : '0';
                        const localItemName = i.type === "Species Code" 
                            ? (typeof translateDeviationName === 'function' ? translateDeviationName(i.name) : i.name)
                            : (typeof translateTechnique === 'function' ? translateTechnique(i.name).name : i.name);
                        return `
                        <tr>
                            <td>${localItemName}</td>
                            <td class="arena-type">${i.type}</td>
                            <td class="arena-cost" style="color:${costColor};">${displayCost}</td>
                        </tr>`;
                    }).join('')}
                </table>
            </div>
        </div>
    `}).join(''); 
}

function toggleCompareTool() {
    const area = document.getElementById('compare-tool-area');
    if (area.classList.contains('hidden')) {
        area.classList.remove('hidden');
        const selA = document.getElementById('compareSelectA');
        const selB = document.getElementById('compareSelectB');
        if (selA.options.length <= 1) {
            deviations.forEach(dev => {
                const opt = document.createElement('option');
                opt.value = dev.name; 
                opt.textContent = typeof translateDeviationName === 'function' ? translateDeviationName(dev.name) : dev.name;
                selA.appendChild(opt);
                selB.appendChild(opt.cloneNode(true));
            });
        }
    } else {
        area.classList.add('hidden');
    }
}
function closeCompareTool() { document.getElementById('compare-tool-area').classList.add('hidden'); }

function updateComparison() {
    const nameA = document.getElementById('compareSelectA').value;
    const nameB = document.getElementById('compareSelectB').value;
    const resultArea = document.getElementById('compareResults');
    if (nameA === "Select Deviation A" || nameB === "Select Deviation B") return;
    
    const devA = deviations.find(d => d.name === nameA);
    const devB = deviations.find(d => d.name === nameB);
    const skillsA = new Set(devA.techniques);
    const skillsB = new Set(devB.techniques);
    const shared = [...skillsA].filter(x => skillsB.has(x)).sort();
    const uniqueA = [...skillsA].filter(x => !skillsB.has(x)).sort();
    const uniqueB = [...skillsB].filter(x => !skillsA.has(x)).sort();
    
    const renderList = (list, isShared) => list.length ? list.map(s => {
        const techData = typeof translateTechnique === 'function' ? translateTechnique(s) : { name: s, description: s };
        const desc = safeTooltip(techData.description);
        return `<div class="skill-item ${isShared?'skill-shared':''}" onmouseenter="showTooltip(event, '${desc}')" onmouseleave="hideTooltip()">${techData.name}</div>`;
    }).join('') : '<div style="opacity:0.5; font-size:0.8rem; text-align:center;">None</div>';
    
    const localA = typeof translateDeviationName === 'function' ? translateDeviationName(devA.name) : devA.name;
    const localB = typeof translateDeviationName === 'function' ? translateDeviationName(devB.name) : devB.name;

    resultArea.innerHTML = `
        <div class="compare-col"><div class="col-header">${localA}</div>${renderList(uniqueA, false)}</div>
        <div class="compare-col" style="border-color:var(--accent)"><div class="col-header" style="color:var(--accent)">Shared</div>${renderList(shared, true)}</div>
        <div class="compare-col"><div class="col-header">${localB}</div>${renderList(uniqueB, false)}</div>
    `;
}

function auditData() { 
    const techDefinitions = new Set(techniquesData.map(t => t.name)); 
    let missingTechCount = 0; 
    let html = ""; 

    deviations.forEach(dev => { 
        dev.techniques.forEach(tech => { 
            if (!techDefinitions.has(tech)) { 
                missingTechCount++; 
                html += `<div style="font-size:0.85rem; padding:4px 0; border-bottom:1px dotted #333;"><span style="color:var(--danger)">MISSING:</span> ${tech} (${dev.name})</div>`; 
            } 
        }); 
    }); 

    let missingPsi = 0; 
    let missingPassive = 0; 
    let missingStandard = 0;

    deviations.forEach(dev => { 
        if (!dev.psi || dev.psi === "Data needed") missingPsi++; 
        if (!dev.passive || dev.passive === "Data needed") missingPassive++; 
        // NEW: Check for Standard
        if (!dev.standard || dev.standard === "Data needed") missingStandard++;
    }); 

    const statusDiv = document.getElementById('dataSyncStatus');
    
    statusDiv.innerHTML = missingTechCount === 0 
        ? `<h4 style="color:var(--success);">Core Data Synced Successfully!</h4>` 
        : `<h4 style="color:var(--danger);">${missingTechCount} Issues Found</h4>${html}`; 
    
    // UPDATED: Added Standard Data Missing Stats
    statusDiv.innerHTML += `
    <div style="margin-top: 20px; border-top: 1px solid #444; padding-top: 10px; font-size: 0.85rem; color: #ccc;">
        <div style="display:flex; justify-content: space-between; margin-bottom:4px;"><span>Total Deviations:</span> <strong>${deviations.length}</strong></div>
        <div style="display:flex; justify-content: space-between; margin-bottom:4px;"><span>Total Techniques:</span> <strong>${techniquesData.length}</strong></div>
        <div style="display:flex; justify-content: space-between; margin-bottom:10px;"><span>Total Traits:</span> <strong>${traits.length}</strong></div>
        <div style="border-top:1px dotted #444; margin-top:5px; padding-top:5px;">
            <div style="display:flex; justify-content: space-between; color:#ffb74d;"><span>PSI Data Missing:</span> <strong>${missingPsi} / ${deviations.length}</strong></div>
            <div style="display:flex; justify-content: space-between; color:#ffb74d;"><span>Passive Data Missing:</span> <strong>${missingPassive} / ${deviations.length}</strong></div>
            <div style="display:flex; justify-content: space-between; color:#ffb74d;"><span>Standard Data Missing:</span> <strong>${missingStandard} / ${deviations.length}</strong></div>
        </div>
    </div>`; 
}

function openDataModal() { 
    document.getElementById('dataSyncModal').classList.remove('hidden'); 
    auditData(); // Re-run audit when opening to ensure stats are fresh
}

function closeDataModal() { document.getElementById('dataSyncModal').classList.add('hidden'); }

function populateUI() {
    sourceSelect.innerHTML = ""; builderDevSelect.innerHTML = "";
    deviations.forEach(dev => {
        const opt = document.createElement('option');
        opt.value = dev.name; 
        opt.textContent = typeof translateDeviationName === 'function' ? translateDeviationName(dev.name) : dev.name;
        sourceSelect.appendChild(opt);
        builderDevSelect.appendChild(opt.cloneNode(true));
    });
    const techniqueSet = new Set();
    deviations.forEach(d => d.techniques.forEach(t => techniqueSet.add(t)));
    allUniqueTechniques = Array.from(techniqueSet).sort();
    searchTechniqueSelect.innerHTML = "";
    allUniqueTechniques.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t; 
        const trans = typeof translateTechnique === 'function' ? translateTechnique(t) : { name: t };
        opt.textContent = trans.name; 
        searchTechniqueSelect.appendChild(opt);
    });
    buildTechniquesTable(); buildTraitsTable(); buildArenaShops(); buildDeviantsLibTable();
    sourceSelect.onchange = updateTechniques; builderDevSelect.onchange = updateBuilderTechniques;
    updateTechniques(); updateBuilderTechniques();

    // CONFIG: Hide Slot UI buttons if disabled
    if (!SHOW_SLOT_DATA) {
        document.querySelectorAll('.slot-btn').forEach(btn => btn.style.display = 'none');
        // Hide the separator text "|" if found before the buttons
        const slotBtns = document.querySelectorAll('.slot-btn');
        if(slotBtns.length > 0) {
            const separator = slotBtns[0].previousElementSibling;
            if(separator && separator.tagName === 'SPAN' && separator.innerHTML.includes('|')) {
                separator.style.display = 'none';
            }
        }
    }

    // CONFIG: Hide Builder Module if disabled
    if (!SHOW_BUILDER_MODULE) {
        const headers = document.querySelectorAll('h3');
        for (const h3 of headers) {
            if (h3.textContent.trim() === "Custom Build Planner") {
                 const panel = h3.closest('.tool-panel');
                 if(panel) panel.style.display = 'none';
                 break;
            }
        }
    }
}

function showTooltip(e, input) {
    if (window.innerWidth <= 768) return;
    let content = "";
    const techniqueInfo = techniquesData.find(t => t.name === input);
    content = techniqueInfo ? techniqueInfo.description : input;
    if (content) { tooltip.innerHTML = content; tooltip.style.display = 'block'; moveTooltip(e); }
}
function hideTooltip() { tooltip.style.display = 'none'; }
function moveTooltip(e) { tooltip.style.left = (e.pageX + 15) + 'px'; tooltip.style.top = (e.pageY + 15) + 'px'; }
document.addEventListener('mousemove', (e) => { if (tooltip.style.display === 'block') moveTooltip(e); });

function buildTechniquesTable() { 
    document.getElementById('techniquesBody').innerHTML = allUniqueTechniques.map(t => { 
        const trans = typeof translateTechnique === 'function' ? translateTechnique(t) : { name: t, description: 'Data needed' };
        return `<tr>
            <td style="font-weight:bold; color:#e0e0e0; vertical-align:middle; padding:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span>${trans.name}</span>
                    ${typeof getSuggestBtnHtml === 'function' ? getSuggestBtnHtml(t, 'technique_name') : ''}
                </div>
            </td>
            <td style="color:#aaa; vertical-align:middle; padding:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span>${trans.description}</span>
                    ${typeof getSuggestBtnHtml === 'function' ? getSuggestBtnHtml(t, 'technique_desc') : ''}
                </div>
            </td>
        </tr>`; 
    }).join(''); 
}
function filterTechniquesLib() { const val = document.getElementById('searchTechniquesLib').value.toUpperCase(); document.querySelectorAll('#techniquesBody tr').forEach(row => { row.style.display = row.innerText.toUpperCase().includes(val) ? "" : "none"; }); }

function buildDeviantsLibTable() {
    const tbody = document.getElementById('deviantsLibBody');
    if (!tbody) return;
    const sortedDevs = [...deviations].sort((a, b) => {
        const nameA = typeof translateDeviationName === 'function' ? translateDeviationName(a.name) : a.name;
        const nameB = typeof translateDeviationName === 'function' ? translateDeviationName(b.name) : b.name;
        return nameA.localeCompare(nameB);
    });

    tbody.innerHTML = sortedDevs.map(d => {
        const localName = typeof translateDeviationName === 'function' ? translateDeviationName(d.name) : d.name;
        const suggestBtn = typeof getSuggestBtnHtml === 'function' ? getSuggestBtnHtml(d.name, 'deviation') : '';
        return `<tr>
            <td style="font-weight:bold; color:#e0e0e0; vertical-align:middle; padding:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span>${d.name}</span>
                    ${suggestBtn}
                </div>
            </td>
            <td style="color:#aaa; vertical-align:middle; padding:12px;">${localName}</td>
        </tr>`;
    }).join('');
}
function filterDeviantsLib() {
    const val = document.getElementById('searchDeviantsLibInput').value.toUpperCase();
    document.querySelectorAll('#deviantsLibBody tr').forEach(row => {
        row.style.display = row.innerText.toUpperCase().includes(val) ? "" : "none";
    });
}
 
function buildTraitsTable() { 
    const tbody = document.getElementById('traitsBody');
    const sortedTraits = [...traits].sort((a, b) => {
        const transA = typeof translateTrait === 'function' ? translateTrait(a.name) : a;
        const transB = typeof translateTrait === 'function' ? translateTrait(b.name) : b;
        return transA.name.localeCompare(transB.name);
    });

    tbody.innerHTML = sortedTraits.map(t => {
        const trans = typeof translateTrait === 'function' ? translateTrait(t.name) : t;
        let slotBadge = (SHOW_SLOT_DATA && t.slot) ? `<span class="slot-badge float-right">S${t.slot}</span>` : '';

        return `
        <tr data-category="${t.category}" data-slot="${t.slot || 'none'}">
            <td style="font-weight:600; color:#e0e0e0; vertical-align:middle; padding:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span>${trans.name}</span>
                    <div style="display:flex; align-items:center; gap:5px;">
                        ${slotBadge}
                        ${typeof getSuggestBtnHtml === 'function' ? getSuggestBtnHtml(t.name, 'trait_name') : ''}
                    </div>
                </div>
            </td>
            <td style="vertical-align:middle; padding:12px;">${t.source || '-'}</td>
            <td style="vertical-align:middle; padding:12px;">${t.category}</td>
            <td style="color:#aaa; vertical-align:middle; padding:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span>${trans.description}</span>
                    ${typeof getSuggestBtnHtml === 'function' ? getSuggestBtnHtml(t.name, 'trait_desc') : ''}
                </div>
            </td>
        </tr>
    `}).join('');
}

function applyFilter(category, btn) { 
    currentCategoryFilter = category; 
    const container = btn.parentElement;
    container.querySelectorAll('.filter-btn:not(.slot-btn)').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); 
    filterTraits(); 
}

function applySlotFilter(slot, btn) {
    currentSlotFilter = String(slot);
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterTraits();
}

function filterTraits() { 
    const val = document.getElementById('searchTraits').value.toUpperCase(); 
    
    document.querySelectorAll('#traitsBody tr').forEach(row => { 
        const text = row.innerText.toUpperCase(); 
        const cat = row.getAttribute('data-category'); 
        const slot = row.getAttribute('data-slot'); 
        
        const matchCat = (currentCategoryFilter === 'All') || (cat === currentCategoryFilter); 
        const matchSlot = (currentSlotFilter === 'All') || (String(slot) === currentSlotFilter);
        const matchText = text.includes(val);

        if (matchText && matchCat && matchSlot) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    }); 
}

function filterDeviants(typeFilter, btn) {
    const area = document.getElementById('deviant-results-area'); const input = document.getElementById('deviantSearchInput');
    if (typeFilter) {
        if (currentDeviantTypeFilter === typeFilter && !area.classList.contains('hidden')) { area.classList.add('hidden'); return; }
        area.classList.remove('hidden'); currentDeviantTypeFilter = typeFilter;
        document.querySelectorAll('#deviant-filter-container .filter-btn').forEach(b => b.classList.remove('active'));
        if(btn) btn.classList.add('active');
    }
    const query = input.value.toUpperCase(); if (query.length > 0) area.classList.remove('hidden'); renderDeviants();
}
function resetDeviantSearch() { document.getElementById('deviantSearchInput').value = ""; currentDeviantTypeFilter = 'All'; document.querySelectorAll('#deviant-filter-container .filter-btn').forEach(b => b.classList.remove('active')); document.querySelector('.btn-all').classList.add('active'); document.getElementById('deviant-results-area').classList.add('hidden'); isListExpanded = false; renderDeviants(); }

function renderDeviants() {
    const query = document.getElementById('deviantSearchInput').value.toUpperCase();
    const container = document.getElementById('deviant-results-area');
    container.innerHTML = "";
    deviations.forEach(dev => {
        const localDevName = typeof translateDeviationName === 'function' ? translateDeviationName(dev.name) : dev.name;
        const nameMatch = dev.name.toUpperCase().includes(query) || localDevName.toUpperCase().includes(query);
        const typeMatch = (currentDeviantTypeFilter === 'All') || (dev.type === currentDeviantTypeFilter);
        if (nameMatch && typeMatch) {
            let status = 'status-neutral';
            if(dev.type === 'Combat') status = 'status-risky';
            if(dev.type === 'Territory') status = 'status-perfect';
            if(dev.type === 'Crafting') status = 'status-crafting'; 
            
            let psiDesc = dev.psi || "Data needed";
            if(psiDesc.includes(':')) psiDesc = psiDesc.split(/:(.*)/s)[1].trim();
            
            let passDesc = dev.passive || "Data needed";
            if(passDesc.includes(':')) passDesc = passDesc.split(/:(.*)/s)[1].trim();
            
            // NEW: Standard Data Handling
            let stdDesc = dev.standard || "Data needed";
            if(stdDesc.includes(':')) stdDesc = stdDesc.split(/:(.*)/s)[1].trim();

            const psiStr = (dev.psi && dev.psi !== "Data needed") ? dev.psi.split(':')[0] : "-";
            const passStr = (dev.passive && dev.passive !== "Data needed") ? dev.passive.split(':')[0] : "-";
            const stdStr = (dev.standard && dev.standard !== "Data needed") ? dev.standard.split(':')[0] : "-";

            // Localize sub-components where needed
            const translatedPsi = typeof translateTrait === 'function' ? translateTrait(psiStr) : { name: psiStr };
            const translatedPass = typeof translateTrait === 'function' ? translateTrait(passStr) : { name: passStr };
            const translatedStd = typeof translateTrait === 'function' ? translateTrait(stdStr) : { name: stdStr };

            container.innerHTML += `
                <div class="uni-card ${status}">
                    <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="card-title" style="display:flex; align-items:center;">
                            ${localDevName}
                            <span class="suggest-btn" style="cursor:pointer; margin-left:8px; opacity:0.6; font-size:0.9rem;" title="Suggest translation" onclick="openSuggestTranslation('${dev.name}', 'deviation')">🌐</span>
                        </span>
                        <span class="card-badge">${dev.type}</span>
                    </div>
                    <div class="tag-list">${dev.techniques.map(t => {
                        const techData = typeof translateTechnique === 'function' ? translateTechnique(t) : { name: t, description: t };
                        const techTip = safeTooltip(techData.description);
                        return `<span class="uni-tag" onmouseenter="showTooltip(event, '${techTip}')" onmouseleave="hideTooltip()">${techData.name}</span>`;
                    }).join('')}</div>
                    <div class="card-divider"></div>
                    <div class="card-body">
                        <div style="margin-bottom:4px; cursor:help;" onmouseenter="showTooltip(event, '${safeTooltip(translatedPsi.description || psiDesc)}')" onmouseleave="hideTooltip()"><strong style="color:#aaa;">PSI:</strong> ${translatedPsi.name}</div>
                        <div style="cursor:help;" onmouseenter="showTooltip(event, '${safeTooltip(translatedPass.description || passDesc)}')" onmouseleave="hideTooltip()"><strong style="color:#aaa;">Passive:</strong> ${translatedPass.name}</div>
                        
                        <div style="height:1px; background:#3e3e42; margin:6px 0; border-top:1px dashed #555;"></div>
                        
                        <div style="cursor:help;" onmouseenter="showTooltip(event, '${safeTooltip(translatedStd.description || stdDesc)}')" onmouseleave="hideTooltip()"><strong style="color:#aaa;">Standard:</strong> ${translatedStd.name}</div>
                    </div>
                </div>`;
        }
    });
}

function resetTechniqueSearch() { searchTechniqueSelect.selectedIndex = 0; document.getElementById('technique-results-area').innerHTML = ""; document.getElementById('technique-search-description').style.display = 'none'; }
function resetIsolationChecker() { sourceSelect.selectedIndex = 0; updateTechniques(); document.getElementById('results-area').innerHTML = ""; }
function updateTechniques() { 
    const dev = deviations.find(d => d.name === sourceSelect.value); 
    techniqueSelect.innerHTML = ""; 
    if(dev) dev.techniques.forEach(t => {
        const trans = typeof translateTechnique === 'function' ? translateTechnique(t) : { name: t };
        techniqueSelect.innerHTML += `<option value="${t}">${trans.name}</option>`;
    }); 
}

function findPartners() { 
    const sName = sourceSelect.value; 
    const tTechnique = techniqueSelect.value; 
    const sDev = deviations.find(d => d.name === sName); 
    const unwanted = sDev.techniques.filter(t => t !== tTechnique); 
    const resDiv = document.getElementById('results-area'); 
    resDiv.innerHTML = ""; 
    const candidates = deviations.filter(d => d.name !== sName && d.techniques.includes(tTechnique))
        .map(d => ({ name: d.name, overlap: d.techniques.filter(t => unwanted.includes(t)).length, overlapTechniques: d.techniques.filter(t => unwanted.includes(t)) }))
        .sort((a,b) => a.overlap - b.overlap); 
    if(candidates.length === 0) return resDiv.innerHTML = "<p>" + (typeof t === "function" ? t("ui.planner.noDonorsFound") : "No partners found.") + "</p>"; 
    candidates.forEach(c => { 
        let status = 'status-risky'; let label = 'RISKY';
        if (c.overlap === 0) { status = 'status-perfect'; label = 'PERFECT'; }
        else if (c.overlap === 1) { status = 'status-good'; label = 'GOOD'; }
        
        const localCandName = typeof translateDeviationName === 'function' ? translateDeviationName(c.name) : c.name;
        const localOverlaps = c.overlapTechniques.map(t => {
            const trans = typeof translateTechnique === 'function' ? translateTechnique(t) : { name: t };
            return trans.name;
        }).join(', ');

        const labelOverlap = typeof t === "function" ? t("ui.planner.overlap") : "Technique Overlap:";
        const labelRisk = typeof t === "function" ? t("ui.planner.risk") : "Risk:";

        resDiv.innerHTML += `
            <div class="uni-card gradient-card ${status}">
                <div class="card-header">
                    <span class="card-title">${localCandName}</span>
                    <span class="card-badge">${label}</span>
                </div>
                <div class="card-body">${labelOverlap} <strong style="color:white">${c.overlap}</strong></div>
                ${c.overlap > 0 ? `<div class="card-risk">${labelRisk} ${localOverlaps}</div>` : ''}
            </div>
        `;
    }); 
}

function searchByTechnique() { 
    const technique = searchTechniqueSelect.value; 
    const area = document.getElementById('technique-results-area'); 
    const descContainer = document.getElementById('technique-search-description'); 
    area.innerHTML = ""; 
    const trans = typeof translateTechnique === 'function' ? translateTechnique(technique) : { name: technique, description: "No description." };
    descContainer.innerHTML = trans.description; 
    descContainer.style.display = 'block'; 
    const results = deviations.filter(d => d.techniques.includes(technique)); 
    if (results.length === 0) return area.innerHTML = "<p>No results.</p>"; 
    results.forEach(d => {
        const localDevName = typeof translateDeviationName === 'function' ? translateDeviationName(d.name) : d.name;
        area.innerHTML += `<div class="uni-card status-neutral"><div class="card-header"><span class="card-title">${localDevName}</span></div></div>`;
    }); 
}

function addTrait() {
    const input = document.getElementById('traitInput');
    const val = input.value.trim();
    if(!val) return;
    let traitName = val; let traitSource = "";
    const match = val.match(/^(.*) \[(.*)\]$/);
    if (match) { traitName = match[1]; traitSource = match[2]; }
    
    traitSource = traitSource.replace(/\s*\[S\d+\]$/, '');

    let traitInfo;
    if (traitSource) {
        traitInfo = traits.find(t => {
            const trans = typeof translateTrait === 'function' ? translateTrait(t.name) : t;
            return (t.name === traitName || trans.name === traitName) && t.source === traitSource;
        });
    } else {
        traitInfo = traits.find(t => {
            const trans = typeof translateTrait === 'function' ? translateTrait(t.name) : t;
            return t.name === traitName || trans.name === traitName;
        });
    }
    if (!traitInfo) { showToast(t("ui.messages.traitNotFound"), true); return; }
    const duplicate = userSelectedTraits.find(t => t.name === traitInfo.name && t.source === traitInfo.source);
    if(duplicate) { input.value = ""; return; }
    userSelectedTraits.push(traitInfo);
    renderSelectedTraits();
    input.value = "";
}
function removeTrait(index) { userSelectedTraits.splice(index, 1); renderSelectedTraits(); }

function renderSelectedTraits() {
    const container = document.getElementById('selectedTraits');
    container.innerHTML = "";
    userSelectedTraits.forEach((t, idx) => {
        // DYNAMIC: Only show badge if enabled
        const slotBadge = (SHOW_SLOT_DATA && t.slot) ? `<span class="slot-badge mini">S${t.slot}</span>` : '';
        const trans = typeof translateTrait === 'function' ? translateTrait(t.name) : t;

        const suggestBtn = typeof getSuggestBtnHtml === 'function' ? getSuggestBtnHtml(t.name, 'trait_name') : '';
        container.innerHTML += `
            <div class="trait-mini-card">
                <span>${trans.name}${slotBadge} ${suggestBtn}</span>
                <span class="remove-btn" onclick="removeTrait(${idx}); event.stopPropagation();">✕</span>
            </div>`;
    });
}

function updateBuilderTechniques() {
    const dev = deviations.find(d => d.name === builderDevSelect.value);
    const container = document.getElementById('builderCheckboxes');
    container.innerHTML = "";
    document.getElementById('builderResults').innerHTML = "";
    if (dev) {
        [...dev.techniques].sort().forEach(technique => {
            const techData = typeof translateTechnique === 'function' ? translateTechnique(technique) : { name: technique, description: technique };
            const desc = safeTooltip(techData.description);
            const suggestBtn = typeof getSuggestBtnHtml === 'function' ? getSuggestBtnHtml(technique, 'technique_name') : '';
            
            container.innerHTML += `<div class="checkbox-item" onmouseenter="showTooltip(event, '${desc}')" onmouseleave="hideTooltip()" onclick="document.getElementById('chk_${technique.replace(/[^a-zA-Z0-9]/g,'')}').click()"><input type="checkbox" id="chk_${technique.replace(/[^a-zA-Z0-9]/g,'')}" value="${technique}" onclick="event.stopPropagation()"><label>${techData.name}</label>${suggestBtn}</div>`;
        });
    }
    if (typeof updateTargetDeviantSuggestBtn === 'function') updateTargetDeviantSuggestBtn();
}

function generatePlan() {
    if (typeof isTeamMode !== 'undefined' && isTeamMode) {
        saveCurrentBuildToSlot(activeTeamSlot);
        renderTeamSlots(); 
    } else {
        const teamUI = document.getElementById('team-ui-area');
        if (teamUI && teamUI.classList.contains('hidden')) teamUI.classList.remove('hidden');
    }

    const name = builderDevSelect.value;
    const sourceDev = deviations.find(d => d.name === name);
    const selected = Array.from(document.querySelectorAll('#builderCheckboxes input:checked')).map(cb => cb.value);
    const results = document.getElementById('builderResults');
    
    if (selected.length === 0 && userSelectedTraits.length === 0) return results.innerHTML = "<p style='color:var(--warning); grid-column: 1 / -1; width: 100%; text-align: center; margin: 15px 0; font-weight: 600;'>" + (typeof t === "function" ? t("ui.planner.noSelectionWarning") : "Please select at least one technique or trait.") + "</p>";
    
    let html = ``;
    
    if (selected.length > 0) {
        html += `<div style="grid-column:1/-1; margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px; color:white; font-weight:bold;">${typeof t === "function" ? t("ui.planner.techDonors") : "TECHNIQUE DONORS"}</div>`;
        selected.forEach((technique, index) => {
            const unwanted = sourceDev.techniques.filter(t => t !== technique);
            
            const candidates = deviations.filter(d => d.name !== name && d.techniques.includes(technique))
                .map(d => ({ 
                    name: d.name, 
                    overlap: d.techniques.filter(t => unwanted.includes(t)).length, 
                    overlapTechniques: d.techniques.filter(t => unwanted.includes(t)) 
                }))
                .sort((a,b) => {
                    if (a.overlap !== b.overlap) return a.overlap - b.overlap;
                    const aShop = shopDeviationNames.has(a.name);
                    const bShop = shopDeviationNames.has(b.name);
                    if (aShop !== bShop) return aShop ? -1 : 1;
                    if (aShop && bShop) {
                        const aChaos = a.name.includes("Chaos");
                        const bChaos = b.name.includes("Chaos");
                        if (aChaos !== bChaos) return aChaos ? 1 : -1;
                    }
                    return a.name.localeCompare(b.name);
                });
            
            let initClass = 'status-risky';
            if (candidates.length > 0) {
                if (candidates[0].overlap === 0) initClass = 'status-perfect';
                else if (candidates[0].overlap === 1) initClass = 'status-good';
            }

            const techData = typeof translateTechnique === 'function' ? translateTechnique(technique) : { name: technique, description: technique };
            const techTip = safeTooltip(techData.description);

            html += `
            <div class="uni-card gradient-card donor-card ${initClass}" id="technique-card-${index}">
                <div class="card-header">
                    <span class="card-title" onmouseenter="showTooltip(event, '${techTip}')" onmouseleave="hideTooltip()">${techData.name}</span>
                    <div style="display:flex; align-items:center;">
                        <span class="badge-shop" onmouseenter="showTooltip(event, 'Found in Shop')" onmouseleave="hideTooltip()">SHOP</span>
                        <span class="card-badge badge-dynamic">Calculating...</span>
                    </div>
                </div>
                <div class="card-risk dynamic-risk"></div>
                
                <div class="donor-select-container">
                    <select class="donor-select" onchange="updateDonorCard(this)" style="padding:6px; background:#1a1a1a; font-size:0.8rem;">
            `;
            if(candidates.length === 0) html += `<option>No donors found</option>`;
            else {
                candidates.forEach(c => {
                    let label = c.overlap === 0 ? "PERFECT" : (c.overlap === 1 ? "GOOD" : "RISKY");
                    const junkStr = c.overlap > 0 ? `Risk: ${c.overlapTechniques.map(t => {
                        const trans = typeof translateTechnique === 'function' ? translateTechnique(t) : { name: t };
                        return trans.name;
                    }).join(', ')}` : "";
                    const isShop = shopDeviationNames.has(c.name);
                    const arenaName = shopDeviationArena[c.name] || "";
                    const localCandName = typeof translateDeviationName === 'function' ? translateDeviationName(c.name) : c.name;
                    html += `<option value="${c.overlap}" data-label="${label}" data-junk="${junkStr}" data-shop="${isShop}" data-arena="${arenaName}">(${label}) ${localCandName} ${isShop ? '[SHOP]' : ''}</option>`;
                });
            }
            html += `</select></div></div>`;
        });
    }

    if (userSelectedTraits.length > 0) {
        html += `<div style="grid-column:1/-1; margin:15px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px; color:white; font-weight:bold;">${typeof t === "function" ? t("ui.planner.traitSources") : "PASSIVE TRAIT SOURCES"}</div>`;
        
        const slotCounts = {};
        userSelectedTraits.forEach(t => {
            if (t.slot) {
                slotCounts[t.slot] = (slotCounts[t.slot] || 0) + 1;
            }
        });

        userSelectedTraits.forEach(t => {
            // DYNAMIC: Only show badge if enabled
            const slotBadge = (SHOW_SLOT_DATA && t.slot) ? `<span class="slot-badge">S${t.slot}</span>` : '';
            const trans = typeof translateTrait === 'function' ? translateTrait(t.name) : t;
            
            let warningBadge = '';
            // DYNAMIC: Only calculate warnings if enabled
            if (SHOW_SLOT_DATA && t.slot && slotCounts[t.slot] > 1) {
                warningBadge = `<span class="warning-badge" onmouseenter="showTooltip(event, 'Warning: Duplicate Slot ${t.slot}')" onmouseleave="hideTooltip()">!</span>`;
            }

            html += `
                <div class="uni-card status-purple" onmouseenter="showTooltip(event, '${safeTooltip(trans.description)}')" onmouseleave="hideTooltip()">
                    <div class="card-header left-align">
                        <span class="card-title">${trans.name}</span>
                        ${warningBadge}
                        ${slotBadge}
                    </div>
                    <div class="card-body">Source: <strong style="color:white">${t.source}</strong></div>
                </div>
            `;
        });
    }
    
    results.innerHTML = html;
    setTimeout(() => { document.querySelectorAll('.donor-select').forEach(sel => updateDonorCard(sel)); }, 10);
}

function updateDonorCard(select) {
    const card = select.closest('.uni-card');
    const selectedOption = select.options[select.selectedIndex];
    const label = selectedOption.getAttribute('data-label');
    const junk = selectedOption.getAttribute('data-junk');
    const isShop = selectedOption.getAttribute('data-shop') === "true";
    const arena = selectedOption.getAttribute('data-arena');
    
    const badge = card.querySelector('.badge-dynamic');
    const shopBadge = card.querySelector('.badge-shop');
    const riskDiv = card.querySelector('.dynamic-risk');
    
    card.classList.remove('status-perfect', 'status-good', 'status-risky', 'status-neutral');
    
    badge.textContent = label;
    riskDiv.textContent = junk;

    if (label === "PERFECT") card.classList.add('status-perfect');
    else if (label === "GOOD") card.classList.add('status-good');
    else card.classList.add('status-risky');

    if (isShop) { 
        shopBadge.style.display = "inline-block"; 
        shopBadge.onmouseenter = (e) => showTooltip(e, arena);
        shopBadge.onmouseleave = hideTooltip;
    } else { 
        shopBadge.style.display = "none"; 
        shopBadge.onmouseenter = null;
    }
}

function serializeCurrentBuild() {
    const target = builderDevSelect.value;
    const skills = Array.from(document.querySelectorAll('#builderCheckboxes input:checked')).map(cb => cb.value);
    const traitData = userSelectedTraits.map(t => ({n: t.name, s: t.source}));
    if (!target || target === "Loading..." || target === "" || (skills.length === 0 && traitData.length === 0)) {
        return null;
    }
    const payload = { d: target, s: skills, t: traitData };
    return btoa(JSON.stringify(payload));
}

function resetBuilder(keepTeamMode = false) {
    builderDevSelect.selectedIndex = 0; updateBuilderTechniques(); userSelectedTraits = [];
    document.getElementById('traitInput').value = ""; document.getElementById('builderResults').innerHTML = ""; renderSelectedTraits();
    if (!keepTeamMode && typeof deleteTeam === 'function') deleteTeam();
}

function loadShareCode() {
    const code = document.getElementById('shareCodeInput').value.trim();
    if(!code) return;
    try {
        const payload = JSON.parse(atob(code));
        if (Array.isArray(payload)) { document.getElementById('team-ui-area').classList.remove('hidden'); teamData = payload; if(typeof initTeamMode==="function"){initTeamMode(true);activeTeamSlot=0;renderTeamSlots();if(teamData[0])restoreBuildFromData(teamData[0]);} } 
        else { if (typeof isTeamMode !== 'undefined' && isTeamMode) restoreBuildFromData(payload); else restoreBuildFromData(payload); }
        document.getElementById('shareStatus').textContent = "Loaded!";
    } catch(e) { showToast(t("ui.messages.invalidCode"), true); }
}

function generateShareCode() {
    let payload;
    if (typeof isTeamMode !== 'undefined' && isTeamMode) { saveCurrentBuildToSlot(activeTeamSlot); payload = teamData; } 
    else {
        const target = builderDevSelect.value;
        const skills = Array.from(document.querySelectorAll('#builderCheckboxes input:checked')).map(cb => cb.value);
        const traitData = userSelectedTraits.map(t => ({n: t.name, s: t.source}));
        if (skills.length === 0 && traitData.length === 0) return;
        payload = { d: target, s: skills, t: traitData };
    }
    const base64 = btoa(JSON.stringify(payload));
    navigator.clipboard.writeText(base64);
    document.getElementById('shareCodeInput').value = base64;
    document.getElementById('shareStatus').textContent = "Copied!";
}

function suggestCurrentTargetDeviant() {
    const val = document.getElementById('builderDevSelect').value;
    if (val && val !== 'Loading...') {
        if (typeof openSuggestTranslation === 'function') {
            openSuggestTranslation(val, 'deviation');
        }
    }
}

function updateTargetDeviantSuggestBtn() {
    const btn = document.getElementById('btnSuggestTargetDev');
    if (!btn) return;
    const val = document.getElementById('builderDevSelect').value;
    if (!val || val === 'Loading...') {
        btn.style.display = 'none';
        return;
    }
    if (typeof onlineTranslationsMetadata === 'undefined') {
        btn.style.display = 'flex';
        return;
    }
    const isDef = onlineTranslationsMetadata[val] && onlineTranslationsMetadata[val][currentLang] && onlineTranslationsMetadata[val][currentLang].definitive;
    btn.style.display = isDef ? 'none' : 'flex';
}

init();
