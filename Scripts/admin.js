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

// Authentications Flows
async function handleRegister(username, email, password, contact) {
  if (!username || !email || !password) {
    alert("Please fill all required fields (*)!");
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

    alert(t("messages.registerSuccess"));
    closeAuthModal();
  } catch (err) {
    alert("Register Error: " + err.message);
  }
}

async function handleLogin(email, password) {
  if (!email || !password) {
    alert("Please fill in both email and password!");
    return;
  }
  try {
    await auth.signInWithEmailAndPassword(email, password);
    alert(t("messages.loginSuccess"));
    closeAuthModal();
  } catch (err) {
    alert("Login Error: " + err.message);
  }
}

async function handlePasswordRecovery(email) {
  if (!email) {
    alert("Please enter your email!");
    return;
  }
  try {
    await auth.sendPasswordResetEmail(email);
    alert(t("messages.recoverSuccess"));
    showAuthView('login');
  } catch (err) {
    alert("Password Recovery Error: " + err.message);
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
          <th width="20%">Key (EN)</th>
          <th width="15%">Type</th>
          <th>Proposed Translation</th>
          <th width="20%">Submitted By</th>
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
    const snapshot = await db.collection("translations")
      .where("lang", "==", currentLang)
      .get();

    onlineTranslations = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      onlineTranslations[data.termKey] = data.approvedText;
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
  if (typeof populateUI === 'function') populateUI();
  if (typeof renderDeviants === 'function') renderDeviants();
}

// Auth modal controller
function openAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.classList.remove("hidden");
  showAuthView('login');
}
function closeAuthModal() {
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
    container.innerHTML = `
      <div style="margin-bottom:15px;">
        <label style="color:#aaa; font-size:0.8rem;">Logged as:</label>
        <div style="color:white; font-size:1.1rem; font-weight:bold;">${currentUser.displayName || 'User'}</div>
        <div style="color:#888; font-size:0.9rem;">${currentUser.email}</div>
      </div>
      <div id="profileSavedPlans">Loading cloud plans...</div>
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
      plansContainer.innerHTML = "<div style='opacity:0.5; font-size:0.9rem; margin-top:15px;'>No cloud saved plans yet.</div>";
      return;
    }

    plansContainer.innerHTML = `
      <h4 style="margin:15px 0 10px 0; color:var(--accent);">Cloud Plans</h4>
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
