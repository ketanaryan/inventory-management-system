"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    const manualTrigger = async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        setDeferredPrompt(null);
        setShowPrompt(false);
      } else {
        alert("Installation is not supported on this browser, or the app is already installed.");
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("trigger-install", manualTrigger);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("trigger-install", manualTrigger);
    };
  }, [deferredPrompt]);

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] bg-card border border-primary/50 shadow-2xl shadow-primary/20 p-4 rounded-2xl flex items-center gap-4 animate-slide-up max-w-sm">
      <div className="w-10 h-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center shrink-0">
        <Download size={20} />
      </div>
      <div>
        <h4 className="font-bold text-foreground text-sm">Install App</h4>
        <p className="text-xs text-muted-foreground mt-0.5">Add PharmaVerify to your home screen for offline access.</p>
      </div>
      <div className="flex flex-col gap-2 shrink-0 ml-2">
        <button 
           onClick={() => window.dispatchEvent(new Event("trigger-install"))}
           className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
        >
          Install
        </button>
        <button 
           onClick={() => setShowPrompt(false)}
           className="text-muted-foreground hover:text-foreground p-1 text-center w-full flex justify-center"
        >
           <X size={14} />
        </button>
      </div>
    </div>
  );
}
