import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("/sw.js");
      // The first visit fetched the app before the service worker controlled this page.
      // Reload once under service-worker control so the app's JS/CSS bundles are cached too.
      if (!navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          const reloadKey = "mishads-ludo-sw-first-control-reload";
          if (sessionStorage.getItem(reloadKey)) return;
          sessionStorage.setItem(reloadKey, "1");
          window.location.reload();
        }, { once: true });
      }
    } catch (error) {
      console.warn("Mishad's Ludo offline support could not be registered:", error);
    }
  });
}
