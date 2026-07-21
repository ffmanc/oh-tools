# OH Tools — Once Human Companion Hub

**OH Tools** is a central hub designed for Once Human players to plan, optimize, and organize their game progress. It started as a fork of the amazing Once Human SCP Fusion Planner by **OTTOREIKU**, and is evolving into a complete toolbox for the community.

🌐 **Live Tool:** [ffmanc.github.io/oh-tools/](https://ffmanc.github.io/oh-tools/)

---

## 🛠️ Current & Upcoming Modules

- **Deviant Fusion Simulator (Active):** Plan deviations, transfer traits, and safely combine skills.
- **Build Planner (Under Construction):** Optimize your weapons, armor, mods, and calibrations.
- **Resources Map (Under Construction):** Interactive map showing materials, chests, and deviation spawns.
- **Calibrations & Mods Database (Under Construction):** Quick reference database for gearing up.

---

## ✨ New Features (Version 1.04+)

We have significantly upgraded the Deviant Fusion Simulator and transformed the tool's core infrastructure:

### 1. Full Multi-Language Support (i18n)
- Native translation for 5 languages: **English**, **Português (BR)**, **Español**, **Français**, and **简体中文 (CN)**.
- Features a clean, custom language switcher in the sidebar header.
- Dynamic localized search: You can search and add passive traits using their names in your active language (e.g. searching "Vantagem" to select *Vantagem Suprema* in Portuguese).

### 2. Collaborative Translations (Cloud-Backed)
- Community members can log in using their credentials (simple email/password signup) and suggest translations for deviations, techniques, and traits in real-time.
- Simply click the Globe icon (`🌐`) next to any term in the planner or libraries to submit a proposed translation.

### 3. Cloud Plan Saves
- Registered users can now save their single plans or full squads to the cloud.
- Manage, load, and delete your plans from any device directly inside your user profile.

### 4. Admin Moderation & Translation Console
- Features a secure dashboard for repository maintainers to moderate proposed translations in bulk.
- **Translation Console**: A complete database editor allowing the admin to translate terms directly and mark them as **"Definitive"** (which automatically locks and hides the suggestion globe icon `🌐` for that term across the site).

### 5. Layout Redesign
- Sleek, modern two-column dashboard layout with a sidebar hub.
- Clutter-free planning screen: The reference databases (Arena Shops, Techniques, and Traits) are now organized in a compact, tabbed panel at the bottom.

---

## 🤝 Credits & Acknowledgements

- The **Deviant Fusion Simulator** module is based on the logic, database, and structure of the **Once Human SCP Fusion Planner** originally developed by [OTTOREIKU](https://github.com/OTTOREIKU). We would like to express our gratitude for their incredible work which served as the stepping stone for this project.
- Special thanks to [BOLTTEXTURAS](https://traits.bolttexturas.online/) for providing the comprehensive Portuguese dataset and translation reference for the passive traits database.

---

## 🔒 Firebase Integration Setup
If you are hosting your own instance, you can integrate Firebase Services for user accounts and real-time translation sync:
1. Create a Firebase project and enable **Authentication (Email/Password)** and **Cloud Firestore**.
2. Replace credentials in `Scripts/firebase-config.js`.
3. Set up the Firestore Security Rules as detailed in our repository's documentation.
