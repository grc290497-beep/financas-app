// Per-device display choices saved in localStorage, and the inline <head>
// script (app/layout.tsx) that applies them before the first paint, so
// nothing flashes: hidden amounts ("Esconder valores") and the collapsed sidebar.

export const PRIVACY_KEY = "hide-values";
export const SIDEBAR_KEY = "sidebar-collapsed";

export const PREFS_SCRIPT = `try{var d=document.documentElement;if(localStorage.getItem("${PRIVACY_KEY}")==="1")d.setAttribute("data-privacy","");if(localStorage.getItem("${SIDEBAR_KEY}")==="1")d.setAttribute("data-sidebar-collapsed","")}catch(e){}`;
