"use client";

import { useEffect, useRef, memo } from "react";

let tvLoaded = false;

function TradingViewWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartId = useRef(`tradingview_chart_${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function initChart() {
      if (typeof window.TradingView !== "undefined") {
        new window.TradingView.widget({
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
          container_id: chartId.current,
          backgroundColor: "#0B0E11",
          gridColor: "rgba(42, 46, 57, 0.06)",
          hide_top_toolbar: true,
        });
      } else {
        console.error("TradingView not loaded");
        setTimeout(initChart, 1000);
      }
    }

    if (!tvLoaded) {
      tvLoaded = true;
      const s = document.createElement("script");
      s.src = "https://s3.tradingview.com/tv.js";
      s.async = true;
      s.onload = initChart;
      document.body.appendChild(s);
    } else {
      initChart();
    }

    return () => {
      if (el) el.innerHTML = "";
    };
  }, []);

  return <div ref={containerRef} id={chartId.current} style={{ height: "100%", width: "100%" }} />;
}

export default memo(TradingViewWidget);
