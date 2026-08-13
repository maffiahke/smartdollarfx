"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

type TradingViewWidgetApi = {
  widget: new (options: Record<string, unknown>) => unknown;
};

function getTradingViewWindow(): (Window & { TradingView?: TradingViewWidgetApi }) | undefined {
  if (typeof window === "undefined") return undefined;
  return window as Window & { TradingView?: TradingViewWidgetApi };
}

let tvReady: Promise<void> | null = null;

function waitForTradingView(): Promise<void> {
  if (!tvReady) {
    tvReady = new Promise<void>((resolve) => {
      const check = () => {
        const win = getTradingViewWindow();
        if (win?.TradingView) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }
  return tvReady;
}

export default function TradingViewWidget() {
  const id = useRef(`tv_${Math.random().toString(36).slice(2, 8)}`);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    waitForTradingView().then(() => {
      if (!mounted.current) return;
      const container = document.getElementById(id.current);
      if (!container) return;
      container.innerHTML = "";

      const win = getTradingViewWindow();
      const TradingView = win?.TradingView;
      if (!TradingView) return;

      new TradingView.widget({
        autosize: true,
        symbol: "FX:EURUSD",
        interval: "1",
        timezone: "Africa/Nairobi",
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#0B0E11",
        enable_publishing: false,
        hide_side_toolbar: true,
        container_id: id.current,
        backgroundColor: "#0B0E11",
        gridColor: "rgba(42, 46, 57, 0.06)",
        hide_top_toolbar: true,
      });
    });

    return () => {
      mounted.current = false;
    };
  }, []);

  return (
    <>
      <Script
        src="https://s3.tradingview.com/tv.js"
        strategy="afterInteractive"
      />
      <div id={id.current} style={{ height: "100%", width: "100%" }} />
    </>
  );
}
