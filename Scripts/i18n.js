let currentLang = localStorage.getItem('appLang') || 'en';
let localeData = {};
let defaultEnglishData = {};

async function loadLocale(lang) {
  try {
    const res = await fetch(`Locales/${lang}.json`);
    if (res.ok) {
      localeData = await res.json();
      currentLang = lang;
      localStorage.setItem('appLang', lang);
    }
  } catch (err) {
    console.error(`Error loading locale for ${lang}:`, err);
  }

  // Always ensure English fallback data is loaded.
  // When lang === 'en', use localeData itself as the fallback (already correct).
  // When lang !== 'en', load English separately if not already cached.
  if (lang === 'en') {
    defaultEnglishData = localeData;
  } else if (Object.keys(defaultEnglishData).length === 0) {
    try {
      const res = await fetch('Locales/en.json');
      if (res.ok) {
        defaultEnglishData = await res.json();
      }
    } catch (err) {
      console.error('Error loading English fallback locale:', err);
    }
  }
}

// Translate dotted path keys in UI dictionary
function t(path) {
  let cleanPath = path;
  if (path.startsWith("ui.")) {
    cleanPath = path.substring(3);
  }
  const parts = cleanPath.split('.');
  let currentObj = localeData.ui;
  let fallbackObj = defaultEnglishData.ui;

  for (const part of parts) {
    if (currentObj && currentObj[part] !== undefined) {
      currentObj = currentObj[part];
    } else {
      currentObj = null;
    }
    if (fallbackObj && fallbackObj[part] !== undefined) {
      fallbackObj = fallbackObj[part];
    } else {
      fallbackObj = null;
    }
  }

  return currentObj || fallbackObj || path;
}

// Translations for Database items
function translateDeviationName(name) {
  return (localeData.deviations && localeData.deviations[name]) || name;
}

function translateTrait(name) {
  const trans = localeData.traits && localeData.traits[name];
  const fallback = defaultEnglishData.traits && defaultEnglishData.traits[name];
  return {
    name: (trans && trans.name) || (fallback && fallback.name) || name,
    description: (trans && trans.description) || (fallback && fallback.description) || ""
  };
}

function translateTechnique(name) {
  const trans = localeData.techniques && localeData.techniques[name];
  const fallback = defaultEnglishData.techniques && defaultEnglishData.techniques[name];
  return {
    name: (trans && trans.name) || (fallback && fallback.name) || name,
    description: (trans && trans.description) || (fallback && fallback.description) || ""
  };
}

// Translate game-specific UI terms (filters, badges, labels)
function translateGameTerm(key) {
  const val = localeData.ui && localeData.ui.gameTerms && localeData.ui.gameTerms[key];
  const fallback = defaultEnglishData.ui && defaultEnglishData.ui.gameTerms && defaultEnglishData.ui.gameTerms[key];
  return val || fallback || key;
}

// ─── Multilingual Search Index ──────────────────────────────────────────────
// Builds a pipe-separated string of all known names for a given item in all
// languages. Used as data-search-index attribute on table rows so that
// filterTraits() / filterDeviantsLib() can search across any language.
// Works for regular users (localeData + defaultEnglishData + Firestore cache)
// and also for admins (allLocalesCached if available).
function buildSearchIndex(key, type) {
  const names = new Set();
  names.add(key.toUpperCase()); // always include EN original

  // Helper: resolve a single locale dataset
  function addFromData(data) {
    if (!data) return;
    let val;
    if (type === 'trait' || type === 'trait_name') {
      val = data.traits && data.traits[key] && data.traits[key].name;
    } else if (type === 'technique' || type === 'technique_name') {
      val = data.techniques && data.techniques[key] && data.techniques[key].name;
    } else if (type === 'deviation') {
      val = data.deviations && data.deviations[key];
    }
    if (val && typeof val === 'string') names.add(val.toUpperCase());
  }

  addFromData(localeData);
  addFromData(defaultEnglishData);

  // Admin-only: allLocalesCached (all 5 locales) — gracefully skipped for regular users
  if (typeof allLocalesCached !== 'undefined') {
    Object.values(allLocalesCached).forEach(data => addFromData(data));
  }

  // Firestore online translations — all languages
  if (typeof onlineTranslationsMetadata !== 'undefined' && onlineTranslationsMetadata[key]) {
    Object.values(onlineTranslationsMetadata[key]).forEach(langData => {
      if (langData && langData.approvedText) names.add(langData.approvedText.toUpperCase());
    });
  }

  return [...names].join('|');
}

// ─── Suggest Button with Deduplication ─────────────────────────────────────
// shownSuggestKeys tracks which (type:key) pairs have already been rendered
// with a 🌐 button in the current render pass. This prevents the same button
// from appearing on every row that shares a term (e.g. "Species Code" x30).
// The Set is cleared at the start of each build/render function.
let shownSuggestKeys = new Set();

function clearSuggestKeys() {
  shownSuggestKeys.clear();
}

function getSuggestBtnHtml(key, type) {
  // Deduplication: only show one 🌐 per unique (type:key) per render pass
  const dedupKey = `${type}:${key}`;
  if (shownSuggestKeys.has(dedupKey)) return '';
  shownSuggestKeys.add(dedupKey);

  // Definitive check: if the current-language translation is marked definitive,
  // no suggestion button is shown to anyone
  if (typeof onlineTranslationsMetadata !== 'undefined') {
    const isDef = onlineTranslationsMetadata[key] &&
                  onlineTranslationsMetadata[key][currentLang] &&
                  onlineTranslationsMetadata[key][currentLang].definitive;
    if (isDef) return '';
  }

  // Admin users translate directly (bypass proposal/approval flow)
  if (typeof isAdmin !== 'undefined' && isAdmin) {
    return `<span class="suggest-btn" style="cursor:pointer; opacity:0.8; font-size:0.9rem; color:var(--accent);" title="Translate directly (admin)" onclick="openDirectAdminTranslation('${key.replace(/'/g, "\\'")}', '${type}')">✏️</span>`;
  }

  // Regular users open the suggestion modal
  return `<span class="suggest-btn" style="cursor:pointer; opacity:0.6; font-size:0.9rem;" title="Suggest translation" onclick="openSuggestTranslation('${key.replace(/'/g, "\\'")}', '${type}')">🌐</span>`;
}

// Scans DOM and translates elements with data-i18n attributes
function applyi18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', t(key));
  });

  // Update HTML lang attribute
  document.documentElement.lang = currentLang;

  // Sync custom language selector label
  const labelEl = document.getElementById('currentLangLabel');
  if (labelEl) {
    const labels = { en: 'EN', pt: 'BR', es: 'ES', fr: 'FR', zh: 'CN' };
    labelEl.textContent = labels[currentLang] || currentLang.toUpperCase();
  }
}

async function changeLanguage(lang) {
  await loadLocale(lang);
  applyi18n();

  if (typeof buildTraitsTable === 'function') buildTraitsTable();
  if (typeof buildArenaShops === 'function') buildArenaShops();
  if (typeof buildTechniquesTable === 'function') buildTechniquesTable();
  if (typeof buildDeviantsLibTable === 'function') buildDeviantsLibTable();
  if (typeof populateUI === 'function') populateUI();
  if (typeof renderDeviants === 'function') renderDeviants();
  if (typeof updateComparison === 'function') updateComparison();
  if (typeof generatePlan === 'function') generatePlan();
  if (typeof renderSelectedTraits === 'function') renderSelectedTraits();
  if (typeof auditData === 'function') auditData();
  if (typeof renderUITermsTable === 'function') renderUITermsTable();
}
