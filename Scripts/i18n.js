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

  // Always load English as fallback reference
  if (lang !== 'en' && Object.keys(defaultEnglishData).length === 0) {
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

  // Sync language select input
  const langSelect = document.getElementById('langSelect');
  if (langSelect) {
    langSelect.value = currentLang;
  }
}

async function changeLanguage(lang) {
  await loadLocale(lang);
  applyi18n();

  // If script.js functions exist, trigger re-renders of the database-driven tables in the new language
  if (typeof buildTraitsTable === 'function') buildTraitsTable();
  if (typeof buildArenaShops === 'function') buildArenaShops();
  if (typeof buildTechniquesTable === 'function') buildTechniquesTable();
  if (typeof populateUI === 'function') populateUI();
  if (typeof renderDeviants === 'function') renderDeviants();
  if (typeof updateComparison === 'function') updateComparison();
  if (typeof generatePlan === 'function') generatePlan();
  if (typeof renderSelectedTraits === 'function') renderSelectedTraits();
  if (typeof auditData === 'function') auditData();
}
