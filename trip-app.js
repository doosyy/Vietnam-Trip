const { useState, useEffect, useRef, useMemo, useCallback } = React;
const D = window.TRIP_DATA;
function useCountdown(target) {
  const t = new Date(target).getTime();
  const [diff, setDiff] = useState(() => Math.max(0, t - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setDiff(Math.max(0, t - Date.now())), 1e3);
    return () => clearInterval(id);
  }, [t]);
  const days = Math.floor(diff / 864e5);
  const hours = Math.floor(diff % 864e5 / 36e5);
  const mins = Math.floor(diff % 36e5 / 6e4);
  const secs = Math.floor(diff % 6e4 / 1e3);
  return { days, hours, mins, secs };
}
function useTripPhase() {
  const dep = new Date(D.meta.departDate).getTime();
  const ret = new Date(D.meta.returnDate).getTime();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1e3);
    return () => clearInterval(id);
  }, []);
  if (now < dep) return { phase: "before" };
  if (now > ret) return { phase: "after" };
  const day = Math.min(D.meta.nights, Math.max(1, Math.floor((now - dep) / 864e5) + 1));
  return { phase: "during", day };
}
function useClock(tz, fmt = { hour: "2-digit", minute: "2-digit", hour12: false }) {
  const [now, setNow] = useState(/* @__PURE__ */ new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(/* @__PURE__ */ new Date()), 1e3);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString("en-GB", { ...fmt, timeZone: tz });
}
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal:not(.in), .reveal-img:not(.in)");
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  });
}
function useParallax(ref, factor = 0.35) {
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
        const y = -r.top * factor;
        el.style.transform = `translate3d(0, ${y}px, 0)`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ref, factor]);
}
const WX_LOCS = {
  hcmc: [10.7769, 106.7009],
  hanoi: [21.0278, 105.8342],
  halong: [20.9101, 107.1839],
  ninhbinh: [20.2506, 105.9745]
};
function dayLocId(city) {
  const c = (city || "").toLowerCase();
  if (c.includes("long")) return "halong";
  if (c.includes("ninh binh")) return "ninhbinh";
  if (c.includes("chi minh") || c.includes("hcmc") || c.includes("mekong") || c.includes("cu chi")) return "hcmc";
  return "hanoi";
}
function dayIso(d) {
  return `2026-06-${String(parseInt(d.date, 10)).padStart(2, "0")}`;
}
function dayWeather(forecast, d) {
  if (!forecast) return { state: "loading" };
  const iso = dayIso(d);
  const e = forecast[dayLocId(d.city)] && forecast[dayLocId(d.city)][iso];
  if (e) {
    const w = window.wmoWeather(e.code);
    const todayIso2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const past = iso < todayIso2;
    return { state: past ? "actual" : "ok", hi: e.hi, lo: e.lo, icon: w.icon, cond: w.cond };
  }
  const todayIso = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return { state: iso < todayIso ? "past" : "soon" };
}
function shortCity(c) {
  return (c || "").split("\u2192")[0].trim().replace("Ho Chi Minh City", "HCMC");
}
function useTripForecast() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out = {};
      await Promise.all(Object.entries(WX_LOCS).map(async ([id, [la, lo]]) => {
        try {
          const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=16&past_days=14`);
          const j = await r.json();
          const m = {};
          const t = j && j.daily && j.daily.time || [];
          t.forEach((iso, i) => {
            m[iso] = {
              hi: Math.round(j.daily.temperature_2m_max[i]),
              lo: Math.round(j.daily.temperature_2m_min[i]),
              code: j.daily.weather_code[i]
            };
          });
          out[id] = m;
        } catch (e) {
          out[id] = {};
        }
      }));
      if (!cancelled) setData(out);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return data;
}
function Hero({ onScrollDown }) {
  const bgRef = useRef(null);
  useParallax(bgRef, 0.32);
  const cd = useCountdown(D.meta.departDate);
  const trip = useTripPhase();
  const melClock = useClock("Australia/Melbourne");
  const sgnClock = useClock("Asia/Ho_Chi_Minh");
  return /* @__PURE__ */ React.createElement("section", { className: "hero" }, /* @__PURE__ */ React.createElement("div", { ref: bgRef, className: "hero-bg" }, /* @__PURE__ */ React.createElement("img", { src: "https://doosyy.github.io/Vietnam-Trip/img/halong-bay.jpg", alt: "Ha Long Bay" })), /* @__PURE__ */ React.createElement("div", { className: "hero-noise" }), /* @__PURE__ */ React.createElement("div", { className: "hero-content boot ready" }, /* @__PURE__ */ React.createElement("div", { className: "hero-top" }, /* @__PURE__ */ React.createElement("div", { className: "hero-mark" }, /* @__PURE__ */ React.createElement("span", { className: "dot" }), /* @__PURE__ */ React.createElement("span", { className: "label", style: { letterSpacing: "0.22em" } }, "THE DOOS \xB7 VN '26")), /* @__PURE__ */ React.createElement("div", { className: "hero-clocks" }, /* @__PURE__ */ React.createElement("div", { className: "hero-clock" }, /* @__PURE__ */ React.createElement("b", null, melClock), /* @__PURE__ */ React.createElement("span", null, "MEL")), /* @__PURE__ */ React.createElement("div", { className: "hero-clock" }, /* @__PURE__ */ React.createElement("b", null, sgnClock), /* @__PURE__ */ React.createElement("span", null, "SGN")))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 28 } }, /* @__PURE__ */ React.createElement("div", { className: "label", style: { color: "rgba(255,255,255,0.78)" } }, "Family Expedition \xB7 13 Nights \xB7 2 Cities"), /* @__PURE__ */ React.createElement("h1", { className: "display hero-title", style: { color: "#fff" } }, "VI\u1EC6T", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("em", null, "NAM")), /* @__PURE__ */ React.createElement("div", { className: "hero-meta" }, /* @__PURE__ */ React.createElement("div", { className: "hero-tag-group" }, /* @__PURE__ */ React.createElement("p", { className: "hero-tag" }, "Two weeks. South to north. From Saigon's streets and the Mekong's canals to Ha Long Bay's limestone towers."), /* @__PURE__ */ React.createElement("div", { className: "hero-names" }, "Christine\xA0\xB7 Ashraf\xA0\xB7 Jason\xA0&\xA0Chris")), trip.phase === "before" && /* @__PURE__ */ React.createElement("div", { className: "countdown", "aria-label": "Time until departure" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("b", null, String(cd.days).padStart(2, "0")), /* @__PURE__ */ React.createElement("span", null, "Days")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("b", null, String(cd.hours).padStart(2, "0")), /* @__PURE__ */ React.createElement("span", null, "Hours")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("b", null, String(cd.mins).padStart(2, "0")), /* @__PURE__ */ React.createElement("span", null, "Mins")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("b", null, String(cd.secs).padStart(2, "0")), /* @__PURE__ */ React.createElement("span", null, "Secs"))), trip.phase === "during" && /* @__PURE__ */ React.createElement("div", { className: "trip-status", "aria-label": "Trip in progress" }, /* @__PURE__ */ React.createElement("div", { className: "trip-status-num" }, /* @__PURE__ */ React.createElement("b", null, String(trip.day).padStart(2, "0")), /* @__PURE__ */ React.createElement("span", null, "of ", D.meta.nights)), /* @__PURE__ */ React.createElement("div", { className: "trip-status-text" }, /* @__PURE__ */ React.createElement("b", null, "We're in Vietnam"), /* @__PURE__ */ React.createElement("span", null, "Day ", trip.day, " of the trip. Live weather and local time below."))), trip.phase === "after" && /* @__PURE__ */ React.createElement("div", { className: "trip-status", "aria-label": "Trip complete" }, /* @__PURE__ */ React.createElement("div", { className: "trip-status-num done" }, /* @__PURE__ */ React.createElement("b", null, "\u2713"), /* @__PURE__ */ React.createElement("span", null, "done")), /* @__PURE__ */ React.createElement("div", { className: "trip-status-text" }, /* @__PURE__ */ React.createElement("b", null, "Until next time"), /* @__PURE__ */ React.createElement("span", null, "That's a wrap on Vietnam '26. Thanks for following along."))))), /* @__PURE__ */ React.createElement("button", { className: "scroll-hint", onClick: onScrollDown, style: { color: "rgba(255,255,255,0.85)" } }, /* @__PURE__ */ React.createElement("span", null, "Scroll"))));
}
function Dashboard({ onOpenWeather }) {
  const cities = Object.keys(D.weather);
  const [city, setCity] = useState(cities[0]);
  const [liveWeather, setLiveWeather] = useState(D.weather);
  const w = liveWeather[city] || D.weather[city];
  const [rate, setRate] = useState(16450);
  const [aud, setAud] = useState("100");
  const [vndStr, setVndStr] = useState(String(Math.round(100 * 16450)));
  const [flipped, setFlipped] = useState(false);
  const cityCoords = {
    "Ho Chi Minh City": [10.7769, 106.7009],
    "Hanoi": [21.0278, 105.8342],
    "Ha Long Bay": [20.9101, 107.1839],
    "Ninh Binh": [20.2506, 105.9745]
  };
  useEffect(() => {
    let cancelled = false;
    const wmo = window.wmoWeather;
    cities.forEach(async (c) => {
      const co = cityCoords[c];
      if (!co) return;
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${co[0]}&longitude=${co[1]}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`);
        const j = await r.json();
        let aqi = null;
        try {
          const ar = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${co[0]}&longitude=${co[1]}&current=us_aqi`);
          const aj = await ar.json();
          aqi = aj && aj.current ? aj.current.us_aqi : null;
        } catch (e) {
        }
        if (cancelled || !j || !j.current) return;
        const m = wmo(j.current.weather_code);
        setLiveWeather((prev) => ({
          ...prev,
          [c]: {
            temp: Math.round(j.current.temperature_2m),
            hi: Math.round(j.daily.temperature_2m_max[0]),
            lo: Math.round(j.daily.temperature_2m_min[0]),
            cond: m.cond,
            icon: m.icon,
            aqi: aqi != null ? Math.round(aqi) : D.weather[c] ? D.weather[c].aqi : "\u2014"
          }
        }));
      } catch (e) {
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("https://open.er-api.com/v6/latest/AUD");
        const j = await r.json();
        const vnd = j && j.rates ? j.rates.VND : null;
        if (cancelled || !vnd) return;
        const nr = Math.round(vnd);
        setRate(nr);
        setAud((a) => {
          const v = parseFloat(a);
          setVndStr(isNaN(v) ? "" : String(Math.round(v * nr)));
          return a;
        });
      } catch (e) {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const sanitizeDec = (s) => {
    let c = String(s).replace(/[^\d.]/g, "");
    const parts = c.split(".");
    if (parts.length > 2) c = parts[0] + "." + parts.slice(1).join("");
    return c;
  };
  const sanitizeInt = (s) => {
    const d = String(s).replace(/\D/g, "");
    if (d === "") return "";
    const noLead = d.replace(/^0+/, "");
    return noLead === "" ? "0" : noLead;
  };
  const onAudChange = (e) => {
    const s = sanitizeDec(e.target.value);
    setAud(s);
    if (s === "" || s === ".") {
      setVndStr("");
      return;
    }
    const v = parseFloat(s);
    setVndStr(isNaN(v) ? "" : String(Math.round(v * rate)));
  };
  const onVndChange = (e) => {
    const s = sanitizeInt(e.target.value);
    setVndStr(s);
    if (s === "") {
      setAud("");
      return;
    }
    const v = parseFloat(s);
    setAud(isNaN(v) ? "" : (v / rate).toFixed(2));
  };
  const audSide = /* @__PURE__ */ React.createElement("label", { className: "fx-side" }, /* @__PURE__ */ React.createElement("span", { className: "fx-label" }, "Australian Dollars"), /* @__PURE__ */ React.createElement("span", { className: "fx-input" }, /* @__PURE__ */ React.createElement("input", { type: "text", inputMode: "decimal", pattern: "[0-9.]*", value: aud, onChange: onAudChange, "aria-label": "AUD amount" }), /* @__PURE__ */ React.createElement("span", { className: "fx-currency" }, "A$")));
  const vndSide = /* @__PURE__ */ React.createElement("label", { className: "fx-side", style: { alignItems: "flex-end", textAlign: "right" } }, /* @__PURE__ */ React.createElement("span", { className: "fx-label" }, "Vietnamese Dong"), /* @__PURE__ */ React.createElement("span", { className: "fx-input", style: { justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement("input", { type: "text", inputMode: "numeric", pattern: "[0-9]*", value: vndStr, onChange: onVndChange, "aria-label": "VND amount", style: { textAlign: "right" } }), /* @__PURE__ */ React.createElement("span", { className: "fx-currency" }, "\u20AB")));
  const quick = flipped ? [5e4, 25e4, 1e6, 5e6] : [10, 50, 100, 500];
  return /* @__PURE__ */ React.createElement("div", { className: "dashboard reveal" }, /* @__PURE__ */ React.createElement("div", { className: "dashboard-inner" }, /* @__PURE__ */ React.createElement("div", { className: "dash-weather" }, /* @__PURE__ */ React.createElement("div", { className: "dash-head" }, /* @__PURE__ */ React.createElement("span", { className: "label" }, "Weather Now"), /* @__PURE__ */ React.createElement("div", { className: "city-select", role: "tablist" }, cities.map((c) => /* @__PURE__ */ React.createElement("button", { key: c, className: city === c ? "on" : "", onClick: () => setCity(c) }, c.split(" ").map((w2) => w2[0]).join("").slice(0, 3))))), /* @__PURE__ */ React.createElement("button", { className: "weather-now", type: "button", onClick: onOpenWeather, "aria-label": "Open the 13-day trip forecast" }, /* @__PURE__ */ React.createElement("div", { className: "weather-icon" }, window.weatherIcon(w.icon, 30)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "weather-temp" }, w.temp, /* @__PURE__ */ React.createElement("sup", null, "\xB0C")), /* @__PURE__ */ React.createElement("div", { className: "weather-cond" }, city, " \xB7 ", w.cond), /* @__PURE__ */ React.createElement("div", { className: "weather-cta" }, "13-day trip forecast ", /* @__PURE__ */ React.createElement(Icon.Arrow, { s: 11 }))), /* @__PURE__ */ React.createElement("div", { className: "weather-side" }, /* @__PURE__ */ React.createElement("span", { className: "weather-pill" }, "H ", w.hi, "\xB0 \xB7 L ", w.lo, "\xB0"), /* @__PURE__ */ React.createElement("span", { className: "weather-pill" }, "AQI ", w.aqi)))), /* @__PURE__ */ React.createElement("div", { className: "dash-fx" }, /* @__PURE__ */ React.createElement("div", { className: "dash-head" }, /* @__PURE__ */ React.createElement("span", { className: "label" }, "AUD \u21C4 VND"), /* @__PURE__ */ React.createElement("span", { className: "label", style: { color: "var(--fg-muted)" } }, "1 A$ \u2248 ", rate.toLocaleString(), " \u20AB")), /* @__PURE__ */ React.createElement("div", { className: "fx-row" }, flipped ? vndSide : audSide, /* @__PURE__ */ React.createElement("div", { className: "fx-swap-wrap" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "fx-swap",
      onClick: () => setFlipped((f) => !f),
      "aria-label": "Swap sides",
      title: "Swap sides"
    },
    /* @__PURE__ */ React.createElement(Icon.Swap, { s: 16 })
  ), /* @__PURE__ */ React.createElement("span", { className: "fx-swap-hint" }, "Swap")), flipped ? audSide : vndSide), /* @__PURE__ */ React.createElement("div", { className: "fx-quick" }, quick.map((q) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: q,
      onClick: () => {
        if (flipped) {
          setVndStr(String(q));
          setAud((q / rate).toFixed(2));
        } else {
          setAud(String(q));
          setVndStr(String(Math.round(q * rate)));
        }
      }
    },
    flipped ? `${(q / 1e3).toFixed(0)}k\u20AB` : `A$${q}`
  ))))));
}
function DayBar({ active, onJump, onJumpSection }) {
  const ref = useRef(null);
  const [lifted, setLifted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    const chip = bar.querySelector(`[data-chip="${active}"]`);
    if (chip) {
      const left = chip.offsetLeft - bar.clientWidth / 2 + chip.offsetWidth / 2;
      bar.scrollTo({ left, behavior: "smooth" });
    }
  }, [active]);
  useEffect(() => {
    const el = document.querySelector(".daybar");
    if (!el) return;
    const sentinel = document.createElement("div");
    sentinel.style.cssText = "position:absolute;top:0;height:1px;width:1px;";
    el.parentElement.insertBefore(sentinel, el);
    const io = new IntersectionObserver(
      ([e]) => setLifted(!e.isIntersecting && e.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    io.observe(sentinel);
    return () => {
      io.disconnect();
      sentinel.remove();
    };
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [menuOpen]);
  const sections = [
    { id: "maps", label: "Map", sub: "The route" },
    { id: "flights", label: "Flights", sub: "3 hops" },
    { id: "hotels", label: "Hotels", sub: "Where we sleep" },
    { id: "phrases", label: "Phrases", sub: "Speak local" }
  ];
  return /* @__PURE__ */ React.createElement("nav", { className: `daybar ${lifted ? "lifted" : ""}`, "aria-label": "Day navigation" }, /* @__PURE__ */ React.createElement("div", { className: "daybar-inner" }, /* @__PURE__ */ React.createElement("div", { className: "daybar-scroll", ref }, D.days.map((d) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: d.n,
      "data-chip": d.n,
      className: `daybar-chip ${active === d.n ? "on" : ""} ${d.star ? "star" : ""}`,
      onClick: () => onJump(d.n)
    },
    /* @__PURE__ */ React.createElement("b", null, "D", String(d.n).padStart(2, "0")),
    /* @__PURE__ */ React.createElement("span", null, d.date)
  ))), /* @__PURE__ */ React.createElement("div", { className: "daybar-jump", ref: menuRef }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `daybar-jump-btn ${menuOpen ? "on" : ""}`,
      onClick: () => setMenuOpen((o) => !o),
      "aria-haspopup": "menu",
      "aria-expanded": menuOpen
    },
    /* @__PURE__ */ React.createElement("span", null, "Skip"),
    /* @__PURE__ */ React.createElement("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "square", style: { transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 220ms" } }, /* @__PURE__ */ React.createElement("path", { d: "M6 9l6 6 6-6" }))
  ), menuOpen && /* @__PURE__ */ React.createElement("div", { className: "daybar-menu", role: "menu" }, /* @__PURE__ */ React.createElement("div", { className: "daybar-menu-label" }, "Skip itinerary \u2192"), sections.map((s) => /* @__PURE__ */ React.createElement("button", { key: s.id, className: "daybar-menu-item", onClick: () => {
    setMenuOpen(false);
    onJumpSection(s.id);
  }, role: "menuitem" }, /* @__PURE__ */ React.createElement("b", null, s.label), /* @__PURE__ */ React.createElement("span", null, s.sub))), /* @__PURE__ */ React.createElement("button", { className: "daybar-menu-item daybar-menu-item--top", onClick: () => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, role: "menuitem" }, /* @__PURE__ */ React.createElement("b", null, "\u2191 Top"), /* @__PURE__ */ React.createElement("span", null, "Back to hero"))))));
}
function Flights() {
  return /* @__PURE__ */ React.createElement("section", { className: "section", id: "flights" }, /* @__PURE__ */ React.createElement("div", { className: "section-head reveal" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "label eyebrow" }, "03 \u2014 Getting There"), /* @__PURE__ */ React.createElement("h2", { className: "section-title" }, "Three flights, two cities.")), /* @__PURE__ */ React.createElement("p", { className: "section-blurb" }, "All sorted. Passports valid 6+ months past June 2026 \u2014 that's the only thing to check.")), /* @__PURE__ */ React.createElement("div", { className: "flight-grid" }, D.flights.map((f, i) => /* @__PURE__ */ React.createElement("article", { key: i, className: "flight-card reveal" }, /* @__PURE__ */ React.createElement("div", { className: "flight-kind" }, /* @__PURE__ */ React.createElement(Icon.Plane, { s: 11 }), " \xA0", f.kind), /* @__PURE__ */ React.createElement("div", { className: "flight-route" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "flight-code" }, f.from.code), /* @__PURE__ */ React.createElement("div", { className: "flight-city" }, f.from.city, " \xB7 ", f.from.terminal)), /* @__PURE__ */ React.createElement("div", { className: "flight-arrow" }, /* @__PURE__ */ React.createElement(Icon.Arrow, { s: 20 })), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "right" } }, /* @__PURE__ */ React.createElement("div", { className: "flight-code" }, f.to.code), /* @__PURE__ */ React.createElement("div", { className: "flight-city" }, f.to.city, " \xB7 ", f.to.terminal))), /* @__PURE__ */ React.createElement("div", { className: "flight-times" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "label" }, "Depart"), /* @__PURE__ */ React.createElement("b", null, f.depart)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "label" }, "Arrive"), /* @__PURE__ */ React.createElement("b", null, f.arrive)), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "right" } }, /* @__PURE__ */ React.createElement("span", { className: "label" }, "Flight"), /* @__PURE__ */ React.createElement("b", null, f.flightNo))), /* @__PURE__ */ React.createElement("div", { className: "flight-note" }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 11, letterSpacing: ".1em", color: "var(--fg-muted)" } }, f.date.toUpperCase(), " \xB7 ", f.duration, " \xB7 ", f.carrier, f.aircraft ? " \xB7 " + f.aircraft : ""), /* @__PURE__ */ React.createElement("p", { style: { margin: "8px 0 0" } }, f.note))))));
}
function Activity({ a, onLinkOpenMap }) {
  const [open, setOpen] = useState(false);
  const isClockTime = /^\d{1,2}:\d{2}$/.test(a.time);
  return /* @__PURE__ */ React.createElement("div", { className: `activity ${open ? "open" : ""}` }, /* @__PURE__ */ React.createElement("button", { className: "activity-toggle", onClick: () => setOpen((o) => !o), "aria-expanded": open }, /* @__PURE__ */ React.createElement("span", { className: `activity-time ${isClockTime ? "is-clock" : "is-fuzzy"}` }, a.time), /* @__PURE__ */ React.createElement("span", { style: { display: "flex", alignItems: "center", gap: 10 } }, /* @__PURE__ */ React.createElement("span", { className: `activity-mood mood-${a.mood}` }), /* @__PURE__ */ React.createElement("span", { className: "activity-title" }, a.title)), /* @__PURE__ */ React.createElement("span", { className: "activity-caret" }, /* @__PURE__ */ React.createElement(Icon.Plus, { s: 16 }))), /* @__PURE__ */ React.createElement("div", { className: "activity-body" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "activity-detail" }, a.detail, a.link && /* @__PURE__ */ React.createElement("div", { className: "activity-actions" }, /* @__PURE__ */ React.createElement("button", { className: "btn-ghost", onClick: () => onLinkOpenMap == null ? void 0 : onLinkOpenMap(a.link) }, /* @__PURE__ */ React.createElement(Icon.Map, { s: 11 }), " \xA0 View on Map"))))));
}
function Itinerary({ onOpenMap, onActiveDayChange, forecast, onOpenWeather }) {
  useEffect(() => {
    const blocks = document.querySelectorAll(".day-block");
    const moods = {};
    const visibility = {};
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const id = e.target.getAttribute("data-day");
          visibility[id] = e.intersectionRatio;
          moods[id] = e.target.getAttribute("data-mood");
        });
        let best = null, bestV = 0;
        Object.entries(visibility).forEach(([id, v]) => {
          if (v > bestV) {
            best = id;
            bestV = v;
          }
        });
        if (best) {
          onActiveDayChange == null ? void 0 : onActiveDayChange(parseInt(best, 10));
          const mood = moods[best];
          const isNight = mood === "evening" || mood === "night";
          document.documentElement.setAttribute("data-theme", isNight ? "night" : "day");
        }
      },
      { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1], rootMargin: "-80px 0px -40% 0px" }
    );
    blocks.forEach((b) => io.observe(b));
    return () => io.disconnect();
  }, []);
  return /* @__PURE__ */ React.createElement("section", { className: "section", id: "itinerary" }, /* @__PURE__ */ React.createElement("div", { className: "section-head reveal" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "label eyebrow" }, "01 \u2014 Day by Day"), /* @__PURE__ */ React.createElement("h2", { className: "section-title" }, "The plan, hour by hour.")), /* @__PURE__ */ React.createElement("p", { className: "section-blurb" }, "Tap any activity for details, notes, and timing. The site shifts to a darker tone as the day moves toward evening \u2014 easier on the eyes when you're reading after dinner.")), /* @__PURE__ */ React.createElement("div", null, D.days.map((d) => /* @__PURE__ */ React.createElement("article", { key: d.n, className: "day-block", id: `day-${d.n}`, "data-day": d.n, "data-mood": d.mood }, /* @__PURE__ */ React.createElement("div", { className: "day-anchor" }, /* @__PURE__ */ React.createElement("div", { className: "day-anchor-head" }, /* @__PURE__ */ React.createElement("div", { className: "day-num" }, String(d.n).padStart(2, "0")), /* @__PURE__ */ React.createElement("div", { className: "day-meta" }, /* @__PURE__ */ React.createElement("div", { className: "day-city" }, /* @__PURE__ */ React.createElement("span", { className: "day-city-name" }, d.city), /* @__PURE__ */ React.createElement("span", { className: "day-city-sep" }, "\xB7"), /* @__PURE__ */ React.createElement("span", { className: "day-city-date" }, d.weekday, " ", d.date)), /* @__PURE__ */ React.createElement("div", { className: "day-title" }, d.title), /* @__PURE__ */ React.createElement("div", { className: "day-tags" }, d.star && /* @__PURE__ */ React.createElement("span", { className: "day-tag unmissable" }, "\u2605 Unmissable"), d.tags.map((t) => /* @__PURE__ */ React.createElement("span", { key: t, className: "day-tag" }, t))), (() => {
    const wx = dayWeather(forecast, d);
    const hasTemp = wx.state === "ok" || wx.state === "actual";
    return /* @__PURE__ */ React.createElement("button", { className: `wx-chip ${hasTemp ? "" : "wx-chip--soon"}`, onClick: onOpenWeather, title: "See the full trip forecast" }, hasTemp ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "wx-ico" }, window.weatherIcon(wx.icon, 16)), /* @__PURE__ */ React.createElement("b", null, wx.hi, "\xB0"), /* @__PURE__ */ React.createElement("span", { className: "wx-lo" }, wx.lo, "\xB0"), /* @__PURE__ */ React.createElement("span", { className: "wx-cond" }, wx.cond)) : wx.state === "loading" ? /* @__PURE__ */ React.createElement("span", { className: "wx-soon" }, "Loading forecast\u2026") : wx.state === "past" ? /* @__PURE__ */ React.createElement("span", { className: "wx-soon" }, "Trip day complete") : /* @__PURE__ */ React.createElement("span", { className: "wx-soon" }, "Forecast nearer the date"));
  })())), /* @__PURE__ */ React.createElement("div", { className: "day-hero reveal-img" }, /* @__PURE__ */ React.createElement(
    "image-slot",
    {
      id: `day-${d.n}-hero`,
      src: d.hero,
      shape: "rect",
      placeholder: `Drop a photo for ${d.title}`,
      style: { width: "100%", height: "100%", display: "block" }
    }
  ), /* @__PURE__ */ React.createElement("span", { className: "label" }, d.city))), d.region && /* @__PURE__ */ React.createElement(RegionalMap, { region: d.region }), /* @__PURE__ */ React.createElement("div", { className: "activity-list" }, d.activities.map((a, i) => /* @__PURE__ */ React.createElement(Activity, { key: i, a, onLinkOpenMap: onOpenMap }))), d.tip && /* @__PURE__ */ React.createElement("div", { className: "day-tip" }, /* @__PURE__ */ React.createElement("b", null, "Heads up"), d.tip)))));
}
function RegionalMap({ region }) {
  if (!region) return null;
  const { base, dest, bearing, distance, duration, transport } = region;
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const tileRef = useRef(null);
  const lineRef = useRef(null);
  const tileUrl = (dark) => dark ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  const isNight = () => document.documentElement.getAttribute("data-theme") === "night";
  const accentColor = () => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#C8102E";
  useEffect(() => {
    if (!window.L || !elRef.current || mapRef.current) return;
    if (base.lat == null || dest.lat == null) return;
    const L = window.L;
    const a = [base.lat, base.lng];
    const b = [dest.lat, dest.lng];
    const map = L.map(elRef.current, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false
    });
    mapRef.current = map;
    tileRef.current = L.tileLayer(tileUrl(isNight()), {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap, &copy; CARTO"
    }).addTo(map);
    lineRef.current = L.polyline([a, b], {
      color: accentColor(),
      weight: 3,
      opacity: 0.85,
      dashArray: "2 8",
      lineCap: "round"
    }).addTo(map);
    const baseIcon = L.divIcon({ className: "seg-pin seg-base", html: "<span></span>", iconSize: [18, 18], iconAnchor: [9, 9] });
    const destIcon = L.divIcon({ className: "seg-pin seg-dest", html: "<span>\u2605</span>", iconSize: [24, 24], iconAnchor: [12, 12] });
    L.marker(a, { icon: baseIcon }).addTo(map).bindTooltip(`${base.name} \xB7 BASE`, { direction: "top", offset: [0, -10], className: "trip-tip" });
    L.marker(b, { icon: destIcon }).addTo(map).bindTooltip(`${dest.name} \xB7 ${distance}, ${duration}`, { direction: "top", offset: [0, -14], className: "trip-tip" });
    map.fitBounds([a, b], { padding: [46, 46] });
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(elRef.current);
    const mo = new MutationObserver(() => {
      tileRef.current && tileRef.current.setUrl(tileUrl(isNight()));
      lineRef.current && lineRef.current.setStyle({ color: accentColor() });
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      ro.disconnect();
      mo.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);
  return /* @__PURE__ */ React.createElement("div", { className: "region-map reveal" }, /* @__PURE__ */ React.createElement("div", { className: "region-map-head" }, /* @__PURE__ */ React.createElement("div", { className: "region-map-eyebrow" }, /* @__PURE__ */ React.createElement("span", { className: "label" }, "Travel Route")), /* @__PURE__ */ React.createElement("div", { className: "region-map-stats" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "label" }, "Bearing"), /* @__PURE__ */ React.createElement("b", null, bearing)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "label" }, "Distance"), /* @__PURE__ */ React.createElement("b", null, distance)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "label" }, "Duration"), /* @__PURE__ */ React.createElement("b", null, duration)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "label" }, "Transport"), /* @__PURE__ */ React.createElement("b", null, transport)))), /* @__PURE__ */ React.createElement("div", { className: "region-map-canvas" }, /* @__PURE__ */ React.createElement("div", { ref: elRef, className: "leaflet-stage", role: "img", "aria-label": `Route from ${base.name} to ${dest.name}` })));
}
function VietnamMap({ activeId, onPickPin, interactive = true }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const tileRef = useRef(null);
  const routeRef = useRef(null);
  const tileUrl = (dark) => dark ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  const isNight = () => document.documentElement.getAttribute("data-theme") === "night";
  const accentColor = () => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#C8102E";
  useEffect(() => {
    if (!window.L || !elRef.current || mapRef.current) return;
    const L = window.L;
    const pins = D.mapPins;
    const allLatLng = pins.map((p) => [p.lat, p.lng]);
    const map = L.map(elRef.current, {
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: false,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      tap: interactive
    });
    mapRef.current = map;
    tileRef.current = L.tileLayer(tileUrl(isNight()), {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap, &copy; CARTO"
    }).addTo(map);
    const order = D.routeOrder || pins.map((p) => p.id);
    const routePts = order.map((id) => pins.find((p) => p.id === id)).filter(Boolean).map((p) => [p.lat, p.lng]);
    routeRef.current = L.polyline(routePts, {
      color: accentColor(),
      weight: 3,
      opacity: 0.85,
      dashArray: "2 8",
      lineCap: "round"
    }).addTo(map);
    pins.forEach((p, i) => {
      const icon = L.divIcon({
        className: "trip-pin",
        html: `<span>${i + 1}</span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
      const m = L.marker([p.lat, p.lng], { icon }).addTo(map);
      m.bindTooltip(`${p.label} \xB7 ${p.sub}`, {
        direction: "top",
        offset: [0, -14],
        className: "trip-tip"
      });
      if (onPickPin) m.on("click", () => onPickPin(p.id));
      markersRef.current[p.id] = m;
    });
    map.fitBounds(allLatLng, { padding: [34, 34] });
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(elRef.current);
    const mo = new MutationObserver(() => {
      tileRef.current && tileRef.current.setUrl(tileUrl(isNight()));
      routeRef.current && routeRef.current.setStyle({ color: accentColor() });
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      ro.disconnect();
      mo.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.L) return;
    Object.entries(markersRef.current).forEach(([id, m]) => {
      const el = m.getElement && m.getElement();
      if (el) el.classList.toggle("active", id === activeId);
    });
    if (activeId) {
      const p = D.mapPins.find((x) => x.id === activeId);
      if (p) {
        map.flyTo([p.lat, p.lng], 9, { duration: 0.7 });
        markersRef.current[activeId] && markersRef.current[activeId].openTooltip();
      }
    } else {
      map.flyToBounds(D.mapPins.map((p) => [p.lat, p.lng]), { padding: [34, 34], duration: 0.7 });
    }
  }, [activeId]);
  return /* @__PURE__ */ React.createElement("div", { ref: elRef, className: "leaflet-stage", role: "img", "aria-label": "Map of the Vietnam trip route" });
}
function MapSection({ onOpenMap }) {
  return /* @__PURE__ */ React.createElement("section", { className: "section", id: "maps" }, /* @__PURE__ */ React.createElement("div", { className: "section-head reveal" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "label eyebrow" }, "02 \u2014 The Route"), /* @__PURE__ */ React.createElement("h2", { className: "section-title" }, "South to north,", /* @__PURE__ */ React.createElement("br", null), "by air, road & water.")), /* @__PURE__ */ React.createElement("p", { className: "section-blurb" }, "We fly into Saigon, spend four days in the south, then jump to Hanoi for the second leg. Two day-trips out from each base.")), /* @__PURE__ */ React.createElement("div", { className: "mapcard reveal" }, /* @__PURE__ */ React.createElement("div", { className: "map-mini", style: { color: "var(--fg)" } }, /* @__PURE__ */ React.createElement(VietnamMap, { interactive: false })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 14 } }, /* @__PURE__ */ React.createElement("p", { style: { margin: 0, color: "var(--fg-muted)", fontSize: 15 } }, "Six stops, two regional cuisines, one overnight cruise. Tap below to see the route in full \u2014 pinch and explore each stop."), /* @__PURE__ */ React.createElement("button", { className: "map-cta", onClick: onOpenMap }, /* @__PURE__ */ React.createElement("span", null, "Open Full Map"), /* @__PURE__ */ React.createElement(Icon.Arrow, { s: 18 })), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 } }, D.mapPins.slice(0, 6).map((p, i) => /* @__PURE__ */ React.createElement("div", { key: p.id, style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 } }, /* @__PURE__ */ React.createElement("span", { style: { width: 22, height: 22, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "JetBrains Mono, monospace", fontSize: 11, fontWeight: 700 } }, i + 1), /* @__PURE__ */ React.createElement("b", { style: { fontFamily: "Bricolage Grotesque, sans-serif", letterSpacing: "-0.01em" } }, p.label)))))));
}
function MapDrawer({ open, onClose, focusId }) {
  const drawerRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  const start = useRef(0);
  const dy = useRef(0);
  const dragging = useRef(false);
  const onTouchStart = (e) => {
    start.current = e.touches[0].clientY;
    dragging.current = true;
  };
  const onTouchMove = (e) => {
    if (!dragging.current) return;
    dy.current = Math.max(0, e.touches[0].clientY - start.current);
    if (drawerRef.current) drawerRef.current.style.transform = `translateY(${dy.current}px)`;
  };
  const onTouchEnd = () => {
    dragging.current = false;
    if (!drawerRef.current) return;
    if (dy.current > 100) {
      onClose();
    }
    drawerRef.current.style.transform = "";
    dy.current = 0;
  };
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: `drawer-scrim ${open ? "open" : ""}`, onClick: onClose }), /* @__PURE__ */ React.createElement("div", { ref: drawerRef, className: `drawer ${open ? "open" : ""}`, role: "dialog", "aria-label": "Trip Map" }, /* @__PURE__ */ React.createElement("div", { className: "drawer-handle", onTouchStart, onTouchMove, onTouchEnd }, /* @__PURE__ */ React.createElement("div", null)), /* @__PURE__ */ React.createElement("div", { className: "drawer-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "label", style: { color: "var(--fg-muted)" } }, "The Route"), /* @__PURE__ */ React.createElement("div", { className: "drawer-title" }, "South \u2192 North \xB7 6 stops")), /* @__PURE__ */ React.createElement("button", { className: "drawer-close", onClick: onClose, "aria-label": "Close" }, /* @__PURE__ */ React.createElement(Icon.Close, null))), /* @__PURE__ */ React.createElement("div", { className: "drawer-body" }, /* @__PURE__ */ React.createElement("div", { className: "map-full", style: { color: "var(--fg)" } }, /* @__PURE__ */ React.createElement(VietnamMap, { activeId: focusId })), /* @__PURE__ */ React.createElement("div", { className: "map-legend" }, D.mapPins.map((p, i) => /* @__PURE__ */ React.createElement("div", { key: p.id, className: "map-legend-item" }, /* @__PURE__ */ React.createElement("span", { className: "n" }, i + 1), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("b", null, p.label), /* @__PURE__ */ React.createElement("span", null, p.sub)), /* @__PURE__ */ React.createElement("em", null, p.id.toUpperCase())))))));
}
function WeatherDrawer({ open, onClose, forecast }) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: `drawer-scrim ${open ? "open" : ""}`, onClick: onClose }), /* @__PURE__ */ React.createElement("div", { className: `drawer ${open ? "open" : ""}`, role: "dialog", "aria-label": "Trip Forecast" }, /* @__PURE__ */ React.createElement("div", { className: "drawer-handle" }, /* @__PURE__ */ React.createElement("div", null)), /* @__PURE__ */ React.createElement("div", { className: "drawer-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "label", style: { color: "var(--fg-muted)" } }, "Weather"), /* @__PURE__ */ React.createElement("div", { className: "drawer-title" }, "Trip forecast \xB7 13 days")), /* @__PURE__ */ React.createElement("button", { className: "drawer-close", onClick: onClose, "aria-label": "Close" }, /* @__PURE__ */ React.createElement(Icon.Close, null))), /* @__PURE__ */ React.createElement("div", { className: "wx-body" }, /* @__PURE__ */ React.createElement("div", { className: "wx-strip" }, D.days.map((d) => {
    const wx = dayWeather(forecast, d);
    return /* @__PURE__ */ React.createElement("div", { key: d.n, className: `wx-tile ${d.star ? "star" : ""}` }, /* @__PURE__ */ React.createElement("div", { className: "wx-tile-top" }, /* @__PURE__ */ React.createElement("span", { className: "wx-tile-day" }, "D", String(d.n).padStart(2, "0")), d.star && /* @__PURE__ */ React.createElement("span", { className: "wx-tile-star" }, "\u2605")), /* @__PURE__ */ React.createElement("div", { className: "wx-tile-date" }, d.weekday, " ", d.date), /* @__PURE__ */ React.createElement("div", { className: "wx-tile-city" }, shortCity(d.city)), wx.state === "ok" || wx.state === "actual" ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "wx-tile-ico" }, window.weatherIcon(wx.icon, 28)), /* @__PURE__ */ React.createElement("div", { className: "wx-tile-temp" }, /* @__PURE__ */ React.createElement("b", null, wx.hi, "\xB0"), /* @__PURE__ */ React.createElement("span", null, wx.lo, "\xB0")), /* @__PURE__ */ React.createElement("div", { className: "wx-tile-cond" }, wx.state === "actual" ? `${wx.cond} \xB7 actual` : wx.cond)) : /* @__PURE__ */ React.createElement("div", { className: "wx-tile-soon" }, wx.state === "loading" ? "Loading\u2026" : wx.state === "past" ? "Trip day complete" : "Forecast nearer the date"));
  })), /* @__PURE__ */ React.createElement("p", { className: "wx-note" }, "Live 16-day forecast from Open-Meteo. Dates beyond the 16-day window fill in automatically as the trip gets closer."))));
}
function Hotels() {
  return /* @__PURE__ */ React.createElement("section", { className: "section", id: "hotels" }, /* @__PURE__ */ React.createElement("div", { className: "section-head reveal" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "label eyebrow" }, "04 \u2014 Where We Sleep"), /* @__PURE__ */ React.createElement("h2", { className: "section-title" }, "Three booked.", /* @__PURE__ */ React.createElement("br", null), "One to confirm.")), /* @__PURE__ */ React.createElement("p", { className: "section-blurb" }, "HCMC, the first Hanoi stay and the Ha Long cruise are all locked in. Just the final Hanoi stay left to book.")), /* @__PURE__ */ React.createElement("div", { className: "hotel-grid" }, D.hotels.map((h, i) => /* @__PURE__ */ React.createElement("article", { key: i, className: "hotel-card reveal" }, /* @__PURE__ */ React.createElement("div", { className: `hotel-status ${h.booked ? "booked" : "tbc"}` }, h.booked ? "Booked" : "To Book"), /* @__PURE__ */ React.createElement("div", { className: "label", style: { color: "var(--fg-muted)" } }, h.city), /* @__PURE__ */ React.createElement("h3", { className: "hotel-name" }, h.name), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11, letterSpacing: ".12em", color: "var(--fg-muted)" } }, h.dates.toUpperCase()), /* @__PURE__ */ React.createElement("div", { className: "hotel-tags" }, h.tags.map((t) => /* @__PURE__ */ React.createElement("span", { key: t }, t))), /* @__PURE__ */ React.createElement("p", { style: { margin: "4px 0 0", fontSize: 14, color: "var(--fg-muted)" } }, h.note)))));
}
function Phrases() {
  return /* @__PURE__ */ React.createElement("section", { className: "section", id: "phrases" }, /* @__PURE__ */ React.createElement("div", { className: "section-head reveal" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "label eyebrow" }, "05 \u2014 Speak Like a Local"), /* @__PURE__ */ React.createElement("h2", { className: "section-title" }, "A dozen", /* @__PURE__ */ React.createElement("br", null), "useful words.")), /* @__PURE__ */ React.createElement("p", { className: "section-blurb" }, "You don't need much. Locals genuinely appreciate the effort \u2014 even if your pronunciation is a disaster.")), /* @__PURE__ */ React.createElement("div", { className: "phrase-grid reveal" }, D.phrases.map((p, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "phrase" }, /* @__PURE__ */ React.createElement("div", { className: "phrase-vn" }, p.vn), /* @__PURE__ */ React.createElement("div", { className: "phrase-say" }, "/ ", p.say, " /"), /* @__PURE__ */ React.createElement("div", { className: "phrase-en" }, p.en), p.note && /* @__PURE__ */ React.createElement("div", { className: "phrase-note" }, p.note)))));
}
function App() {
  const [activeDay, setActiveDay] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [focusPin, setFocusPin] = useState(null);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const dashRef = useRef(null);
  const forecast = useTripForecast();
  useReveal();
  const jumpToDay = (n) => {
    const el = document.getElementById(`day-${n}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };
  const jumpToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };
  const openMap = (label) => {
    const match = D.mapPins.find((p) => label && label.toLowerCase().includes(p.label.toLowerCase().split(" ")[0]));
    setFocusPin((match == null ? void 0 : match.id) || null);
    setDrawerOpen(true);
  };
  const scrollPastHero = () => {
    window.scrollTo({ top: window.innerHeight - 80, behavior: "smooth" });
  };
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Hero, { onScrollDown: scrollPastHero }), /* @__PURE__ */ React.createElement(Dashboard, { onOpenWeather: () => setWeatherOpen(true) }), /* @__PURE__ */ React.createElement(DayBar, { active: activeDay, onJump: jumpToDay, onJumpSection: jumpToSection }), /* @__PURE__ */ React.createElement(
    Itinerary,
    {
      onOpenMap: openMap,
      onActiveDayChange: (n) => setActiveDay(n),
      forecast,
      onOpenWeather: () => setWeatherOpen(true)
    }
  ), /* @__PURE__ */ React.createElement(MapSection, { onOpenMap: () => {
    setFocusPin(null);
    setDrawerOpen(true);
  } }), /* @__PURE__ */ React.createElement(Flights, null), /* @__PURE__ */ React.createElement(Hotels, null), /* @__PURE__ */ React.createElement(Phrases, null), /* @__PURE__ */ React.createElement("footer", { className: "foot" }, /* @__PURE__ */ React.createElement("div", { className: "label eyebrow" }, "06 \u2014 End of File"), /* @__PURE__ */ React.createElement("div", { className: "foot-title" }, "See you on", /* @__PURE__ */ React.createElement("br", null), "the other side."), /* @__PURE__ */ React.createElement("p", { style: { margin: 0, color: "var(--fg-muted)", maxWidth: 460 } }, "Plans update as things are confirmed. Bookmark this page and check back any time."), /* @__PURE__ */ React.createElement("div", { className: "foot-row" }, /* @__PURE__ */ React.createElement("span", null, "The Doos \xB7 Vietnam '26"), /* @__PURE__ */ React.createElement("span", null, "Christine \xB7 Ashraf \xB7 Jason \xB7 Chris"))), /* @__PURE__ */ React.createElement(MapDrawer, { open: drawerOpen, onClose: () => setDrawerOpen(false), focusId: focusPin }), /* @__PURE__ */ React.createElement(WeatherDrawer, { open: weatherOpen, onClose: () => setWeatherOpen(false), forecast }));
}
const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(/* @__PURE__ */ React.createElement(App, null));
