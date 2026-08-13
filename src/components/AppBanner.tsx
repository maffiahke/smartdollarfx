"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export function AppBanner() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem("app_banner_dismissed");
      if (dismissed === "1") setVisible(false);
    } catch {
      // ignore
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem("app_banner_dismissed", "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  // Edit the href below to point to your APK file location
  const apkHref = "/download/smartdollarfx.apk";
  const siteName = "SmartDollarFX";

  return (
    <div className="w-full bg-gradient-to-r from-[#5b8def] to-[#6a4efb] text-white">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 px-3 sm:px-5 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 shrink-0 bg-white/10 rounded-full flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 3v14" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 7l4-4 4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] sm:text-xs font-semibold truncate">Get the {siteName} App</div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href={apkHref} className="px-3 py-1.5 bg-white text-[#0b1020] rounded-full text-[11px] sm:text-xs font-semibold hover:opacity-95" legacyBehavior>
            <a download>Download</a>
          </Link>
          <button onClick={dismiss} className="p-1.5 rounded-md text-white/90 hover:bg-white/10">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default AppBanner;
