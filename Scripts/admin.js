let currentUser = null;
let isAdmin = false;
let pendingProposals = [];
let onlineTranslations = {};

// Watch Auth state
document.addEventListener("DOMContentLoaded", () => {
  if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged(async (user) => {
      currentUser = user;
      const loginTab = document.getElementById("tab-login");
      const profileTab = document.getElementById("tab-profile");
      const adminTab = document.getElementById("tab-admin");

      if (user) {
        // Logged in
        console.log("Logged in user:", user.email);
        
        // Hide Login, Show Profile
        if (loginTab) loginTab.style.display = 'none';
        if (profileTab) {
          profileTab.style.display = 'block';
          profileTab.textContent = user.displayName || user.email.split('@')[0];
        }

        // Check if Admin
        try {
          const userDoc = await db.collection("users").doc(user.uid).get();
          if (userDoc.exists && userDoc.data().role === 'admin') {
            isAdmin = true;
            if (adminTab) adminTab.style.display = 'block';
          } else {
            isAdmin = false;
            if (adminTab) adminTab.style.display = 'none';
          }
        } catch (e) {
          console.warn("Could not check admin status:", e);
        }

        // Show cloud save options if builder active
        const btnSaveCloud = document.getElementById("btnSaveCloud");
        if (btnSaveCloud) btnSaveCloud.style.display = 'inline-block';
      } else {
        // Logged out
        console.log("User logged out");
        isAdmin = false;
        if (loginTab) loginTab.style.display = 'block';
        if (profileTab) profileTab.style.display = 'none';
        if (adminTab) adminTab.style.display = 'none';
        
        const btnSaveCloud = document.getElementById("btnSaveCloud");
        if (btnSaveCloud) btnSaveCloud.style.display = 'none';
      }
    });
  }
});

// Message helpers for modal auth
function showAuthMessage(text, isError = false) {
  const msgEl = document.getElementById("authModalMessage");
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.style.display = "block";
  if (isError) {
    msgEl.style.background = "rgba(255, 82, 82, 0.15)";
    msgEl.style.border = "1px solid rgba(255, 82, 82, 0.3)";
    msgEl.style.color = "var(--danger)";
  } else {
    msgEl.style.background = "rgba(76, 175, 80, 0.15)";
    msgEl.style.border = "1px solid rgba(76, 175, 80, 0.3)";
    msgEl.style.color = "var(--success)";
  }
}

function clearAuthMessage() {
  const msgEl = document.getElementById("authModalMessage");
  if (msgEl) {
    msgEl.textContent = "";
    msgEl.style.display = "none";
  }
}

async function trackUniqueVisit() {
  if (typeof db === 'undefined') return;
  if (!localStorage.getItem("oh_tools_visited")) {
    try {
      await db.collection("stats").doc("visits").set({
        count: firebase.firestore.FieldValue.increment(1)
      }, { merge: true });
      localStorage.setItem("oh_tools_visited", "true");
    } catch(err) {
      console.warn("Error tracking visit:", err);
    }
  }
}

