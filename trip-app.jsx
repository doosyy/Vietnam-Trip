/* eslint-disable */
const { useState, useEffect, useRef, useMemo, useCallback } = React;
const D = window.TRIP_DATA;

/* ===== UTIL ============================================ */
function useCountdown(target) {
  const t = new Date(target).getTime();
  const [diff, setDiff] = useState(() => Math.max(0, t - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setDiff(Math.max(0, t - Date.now())), 1000);
    return () => clearInterval(id);
  }, [t]);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return { days, hours, mins, secs };
}

// Which phase of the trip we're in, recomputed every second.
function useTripPhase() {
  const dep = new Date(D.meta.departDate).getTime();
  const ret = new Date(D.meta.returnDate).getTime();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (now < dep) return { phase: "before" };
  if (now > ret) return { phase: "after" };
  const day = Math.min(D.meta.nights, Math.max(1, Math.floor((now - dep) / 86400000) + 1));
  return { phase: "during", day };
}

function useClock(tz, fmt = { hour: "2-digit", minute: "2-digit", hour12: false }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString("en-GB", { ...fmt, timeZone: tz });
}

function useReveal() {
  // Adds 'in' class to .reveal / .reveal-img children once they intersect.
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
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [ref, factor]);
}

/* ===== HERO ============================================ */
/* ===== TRIP FORECAST ================================== */
// Per-trip-date weather. Open-Meteo gives 16 days out; days beyond that show a
// placeholder and fill in automatically as the trip approaches.
const WX_LOCS = {
  hcmc:     [10.7769, 106.7009],
  hanoi:    [21.0278, 105.8342],
  halong:   [20.9101, 107.1839],
  ninhbinh: [20.2506, 105.9745],
};
function dayLocId(city) {
  const c = (city || "").toLowerCase();
  if (c.includes("long")) return "halong";
  if (c.includes("ninh binh")) return "ninhbinh";
  if (c.includes("chi minh") || c.includes("hcmc") || c.includes("mekong") || c.includes("cu chi")) return "hcmc";
  return "hanoi";
}
function dayIso(d) {
  // All trip days are in June 2026; parse the leading day number from "11 Jun".
  return `2026-06-${String(parseInt(d.date, 10)).padStart(2, "0")}`;
}
function dayWeather(forecast, d) {
  if (!forecast) return { state: "loading" };
  const iso = dayIso(d);
  const e = forecast[dayLocId(d.city)] && forecast[dayLocId(d.city)][iso];
  if (e) {
    const w = window.wmoWeather(e.code);
    // A date earlier than today (with data) is what actually happened.
    const todayIso = new Date().toISOString().slice(0, 10);
    const past = iso < todayIso;
    return { state: past ? "actual" : "ok", hi: e.hi, lo: e.lo, icon: w.icon, cond: w.cond };
  }
  // No data: a past date is "done", a future date is still beyond the forecast window.
  const todayIso = new Date().toISOString().slice(0, 10);
  return { state: iso < todayIso ? "past" : "soon" };
}
function shortCity(c) {
  return (c || "").split("→")[0].trim().replace("Ho Chi Minh City", "HCMC");
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
          const t = (j && j.daily && j.daily.time) || [];
          t.forEach((iso, i) => {
            m[iso] = {
              hi: Math.round(j.daily.temperature_2m_max[i]),
              lo: Math.round(j.daily.temperature_2m_min[i]),
              code: j.daily.weather_code[i],
            };
          });
          out[id] = m;
        } catch (e) { out[id] = {}; }
      }));
      if (!cancelled) setData(out);
    })();
    return () => { cancelled = true; };
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

  return (
    <section className="hero">
      <div ref={bgRef} className="hero-bg">
        <img src="https://doosyy.github.io/Vietnam-Trip/img/halong-bay.jpg" alt="Ha Long Bay" />
      </div>
      <div className="hero-noise"></div>
      <div className="hero-content boot ready">
        <div className="hero-top">
          <div className="hero-mark">
            <span className="dot"></span>
            <span className="label" style={{ letterSpacing: "0.22em" }}>THE DOOS · VN '26</span>
          </div>
          <div className="hero-clocks">
            <div className="hero-clock">
              <b>{melClock}</b><span>MEL</span>
            </div>
            <div className="hero-clock">
              <b>{sgnClock}</b><span>SGN</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div className="label" style={{ color: "rgba(255,255,255,0.78)" }}>Family Expedition · 13 Nights · 2 Cities</div>
          <h1 className="display hero-title" style={{ color: "#fff" }}>
            VIỆT<br/><em>NAM</em>
          </h1>
          <div className="hero-meta">
            <div className="hero-tag-group">
              <p className="hero-tag">
                Two weeks. South to north. From Saigon's streets and the Mekong's canals to Ha Long Bay's limestone towers.
              </p>
              <div className="hero-names">Christine&nbsp;· Ashraf&nbsp;· Jason&nbsp;&amp;&nbsp;Chris</div>
            </div>
            {trip.phase === "before" && (
              <div className="countdown" aria-label="Time until departure">
                <div><b>{String(cd.days).padStart(2,"0")}</b><span>Days</span></div>
                <div><b>{String(cd.hours).padStart(2,"0")}</b><span>Hours</span></div>
                <div><b>{String(cd.mins).padStart(2,"0")}</b><span>Mins</span></div>
                <div><b>{String(cd.secs).padStart(2,"0")}</b><span>Secs</span></div>
              </div>
            )}
            {trip.phase === "during" && (
              <div className="trip-status" aria-label="Trip in progress">
                <div className="trip-status-num"><b>{String(trip.day).padStart(2,"0")}</b><span>of {D.meta.nights}</span></div>
                <div className="trip-status-text">
                  <b>We're in Vietnam</b>
                  <span>Day {trip.day} of the trip. Live weather and local time below.</span>
                </div>
              </div>
            )}
            {trip.phase === "after" && (
              <div className="trip-status" aria-label="Trip complete">
                <div className="trip-status-num done"><b>✓</b><span>done</span></div>
                <div className="trip-status-text">
                  <b>Until next time</b>
                  <span>That's a wrap on Vietnam '26. Thanks for following along.</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <button className="scroll-hint" onClick={onScrollDown} style={{ color: "rgba(255,255,255,0.85)" }}>
          <span>Scroll</span>
        </button>
      </div>
    </section>
  );
}

/* ===== DASHBOARD ====================================== */
function Dashboard({ onOpenWeather }) {
  const cities = Object.keys(D.weather);
  const [city, setCity] = useState(cities[0]);
  const [liveWeather, setLiveWeather] = useState(D.weather);
  const w = liveWeather[city] || D.weather[city];

  const [rate, setRate] = useState(16450); // AUD→VND, refreshed live on load
  const [aud, setAud] = useState("100");
  const [vndStr, setVndStr] = useState(String(Math.round(100 * 16450)));
  const [flipped, setFlipped] = useState(false);

  // City coordinates for the live weather fetch (one per D.weather key)
  const cityCoords = {
    "Ho Chi Minh City": [10.7769, 106.7009],
    "Hanoi": [21.0278, 105.8342],
    "Ha Long Bay": [20.9101, 107.1839],
    "Ninh Binh": [20.2506, 105.9745],
  };

  // Live weather (Open-Meteo, free, no key) — falls back to the static data on failure
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
        } catch (e) {}
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
            aqi: aqi != null ? Math.round(aqi) : (D.weather[c] ? D.weather[c].aqi : "—"),
          },
        }));
      } catch (e) { /* keep static fallback */ }
    });
    return () => { cancelled = true; };
  }, []);

  // Live exchange rate (open.er-api.com, free, no key) — falls back to the snapshot
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
      } catch (e) { /* keep snapshot */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Sanitizers — keep raw text in state so the user can edit freely.
  // sanitizeDec: digits + at most one decimal point (for AUD).
  const sanitizeDec = (s) => {
    let c = String(s).replace(/[^\d.]/g, "");
    const parts = c.split(".");
    if (parts.length > 2) c = parts[0] + "." + parts.slice(1).join("");
    return c;
  };
  // sanitizeInt: digits only, strip leading zeros so "0" + "5" becomes "5" (for VND).
  const sanitizeInt = (s) => {
    const d = String(s).replace(/\D/g, "");
    if (d === "") return "";
    const noLead = d.replace(/^0+/, "");
    return noLead === "" ? "0" : noLead;
  };

  const onAudChange = (e) => {
    const s = sanitizeDec(e.target.value);
    setAud(s);
    if (s === "" || s === ".") { setVndStr(""); return; }
    const v = parseFloat(s);
    setVndStr(isNaN(v) ? "" : String(Math.round(v * rate)));
  };
  const onVndChange = (e) => {
    const s = sanitizeInt(e.target.value);
    setVndStr(s);
    if (s === "") { setAud(""); return; }
    const v = parseFloat(s);
    setAud(isNaN(v) ? "" : (v / rate).toFixed(2));
  };

  const audSide = (
    <label className="fx-side">
      <span className="fx-label">Australian Dollars</span>
      <span className="fx-input">
        <input type="text" inputMode="decimal" pattern="[0-9.]*" value={aud} onChange={onAudChange} aria-label="AUD amount" />
        <span className="fx-currency">A$</span>
      </span>
    </label>
  );
  const vndSide = (
    <label className="fx-side" style={{ alignItems: "flex-end", textAlign: "right" }}>
      <span className="fx-label">Vietnamese Dong</span>
      <span className="fx-input" style={{ justifyContent: "flex-end" }}>
        <input type="text" inputMode="numeric" pattern="[0-9]*" value={vndStr} onChange={onVndChange} aria-label="VND amount" style={{ textAlign: "right" }} />
        <span className="fx-currency">₫</span>
      </span>
    </label>
  );

  const quick = flipped ? [50000, 250000, 1000000, 5000000] : [10, 50, 100, 500];

  return (
    <div className="dashboard reveal">
      <div className="dashboard-inner">
        <div className="dash-weather">
          <div className="dash-head">
            <span className="label">Weather Now</span>
            <div className="city-select" role="tablist">
              {cities.map((c) => (
                <button key={c} className={city === c ? "on" : ""} onClick={() => setCity(c)}>
                  {c.split(" ").map(w => w[0]).join("").slice(0,3)}
                </button>
              ))}
            </div>
          </div>
          <button className="weather-now" type="button" onClick={onOpenWeather} aria-label="Open the 13-day trip forecast">
            <div className="weather-icon">{window.weatherIcon(w.icon, 30)}</div>
            <div>
              <div className="weather-temp">{w.temp}<sup>°C</sup></div>
              <div className="weather-cond">{city} · {w.cond}</div>
              <div className="weather-cta">13-day trip forecast <Icon.Arrow s={11}/></div>
            </div>
            <div className="weather-side">
              <span className="weather-pill">H {w.hi}° · L {w.lo}°</span>
              <span className="weather-pill">AQI {w.aqi}</span>
            </div>
          </button>
        </div>

        <div className="dash-fx">
          <div className="dash-head">
            <span className="label">AUD ⇄ VND</span>
            <span className="label" style={{ color: "var(--fg-muted)" }}>1 A$ ≈ {rate.toLocaleString()} ₫</span>
          </div>
          <div className="fx-row">
            {flipped ? vndSide : audSide}
            <div className="fx-swap-wrap">
              <button
                className="fx-swap"
                onClick={() => setFlipped(f => !f)}
                aria-label="Swap sides"
                title="Swap sides"
              >
                <Icon.Swap s={16} />
              </button>
              <span className="fx-swap-hint">Swap</span>
            </div>
            {flipped ? audSide : vndSide}
          </div>
          <div className="fx-quick">
            {quick.map((q) => (
              <button
                key={q}
                onClick={() => {
                  if (flipped) { setVndStr(String(q)); setAud((q / rate).toFixed(2)); }
                  else { setAud(String(q)); setVndStr(String(Math.round(q * rate))); }
                }}
              >
                {flipped ? `${(q/1000).toFixed(0)}k₫` : `A$${q}`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== DAY BAR ======================================= */
function DayBar({ active, onJump, onJumpSection }) {
  const ref = useRef(null);
  const [lifted, setLifted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    // Auto-scroll the active chip into view
    const bar = ref.current;
    if (!bar) return;
    const chip = bar.querySelector(`[data-chip="${active}"]`);
    if (chip) {
      const left = chip.offsetLeft - bar.clientWidth / 2 + chip.offsetWidth / 2;
      bar.scrollTo({ left, behavior: "smooth" });
    }
  }, [active]);

  useEffect(() => {
    // Add shadow when the bar is pinned (not at its natural position)
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
    return () => { io.disconnect(); sentinel.remove(); };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("touchstart", onDoc); };
  }, [menuOpen]);

  const sections = [
    { id: "maps",     label: "Map",      sub: "The route" },
    { id: "flights",  label: "Flights",  sub: "3 hops" },
    { id: "hotels",   label: "Hotels",   sub: "Where we sleep" },
    { id: "phrases",  label: "Phrases",  sub: "Speak local" },
  ];

  return (
    <nav className={`daybar ${lifted ? "lifted" : ""}`} aria-label="Day navigation">
      <div className="daybar-inner">
        <div className="daybar-scroll" ref={ref}>
          {D.days.map((d) => (
            <button
              key={d.n}
              data-chip={d.n}
              className={`daybar-chip ${active === d.n ? "on" : ""} ${d.star ? "star" : ""}`}
              onClick={() => onJump(d.n)}
            >
              <b>D{String(d.n).padStart(2,"0")}</b>
              <span>{d.date}</span>
            </button>
          ))}
        </div>
        <div className="daybar-jump" ref={menuRef}>
          <button
            className={`daybar-jump-btn ${menuOpen ? "on" : ""}`}
            onClick={() => setMenuOpen(o => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span>Skip</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" style={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 220ms" }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          {menuOpen && (
            <div className="daybar-menu" role="menu">
              <div className="daybar-menu-label">Skip itinerary →</div>
              {sections.map((s) => (
                <button key={s.id} className="daybar-menu-item" onClick={() => { setMenuOpen(false); onJumpSection(s.id); }} role="menuitem">
                  <b>{s.label}</b>
                  <span>{s.sub}</span>
                </button>
              ))}
              <button className="daybar-menu-item daybar-menu-item--top" onClick={() => { setMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} role="menuitem">
                <b>↑ Top</b>
                <span>Back to hero</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ===== FLIGHTS ======================================= */
function Flights() {
  return (
    <section className="section" id="flights">
      <div className="section-head reveal">
        <div>
          <div className="label eyebrow">03 — Getting There</div>
          <h2 className="section-title">Three flights, two cities.</h2>
        </div>
        <p className="section-blurb">
          All sorted. Passports valid 6+ months past June 2026 — that's the only thing to check.
        </p>
      </div>
      <div className="flight-grid">
        {D.flights.map((f, i) => (
          <article key={i} className="flight-card reveal">
            <div className="flight-kind">
              <Icon.Plane s={11}/> &nbsp;{f.kind}
            </div>
            <div className="flight-route">
              <div>
                <div className="flight-code">{f.from.code}</div>
                <div className="flight-city">{f.from.city} · {f.from.terminal}</div>
              </div>
              <div className="flight-arrow"><Icon.Arrow s={20}/></div>
              <div style={{ textAlign: "right" }}>
                <div className="flight-code">{f.to.code}</div>
                <div className="flight-city">{f.to.city} · {f.to.terminal}</div>
              </div>
            </div>
            <div className="flight-times">
              <div><span className="label">Depart</span><b>{f.depart}</b></div>
              <div><span className="label">Arrive</span><b>{f.arrive}</b></div>
              <div style={{ textAlign: "right" }}><span className="label">Flight</span><b>{f.flightNo}</b></div>
            </div>
            <div className="flight-note">
              <span className="mono" style={{ fontSize: 11, letterSpacing: ".1em", color: "var(--fg-muted)" }}>{f.date.toUpperCase()} · {f.duration} · {f.carrier}{f.aircraft ? " · " + f.aircraft : ""}</span>
              <p style={{ margin: "8px 0 0" }}>{f.note}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ===== ACTIVITY ROW =================================== */
function Activity({ a, onLinkOpenMap }) {
  const [open, setOpen] = useState(false);
  const isClockTime = /^\d{1,2}:\d{2}$/.test(a.time);
  return (
    <div className={`activity ${open ? "open" : ""}`}>
      <button className="activity-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className={`activity-time ${isClockTime ? "is-clock" : "is-fuzzy"}`}>{a.time}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`activity-mood mood-${a.mood}`}></span>
          <span className="activity-title">{a.title}</span>
        </span>
        <span className="activity-caret"><Icon.Plus s={16}/></span>
      </button>
      <div className="activity-body">
        <div>
          <div className="activity-detail">
            {a.detail}
            {(a.link || a.url) && (
              <div className="activity-actions">
                {a.link && (
                  <button className="btn-ghost" onClick={() => onLinkOpenMap?.(a.link)}>
                    <Icon.Map s={11}/> &nbsp; View on Map
                  </button>
                )}
                {a.url && (
                  <a className="btn-ghost" href={a.url} target="_blank" rel="noopener noreferrer">
                    <Icon.Arrow s={11}/> &nbsp; Tour details
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== ITINERARY ===================================== */
function Itinerary({ onOpenMap, onActiveDayChange, forecast, onOpenWeather }) {
  // Track which day is in view (for the day-bar highlight) and the dominant mood
  // (for the page-wide day/night theme transition).
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
        // Pick the day with highest visibility
        let best = null, bestV = 0;
        Object.entries(visibility).forEach(([id, v]) => {
          if (v > bestV) { best = id; bestV = v; }
        });
        if (best) {
          onActiveDayChange?.(parseInt(best, 10));
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

  return (
    <section className="section" id="itinerary">
      <div className="section-head reveal">
        <div>
          <div className="label eyebrow">01 — Day by Day</div>
          <h2 className="section-title">The plan, hour by hour.</h2>
        </div>
        <p className="section-blurb">
          Tap any activity for details, notes, and timing. The site shifts to a darker tone as the day moves toward evening —
          easier on the eyes when you're reading after dinner.
        </p>
      </div>

      <div>
        {D.days.map((d) => (
          <article key={d.n} className="day-block" id={`day-${d.n}`} data-day={d.n} data-mood={d.mood}>
            <div className="day-anchor">
              <div className="day-anchor-head">
                <div className="day-num">{String(d.n).padStart(2,"0")}</div>
                <div className="day-meta">
                  <div className="day-city">
                    <span className="day-city-name">{d.city}</span>
                    <span className="day-city-sep">·</span>
                    <span className="day-city-date">{d.weekday} {d.date}</span>
                  </div>
                  <div className="day-title">{d.title}</div>
                  <div className="day-tags">
                    {d.star && <span className="day-tag unmissable">★ Unmissable</span>}
                    {d.tags.map((t) => <span key={t} className="day-tag">{t}</span>)}
                  </div>
                  {(() => {
                    const wx = dayWeather(forecast, d);
                    const hasTemp = wx.state === "ok" || wx.state === "actual";
                    return (
                      <button className={`wx-chip ${hasTemp ? "" : "wx-chip--soon"}`} onClick={onOpenWeather} title="See the full trip forecast">
                        {hasTemp ? (
                          <>
                            <span className="wx-ico">{window.weatherIcon(wx.icon, 16)}</span>
                            <b>{wx.hi}°</b><span className="wx-lo">{wx.lo}°</span>
                            <span className="wx-cond">{wx.cond}</span>
                          </>
                        ) : wx.state === "loading" ? (
                          <span className="wx-soon">Loading forecast…</span>
                        ) : wx.state === "past" ? (
                          <span className="wx-soon">Trip day complete</span>
                        ) : (
                          <span className="wx-soon">Forecast nearer the date</span>
                        )}
                      </button>
                    );
                  })()}
                </div>
              </div>

              <div className="day-hero reveal-img">
                <image-slot
                  id={`day-${d.n}-hero`}
                  src={d.hero}
                  shape="rect"
                  placeholder={`Drop a photo for ${d.title}`}
                  style={{ width: "100%", height: "100%", display: "block" }}
                ></image-slot>
                <span className="label">{d.city}</span>
              </div>
            </div>

            {d.region && <RegionalMap region={d.region} />}

            <div className="activity-list">
              {d.activities.map((a, i) => (
                <Activity key={i} a={a} onLinkOpenMap={onOpenMap} />
              ))}
            </div>

            {d.tip && (
              <div className="day-tip">
                <b>Heads up</b>
                {d.tip}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

/* ===== REGIONAL MAP (per day trip) ============================ */
function RegionalMap({ region }) {
  if (!region) return null;
  const { base, dest, bearing, distance, duration, transport } = region;

  const elRef = useRef(null);
  const mapRef = useRef(null);
  const tileRef = useRef(null);
  const lineRef = useRef(null);

  const tileUrl = (dark) =>
    dark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  const isNight = () => document.documentElement.getAttribute("data-theme") === "night";
  const accentColor = () =>
    getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#C8102E";

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
      tap: false,
    });
    mapRef.current = map;

    tileRef.current = L.tileLayer(tileUrl(isNight()), {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap, &copy; CARTO',
    }).addTo(map);

    lineRef.current = L.polyline([a, b], {
      color: accentColor(),
      weight: 3,
      opacity: 0.85,
      dashArray: "2 8",
      lineCap: "round",
    }).addTo(map);

    const baseIcon = L.divIcon({ className: "seg-pin seg-base", html: "<span></span>", iconSize: [18, 18], iconAnchor: [9, 9] });
    const destIcon = L.divIcon({ className: "seg-pin seg-dest", html: "<span>★</span>", iconSize: [24, 24], iconAnchor: [12, 12] });
    L.marker(a, { icon: baseIcon }).addTo(map).bindTooltip(`${base.name} · BASE`, { direction: "top", offset: [0, -10], className: "trip-tip" });
    L.marker(b, { icon: destIcon }).addTo(map).bindTooltip(`${dest.name} · ${distance}, ${duration}`, { direction: "top", offset: [0, -14], className: "trip-tip" });

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

  return (
    <div className="region-map reveal">
      <div className="region-map-head">
        <div className="region-map-eyebrow">
          <span className="label">Travel Route</span>
        </div>
        <div className="region-map-stats">
          <div><span className="label">Bearing</span><b>{bearing}</b></div>
          <div><span className="label">Distance</span><b>{distance}</b></div>
          <div><span className="label">Duration</span><b>{duration}</b></div>
          <div><span className="label">Transport</span><b>{transport}</b></div>
        </div>
      </div>

      <div className="region-map-canvas">
        <div ref={elRef} className="leaflet-stage" role="img" aria-label={`Route from ${base.name} to ${dest.name}`} />
      </div>
    </div>
  );
}
function VietnamMap({ activeId, onPickPin, interactive = true }) {
  // Real interactive map via Leaflet + free CARTO basemap (no API key).
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const tileRef = useRef(null);
  const routeRef = useRef(null);

  const tileUrl = (dark) =>
    dark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  const isNight = () => document.documentElement.getAttribute("data-theme") === "night";
  const accentColor = () =>
    getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#C8102E";

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
      tap: interactive,
    });
    mapRef.current = map;

    tileRef.current = L.tileLayer(tileUrl(isNight()), {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap, &copy; CARTO',
    }).addTo(map);

    // Route line, south to north
    const order = D.routeOrder || pins.map((p) => p.id);
    const routePts = order
      .map((id) => pins.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => [p.lat, p.lng]);
    routeRef.current = L.polyline(routePts, {
      color: accentColor(),
      weight: 3,
      opacity: 0.85,
      dashArray: "2 8",
      lineCap: "round",
    }).addTo(map);

    // Numbered markers (number matches the legend order)
    pins.forEach((p, i) => {
      const icon = L.divIcon({
        className: "trip-pin",
        html: `<span>${i + 1}</span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const m = L.marker([p.lat, p.lng], { icon }).addTo(map);
      m.bindTooltip(`${p.label} · ${p.sub}`, {
        direction: "top",
        offset: [0, -14],
        className: "trip-tip",
      });
      if (onPickPin) m.on("click", () => onPickPin(p.id));
      markersRef.current[p.id] = m;
    });

    map.fitBounds(allLatLng, { padding: [34, 34] });

    // Keep the map sized correctly inside drawers / aspect-ratio boxes
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(elRef.current);

    // Swap tiles + route colour when the day/night theme changes
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

  // Focus a stop when activeId changes; reset to full route when cleared
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

  return <div ref={elRef} className="leaflet-stage" role="img" aria-label="Map of the Vietnam trip route" />;
}

function MapSection({ onOpenMap }) {
  return (
    <section className="section" id="maps">
      <div className="section-head reveal">
        <div>
          <div className="label eyebrow">02 — The Route</div>
          <h2 className="section-title">South to north,<br/>by air, road &amp; water.</h2>
        </div>
        <p className="section-blurb">
          We fly into Saigon, spend four days in the south, then jump to Hanoi for the second leg.
          Two day-trips out from each base.
        </p>
      </div>

      <div className="mapcard reveal">
        <div className="map-mini" style={{ color: "var(--fg)" }}>
          <VietnamMap interactive={false} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, color: "var(--fg-muted)", fontSize: 15 }}>
            Six stops, two regional cuisines, one overnight cruise. Tap below to see the route in full —
            pinch and explore each stop.
          </p>
          <button className="map-cta" onClick={onOpenMap}>
            <span>Open Full Map</span>
            <Icon.Arrow s={18}/>
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {D.mapPins.slice(0, 6).map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ width: 22, height: 22, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "JetBrains Mono, monospace", fontSize: 11, fontWeight: 700 }}>{i+1}</span>
                <b style={{ fontFamily: "Bricolage Grotesque, sans-serif", letterSpacing: "-0.01em" }}>{p.label}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===== DRAWER ======================================= */
function MapDrawer({ open, onClose, focusId }) {
  // Allow swipe-down to close
  const drawerRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Touch handlers
  const start = useRef(0);
  const dy = useRef(0);
  const dragging = useRef(false);
  const onTouchStart = (e) => { start.current = e.touches[0].clientY; dragging.current = true; };
  const onTouchMove = (e) => {
    if (!dragging.current) return;
    dy.current = Math.max(0, e.touches[0].clientY - start.current);
    if (drawerRef.current) drawerRef.current.style.transform = `translateY(${dy.current}px)`;
  };
  const onTouchEnd = () => {
    dragging.current = false;
    if (!drawerRef.current) return;
    if (dy.current > 100) { onClose(); }
    drawerRef.current.style.transform = "";
    dy.current = 0;
  };

  return (
    <>
      <div className={`drawer-scrim ${open ? "open" : ""}`} onClick={onClose}></div>
      <div ref={drawerRef} className={`drawer ${open ? "open" : ""}`} role="dialog" aria-label="Trip Map">
        <div className="drawer-handle" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div></div>
        </div>
        <div className="drawer-head">
          <div>
            <div className="label" style={{ color: "var(--fg-muted)" }}>The Route</div>
            <div className="drawer-title">South → North · 6 stops</div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close"><Icon.Close /></button>
        </div>
        <div className="drawer-body">
          <div className="map-full" style={{ color: "var(--fg)" }}>
            <VietnamMap activeId={focusId} />
          </div>
          <div className="map-legend">
            {D.mapPins.map((p, i) => (
              <div key={p.id} className="map-legend-item">
                <span className="n">{i+1}</span>
                <div>
                  <b>{p.label}</b>
                  <span>{p.sub}</span>
                </div>
                <em>{p.id.toUpperCase()}</em>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ===== WEATHER DRAWER =============================== */
function WeatherDrawer({ open, onClose, forecast }) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <div className={`drawer-scrim ${open ? "open" : ""}`} onClick={onClose}></div>
      <div className={`drawer ${open ? "open" : ""}`} role="dialog" aria-label="Trip Forecast">
        <div className="drawer-handle"><div></div></div>
        <div className="drawer-head">
          <div>
            <div className="label" style={{ color: "var(--fg-muted)" }}>Weather</div>
            <div className="drawer-title">Trip forecast · 13 days</div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close"><Icon.Close /></button>
        </div>
        <div className="wx-body">
          <div className="wx-strip">
            {D.days.map((d) => {
              const wx = dayWeather(forecast, d);
              return (
                <div key={d.n} className={`wx-tile ${d.star ? "star" : ""}`}>
                  <div className="wx-tile-top">
                    <span className="wx-tile-day">D{String(d.n).padStart(2, "0")}</span>
                    {d.star && <span className="wx-tile-star">★</span>}
                  </div>
                  <div className="wx-tile-date">{d.weekday} {d.date}</div>
                  <div className="wx-tile-city">{shortCity(d.city)}</div>
                  {(wx.state === "ok" || wx.state === "actual") ? (
                    <>
                      <div className="wx-tile-ico">{window.weatherIcon(wx.icon, 28)}</div>
                      <div className="wx-tile-temp"><b>{wx.hi}°</b><span>{wx.lo}°</span></div>
                      <div className="wx-tile-cond">{wx.state === "actual" ? `${wx.cond} · actual` : wx.cond}</div>
                    </>
                  ) : (
                    <div className="wx-tile-soon">{wx.state === "loading" ? "Loading…" : wx.state === "past" ? "Trip day complete" : "Forecast nearer the date"}</div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="wx-note">Live 16-day forecast from Open-Meteo. Dates beyond the 16-day window fill in automatically as the trip gets closer.</p>
        </div>
      </div>
    </>
  );
}

/* ===== HOTELS ====================================== */
function Hotels() {
  return (
    <section className="section" id="hotels">
      <div className="section-head reveal">
        <div>
          <div className="label eyebrow">04 — Where We Sleep</div>
          <h2 className="section-title">Three booked.<br/>One to confirm.</h2>
        </div>
        <p className="section-blurb">
          HCMC, the first Hanoi stay and the Ha Long cruise are all locked in. Just the final Hanoi stay left to book.
        </p>
      </div>
      <div className="hotel-grid">
        {D.hotels.map((h, i) => (
          <article key={i} className="hotel-card reveal">
            <div className={`hotel-status ${h.booked ? "booked" : "tbc"}`}>{h.booked ? "Booked" : "To Book"}</div>
            <div className="label" style={{ color: "var(--fg-muted)" }}>{h.city}</div>
            <h3 className="hotel-name">{h.name}</h3>
            <div className="mono" style={{ fontSize: 11, letterSpacing: ".12em", color: "var(--fg-muted)" }}>{h.dates.toUpperCase()}</div>
            <div className="hotel-tags">
              {h.tags.map((t) => <span key={t}>{t}</span>)}
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--fg-muted)" }}>{h.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ===== PHRASES ===================================== */
function Phrases() {
  return (
    <section className="section" id="phrases">
      <div className="section-head reveal">
        <div>
          <div className="label eyebrow">05 — Speak Like a Local</div>
          <h2 className="section-title">A dozen<br/>useful words.</h2>
        </div>
        <p className="section-blurb">
          You don't need much. Locals genuinely appreciate the effort — even if your pronunciation is a disaster.
        </p>
      </div>
      <div className="phrase-grid reveal">
        {D.phrases.map((p, i) => (
          <div key={i} className="phrase">
            <div className="phrase-vn">{p.vn}</div>
            <div className="phrase-say">/ {p.say} /</div>
            <div className="phrase-en">{p.en}</div>
            {p.note && <div className="phrase-note">{p.note}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ===== APP ========================================= */
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
    // Try to focus a pin by matching label loosely
    const match = D.mapPins.find(p => label && label.toLowerCase().includes(p.label.toLowerCase().split(" ")[0]));
    setFocusPin(match?.id || null);
    setDrawerOpen(true);
  };

  const scrollPastHero = () => {
    window.scrollTo({ top: window.innerHeight - 80, behavior: "smooth" });
  };

  return (
    <>
      <Hero onScrollDown={scrollPastHero} />
      <Dashboard onOpenWeather={() => setWeatherOpen(true)} />
      <DayBar active={activeDay} onJump={jumpToDay} onJumpSection={jumpToSection} />

      <Itinerary
        onOpenMap={openMap}
        onActiveDayChange={(n) => setActiveDay(n)}
        forecast={forecast}
        onOpenWeather={() => setWeatherOpen(true)}
      />

      <MapSection onOpenMap={() => { setFocusPin(null); setDrawerOpen(true); }} />
      <Flights />
      <Hotels />
      <Phrases />

      <footer className="foot">
        <div className="label eyebrow">06 — End of File</div>
        <div className="foot-title">See you on<br/>the other side.</div>
        <p style={{ margin: 0, color: "var(--fg-muted)", maxWidth: 460 }}>
          Plans update as things are confirmed. Bookmark this page and check back any time.
        </p>
        <div className="foot-row">
          <span>The Doos · Vietnam '26</span>
          <span>Christine · Ashraf · Jason · Chris</span>
        </div>
      </footer>

      <MapDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} focusId={focusPin} />
      <WeatherDrawer open={weatherOpen} onClose={() => setWeatherOpen(false)} forecast={forecast} />
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<App />);
