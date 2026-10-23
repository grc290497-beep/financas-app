// "Esconder valores": the saved choice and the inline <head> script that
// applies it before the first paint (app/layout.tsx), so amounts never flash.

export const PRIVACY_KEY = "hide-values";

export const PRIVACY_SCRIPT = `try{if(localStorage.getItem("${PRIVACY_KEY}")==="1")document.documentElement.setAttribute("data-privacy","")}catch(e){}`;