// Authentications Flows
async function handleRegister(username, email, password, contact) {
  clearAuthMessage();
  if (!username || !email || !password) {
    showAuthMessage(t("ui.messages.fillAll"), true);
    return;
  }
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    // Set display name to Username
    await user.updateProfile({ displayName: username });

    // Store custom attributes in Firestore user doc
    await db.collection("users").doc(user.uid).set({
      username: username,
      email: email,
      contact: contact || "",
      role: "user",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showAuthMessage(t("ui.messages.registerSuccess"), false);
    setTimeout(() => {
      closeAuthModal();
    }, 1500);
  } catch (err) {
    showAuthMessage("Register Error: " + err.message, true);
  }
}

async function handleLogin(email, password) {
  clearAuthMessage();
  if (!email || !password) {
    showAuthMessage(t("ui.messages.fillCredentials"), true);
    return;
  }
  try {
    await auth.signInWithEmailAndPassword(email, password);
    showAuthMessage(t("ui.messages.loginSuccess"), false);
    setTimeout(() => {
      closeAuthModal();
    }, 1500);
  } catch (err) {
    showAuthMessage("Login Error: " + err.message, true);
  }
}

async function handlePasswordRecovery(email) {
  clearAuthMessage();
  if (!email) {
    showAuthMessage(t("ui.messages.enterEmail"), true);
    return;
  }
  try {
    await auth.sendPasswordResetEmail(email);
    showAuthMessage(t("ui.messages.recoverSuccess"), false);
    setTimeout(() => {
      showAuthView('login');
      clearAuthMessage();
    }, 1500);
  } catch (err) {
    showAuthMessage("Password Recovery Error: " + err.message, true);
  }
}

async function handleLogout() {
  try {
    await auth.signOut();
    location.reload();
  } catch (err) {
    alert("Logout Error: " + err.message);
  }
}

// Translation Submissions (Firestore Proposals)
async function suggestTranslation(termKey, type, proposedText) {
  if (!currentUser) {
    alert(t("messages.noAuth"));
    openAuthModal();
    return;
  }
  if (!proposedText) {
    alert("Please enter translation!");
    return;
  }

  const proposalId = `${termKey}_${currentLang}`;
  try {
    await db.collection("proposals").doc(proposalId).set({
      termKey: termKey,
      lang: currentLang,
      type: type,
      proposedText: proposedText,
      status: "pending",
      submittedBy: currentUser.uid,
      submittedByName: currentUser.displayName || currentUser.email,
      submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert(t("messages.translationSubmitted"));
    closeTranslationModal();
  } catch (err) {
    alert("Error submitting translation: " + err.message);
  }
}

// Admin Moderation Actions
async function loadPendingProposalsList() {
  if (!isAdmin) return;
  const listContainer = document.getElementById("adminProposalsList");
  if (!listContainer) return;
  listContainer.innerHTML = "<div class='loading-spinner'>Loading...</div>";

  try {
    const snapshot = await db.collection("proposals")
      .where("status", "==", "pending")
      .where("lang", "==", currentLang)
      .get();

    pendingProposals = [];
    snapshot.forEach(doc => {
      pendingProposals.push({ id: doc.id, ...doc.data() });
    });

    renderAdminProposals();
  } catch (err) {
    listContainer.innerHTML = "<div class='error-msg'>Error loading proposals: " + err.message + "</div>";
  }
}

function renderAdminProposals() {
  const listContainer = document.getElementById("adminProposalsList");
  if (pendingProposals.length === 0) {
    listContainer.innerHTML = "<div style='text-align:center; padding: 20px; opacity: 0.5;'>" + (typeof t === "function" ? t("messages.noPendingProposals") : "No pending translations for this language.") + "</div>";
    return;
  }

  listContainer.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th width="5%"><input type="checkbox" id="selectAllProposals" onchange="toggleSelectAllProposals(this.checked)"></th>
          <th width="20%">${t("ui.moderation.keyEn")}</th>
          <th width="15%">${t("ui.moderation.type")}</th>
          <th>${t("ui.moderation.proposedTranslation")}</th>
          <th width="20%">${t("ui.moderation.submittedBy")}</th>
        </tr>
      </thead>
      <tbody>
        ${pendingProposals.map(p => `
          <tr>
            <td><input type="checkbox" class="proposal-checkbox" value="${p.id}"></td>
            <td><strong>${p.termKey}</strong></td>
            <td><span class="badge">${p.type}</span></td>
            <td><span style="color:var(--success); font-weight:bold;">${p.proposedText}</span></td>
            <td style="font-size:0.8rem; color:#888;">${p.submittedByName}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function toggleSelectAllProposals(checked) {
  document.querySelectorAll(".proposal-checkbox").forEach(chk => {
    chk.checked = checked;
  });
}

// Bulk Actions
async function handleBulkModeration(status) {
  if (!isAdmin) return;
  const checkedBoxes = document.querySelectorAll(".proposal-checkbox:checked");
  if (checkedBoxes.length === 0) {
    alert("Please select at least one proposal!");
    return;
  }

  const ids = Array.from(checkedBoxes).map(chk => chk.value);
  if (!confirm(`Are you sure you want to ${status === 'approved' ? 'APPROVE' : 'DECLINE'} ${ids.length} translations?`)) {
    return;
  }

  const batch = db.batch();

  try {
    for (const id of ids) {
      const proposalRef = db.collection("proposals").doc(id);
      const proposal = pendingProposals.find(p => p.id === id);
      
      batch.update(proposalRef, { 
        status: status,
        moderatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (status === 'approved') {
        const transRef = db.collection("translations").doc(id);
        batch.set(transRef, {
          termKey: proposal.termKey,
          lang: proposal.lang,
          type: proposal.type,
          approvedText: proposal.proposedText,
          moderatedBy: currentUser.uid,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    await batch.commit();
    alert(`Successfully ${status === 'approved' ? 'approved' : 'declined'} selected items!`);
    
    // Reload list
    loadPendingProposalsList();
    
    // Fetch and apply translations immediately
    await fetchOnlineTranslations();
  } catch (err) {
    alert("Error moderating: " + err.message);
  }
}

// Fetch approved online translations
async function fetchOnlineTranslations() {
  if (typeof db === 'undefined') return;
  try {
    const snapshot = await db.collection("translations").get();

    onlineTranslations = {};
    onlineTranslationsMetadata = {};
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const termKey = data.termKey;
      const lang = data.lang;
      
      if (!onlineTranslationsMetadata[termKey]) {
        onlineTranslationsMetadata[termKey] = {};
      }
      onlineTranslationsMetadata[termKey][lang] = {
        approvedText: data.approvedText,
        definitive: !!data.definitive
      };

      if (lang === currentLang) {
        onlineTranslations[termKey] = data.approvedText;
      }
    });

    // Merge online approved translations into active localeData
    if (Object.keys(onlineTranslations).length > 0) {
      applyOnlineTranslations();
    }
  } catch (err) {
    console.warn("Could not load online translations:", err);
  }
}

function applyOnlineTranslations() {
  if (!localeData || !localeData.deviations) return;
  
  Object.keys(onlineTranslations).forEach(key => {
    const text = onlineTranslations[key];
    
    // Mapeamento dinâmico baseado no prefixo/chave encontrado no dicionário
    if (localeData.deviations[key] !== undefined) {
      localeData.deviations[key] = text;
    } else if (localeData.traits[key] !== undefined) {
      localeData.traits[key].name = text;
    } else if (localeData.techniques[key] !== undefined) {
      localeData.techniques[key].name = text;
    }
  });

  applyi18n();
  // Trigger table redraws
  if (typeof buildTraitsTable === 'function') buildTraitsTable();
  if (typeof buildArenaShops === 'function') buildArenaShops();
  if (typeof buildTechniquesTable === 'function') buildTechniquesTable();
  if (typeof buildDeviantsLibTable === 'function') buildDeviantsLibTable();
  if (typeof populateUI === 'function') populateUI();
  if (typeof renderDeviants === 'function') renderDeviants();
}

// Auth modal controller
function openAuthModal() {
  clearAuthMessage();
  const modal = document.getElementById("authModal");
  if (modal) modal.classList.remove("hidden");
  showAuthView('login');
}
function closeAuthModal() {
  clearAuthMessage();
  const modal = document.getElementById("authModal");
  if (modal) modal.classList.add("hidden");
}
function showAuthView(view) {
  document.getElementById("auth-login-view").style.display = view === 'login' ? 'block' : 'none';
  document.getElementById("auth-register-view").style.display = view === 'register' ? 'block' : 'none';
  document.getElementById("auth-recover-view").style.display = view === 'recover' ? 'block' : 'none';
}

// User Profile modal controller
async function openProfileModal() {
  const modal = document.getElementById("profileModal");
  if (!modal) return;
  modal.classList.remove("hidden");

  const container = document.getElementById("profileDetailsContainer");
  if (currentUser) {
    const labelLogged = typeof t === "function" ? t("ui.profile.loggedAs") : "Logged as:";
    const labelLoading = typeof t === "function" ? t("ui.profile.loadingPlans") : "Loading cloud plans...";
    container.innerHTML = `
      <div style="margin-bottom:15px;">
        <label style="color:#aaa; font-size:0.8rem;">${labelLogged}</label>
        <div style="color:white; font-size:1.1rem; font-weight:bold;">${currentUser.displayName || 'User'}</div>
        <div style="color:#888; font-size:0.9rem;">${currentUser.email}</div>
      </div>
      <div id="profileSavedPlans">${labelLoading}</div>
    `;
    loadCloudPlans();
  }
}
function closeProfileModal() {
  const modal = document.getElementById("profileModal");
  if (modal) modal.classList.add("hidden");
}

// Cloud plans sharing
async function loadCloudPlans() {
  const plansContainer = document.getElementById("profileSavedPlans");
  if (!plansContainer || !currentUser) return;
  try {
    const snapshot = await db.collection("users").doc(currentUser.uid).collection("plans").get();
    let plans = [];
    snapshot.forEach(doc => plans.push({ id: doc.id, ...doc.data() }));

    if (plans.length === 0) {
      const labelNoPlans = typeof t === "function" ? t("ui.profile.noPlans") : "No cloud saved plans yet.";
      plansContainer.innerHTML = `<div style='opacity:0.5; font-size:0.9rem; margin-top:15px;'>${labelNoPlans}</div>`;
      return;
    }

    const labelCloudPlans = typeof t === "function" ? t("ui.profile.cloudPlans") : "Cloud Plans";
    plansContainer.innerHTML = `
      <h4 style="margin:15px 0 10px 0; color:var(--accent);">${labelCloudPlans}</h4>
      <div style="max-height: 200px; overflow-y:auto; border:1px solid #333; border-radius:4px; padding:5px;">
        ${plans.map(p => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #222;">
            <span style="font-size:0.9rem; color:white; cursor:pointer;" onclick="loadCloudPlanCode('${p.code}')">${p.name}</span>
            <button class="secondary" style="padding:4px 8px; font-size:0.8rem; border-color:var(--danger); color:var(--danger);" onclick="deleteCloudPlan('${p.id}')">✕</button>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    plansContainer.innerHTML = "<div style='color:var(--danger);'>Error: " + err.message + "</div>";
  }
}

async function savePlanToCloud() {
  if (!currentUser) {
    alert("Please log in to save plans to the cloud!");
    openAuthModal();
    return;
  }
  const name = prompt("Enter a name for your plan:");
  if (!name) return;

  const build = serializeCurrentBuild(); // Serializer function from script.js
  if (!build) {
    alert("Build is empty!");
    return;
  }

  try {
    await db.collection("users").doc(currentUser.uid).collection("plans").add({
      name: name,
      code: build,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Plan successfully saved to cloud!");
    if (document.getElementById("profileModal").classList.contains("hidden") === false) {
      loadCloudPlans();
    }
  } catch (err) {
    alert("Error saving: " + err.message);
  }
}

function loadCloudPlanCode(code) {
  const shareCodeInput = document.getElementById("shareCodeInput");
  if (shareCodeInput) {
    shareCodeInput.value = code;
    loadShareCode(); // Decodes and sets the UI
    closeProfileModal();
  }
}

async function deleteCloudPlan(planId) {
  if (!confirm("Are you sure you want to delete this plan?")) return;
  try {
    await db.collection("users").doc(currentUser.uid).collection("plans").doc(planId).delete();
    loadCloudPlans();
  } catch (err) {
    alert("Error deleting: " + err.message);
  }
}

// UI Suggestion modal controllers
let activeSuggestKey = "";
let activeSuggestType = "";
function openSuggestTranslation(key, type) {
  activeSuggestKey = key;
  activeSuggestType = type;
  const modal = document.getElementById("suggestTranslationModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  document.getElementById("suggestTargetKey").textContent = key;
  document.getElementById("suggestProposedInput").value = "";
}
function closeTranslationModal() {
  const modal = document.getElementById("suggestTranslationModal");
  if (modal) modal.classList.add("hidden");
}

// Metadata map for translation states
let onlineTranslationsMetadata = {};

let allLocalesCached = {};

async function cacheAllLocales() {
  const langs = ['pt', 'es', 'fr', 'zh', 'en'];
  for (const lang of langs) {
    if (!allLocalesCached[lang]) {
      try {
        const res = await fetch(`Locales/${lang}.json`);
        if (res.ok) {
          allLocalesCached[lang] = await res.json();
        }
      } catch (err) {
        console.warn(`Error caching locale ${lang}:`, err);
      }
    }
  }
}

function getLocalTranslation(key, type, lang) {
  const data = allLocalesCached[lang];
  if (!data) return "";
  if (type === 'deviation') {
    return (data.deviations && data.deviations[key]) || "";
  } else if (type === 'technique') {
    return (data.techniques && data.techniques[key] && data.techniques[key].name) || "";
  } else if (type === 'trait') {
    return (data.traits && data.traits[key] && data.traits[key].name) || "";
  }
  return "";
}

async function loadAllOnlineTranslations() {
  if (!isAdmin) return;
  const tableBody = document.getElementById("adminConsoleTableBody");
  if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="loading-spinner">Loading...</td></tr>`;

  try {
    await cacheAllLocales();
    const snapshot = await db.collection("translations").get();
    onlineTranslationsMetadata = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      const termKey = data.termKey;
      const lang = data.lang;
      if (!onlineTranslationsMetadata[termKey]) {
        onlineTranslationsMetadata[termKey] = {};
      }
      onlineTranslationsMetadata[termKey][lang] = {
        approvedText: data.approvedText,
        definitive: !!data.definitive
      };
    });

    renderTranslationConsoleTable();
  } catch (err) {
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="error-msg">Error: ${err.message}</td></tr>`;
  }
}

function renderTranslationConsoleTable() {
  const tableBody = document.getElementById("adminConsoleTableBody");
  if (!tableBody) return;

  const searchQuery = document.getElementById("adminConsoleSearch").value.toUpperCase();
  const typeFilter = document.getElementById("adminConsoleTypeFilter").value;

  let termsList = [];
  
  if (typeFilter === 'All' || typeFilter === 'deviation') {
    deviations.forEach(d => termsList.push({ key: d.name, type: 'deviation' }));
  }
  if (typeFilter === 'All' || typeFilter === 'technique') {
    const uniqTechs = new Set();
    deviations.forEach(d => d.techniques.forEach(tech => uniqTechs.add(tech)));
    uniqTechs.forEach(tech => termsList.push({ key: tech, type: 'technique' }));
  }
  if (typeFilter === 'All' || typeFilter === 'trait') {
    traits.forEach(t => termsList.push({ key: t.name, type: 'trait' }));
  }

  if (searchQuery) {
    termsList = termsList.filter(t => t.key.toUpperCase().includes(searchQuery));
  }

  termsList.sort((a, b) => a.key.localeCompare(b.key));

  const langs = ['pt', 'es', 'fr', 'zh'];

  tableBody.innerHTML = termsList.map(t => {
    const meta = onlineTranslationsMetadata[t.key] || {};
    
    return `
      <tr>
        <td style="padding: 10px; font-weight: 600;">${t.key}</td>
        <td style="padding: 10px;"><span class="badge">${t.type}</span></td>
        ${langs.map(lang => {
          const langData = meta[lang] || { approvedText: "", definitive: false };
          const prefilledVal = langData.approvedText || getLocalTranslation(t.key, t.type, lang);
          return `
            <td style="padding: 8px 12px; min-width: 160px; vertical-align: top;">
              <input type="text" 
                     id="console-trans-${t.key.replace(/'/g, "&apos;")}-${lang}" 
                     value="${prefilledVal || ''}" 
                     placeholder="${t("ui.fields.translate")}"
                     style="width: 100%; box-sizing: border-box; padding: 6px 10px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--bg-input); color: white; margin-bottom: 6px; font-size: 0.8rem; display: block;">
              <label style="font-size:0.7rem; display:flex; align-items:center; gap:5px; margin-top:2px; cursor: pointer; user-select: none; color: #aaa;">
                <input type="checkbox" 
                       id="console-def-${t.key.replace(/'/g, "&apos;")}-${lang}" 
                       ${langData.definitive ? 'checked' : ''} 
                       style="width:auto; margin:0; cursor: pointer;">
                ${t("ui.moderation.definitive")}
              </label>
            </td>
          `;
        }).join('')}
        <td style="padding: 10px; text-align: center; vertical-align: middle;">
          <button onclick="saveConsoleTranslation('${t.key.replace(/'/g, "\\'")}', '${t.type}')" 
                  style="padding:8px 14px; font-size:0.75rem; border-radius:var(--radius); width:100%; box-sizing:border-box; font-weight:600; cursor: pointer;">
            ${t("ui.moderation.save")}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function saveConsoleTranslation(termKey, type) {
  if (!isAdmin) return;
  const langs = ['pt', 'es', 'fr', 'zh'];
  const batch = db.batch();

  try {
    for (const lang of langs) {
      const transId = `${termKey}_${lang}`;
      const escapedKey = termKey.replace(/'/g, "&apos;");
      const textVal = document.getElementById(`console-trans-${escapedKey}-${lang}`).value.trim();
      const defChecked = document.getElementById(`console-def-${escapedKey}-${lang}`).checked;
      const transRef = db.collection("translations").doc(transId);

      if (textVal) {
        batch.set(transRef, {
          termKey: termKey,
          lang: lang,
          type: type,
          approvedText: textVal,
          definitive: defChecked,
          moderatedBy: currentUser.uid,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (!onlineTranslationsMetadata[termKey]) onlineTranslationsMetadata[termKey] = {};
        onlineTranslationsMetadata[termKey][lang] = { approvedText: textVal, definitive: defChecked };
      } else {
        batch.delete(transRef);
        if (onlineTranslationsMetadata[termKey]) {
          delete onlineTranslationsMetadata[termKey][lang];
        }
      }
    }

    await batch.commit();
    alert("Translations updated successfully!");
    await fetchOnlineTranslations();
  } catch (err) {
    alert("Error saving translation: " + err.message);
  }
}
