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
function Hero({ onScrollDown }) {
  const bgRef = useRef(null);
  useParallax(bgRef, 0.32);
  const cd = useCountdown(D.meta.departDate);
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
            <div className="countdown" aria-label="Time until departure">
              <div><b>{String(cd.days).padStart(2,"0")}</b><span>Days</span></div>
              <div><b>{String(cd.hours).padStart(2,"0")}</b><span>Hours</span></div>
              <div><b>{String(cd.mins).padStart(2,"0")}</b><span>Mins</span></div>
              <div><b>{String(cd.secs).padStart(2,"0")}</b><span>Secs</span></div>
            </div>
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
function Dashboard() {
  const cities = Object.keys(D.weather);
  const [city, setCity] = useState(cities[0]);
  const w = D.weather[city];

  const RATE = 16450; // 1 AUD ≈ 16,450 VND (snapshot)
  const [aud, setAud] = useState("100");
  const [vndStr, setVndStr] = useState(String(Math.round(100 * RATE)));
  const [flipped, setFlipped] = useState(false);

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
    setVndStr(isNaN(v) ? "" : String(Math.round(v * RATE)));
  };
  const onVndChange = (e) => {
    const s = sanitizeInt(e.target.value);
    setVndStr(s);
    if (s === "") { setAud(""); return; }
    const v = parseFloat(s);
    setAud(isNaN(v) ? "" : (v / RATE).toFixed(2));
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
          <div className="weather-now">
            <div className="weather-icon">{window.weatherIcon(w.icon, 30)}</div>
            <div>
              <div className="weather-temp">{w.temp}<sup>°C</sup></div>
              <div className="weather-cond">{city} · {w.cond}</div>
            </div>
            <div className="weather-side">
              <span className="weather-pill">H {w.hi}° · L {w.lo}°</span>
              <span className="weather-pill">AQI {w.aqi}</span>
            </div>
          </div>
        </div>

        <div className="dash-fx">
          <div className="dash-head">
            <span className="label">AUD ⇄ VND</span>
            <span className="label" style={{ color: "var(--fg-muted)" }}>1 A$ ≈ {RATE.toLocaleString()} ₫</span>
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
                  if (flipped) { setVndStr(String(q)); setAud((q / RATE).toFixed(2)); }
                  else { setAud(String(q)); setVndStr(String(Math.round(q * RATE))); }
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
            {a.link && (
              <div className="activity-actions">
                <button className="btn-ghost" onClick={() => onLinkOpenMap?.(a.link)}>
                  <Icon.Map s={11}/> &nbsp; View on Map
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== ITINERARY ===================================== */
function Itinerary({ onOpenMap, onActiveDayChange }) {
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
  const { base, dest, bearing, distance, duration, transport, terrain } = region;

  // Auto-curve control point — bulge perpendicular to the line so the route reads as an arc
  const midX = (base.x + dest.x) / 2;
  const midY = (base.y + dest.y) / 2;
  const dx = dest.x - base.x;
  const dy = dest.y - base.y;
  const len = Math.sqrt(dx*dx + dy*dy) || 1;
  // Perpendicular offset (right-hand of direction of travel)
  const nx = -dy / len;
  const ny = dx / len;
  const bulge = Math.min(60, len * 0.18);
  const cx = midX + nx * bulge;
  const cy = midY + ny * bulge;

  // Terrain backdrop element — subtle, varies per trip. Drawn within 500×300 viewBox.
  const terrainEl = () => {
    switch (terrain) {
      case "river":
        return (
          <g opacity="0.4" stroke="var(--accent-2)" strokeWidth="2.5" fill="none" strokeLinecap="round">
            <path d="M -20 210 Q 80 200 140 220 T 300 230 T 520 240" />
            <path d="M -20 245 Q 100 235 180 255 T 340 265 T 520 270" strokeWidth="1.5" opacity="0.7" />
            <path d="M -20 275 Q 90 265 170 285 T 320 290 T 520 295" strokeWidth="1" opacity="0.55" />
          </g>
        );
      case "bay":
        return (
          <g opacity="0.45">
            {/* Coast — east side of viewBox is the sea */}
            <path d="M 340 0 Q 360 60 340 120 Q 320 180 360 240 L 360 300 L 0 300 L 0 0 Z" fill="var(--bg-2)" opacity="0.5"/>
            <path d="M 340 0 Q 360 60 340 120 Q 320 180 360 240 L 360 300" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.7"/>
            {/* Limestone karst dots in the bay */}
            <g fill="currentColor" opacity="0.55">
              <circle cx="385" cy="120" r="5"/>
              <circle cx="405" cy="145" r="4"/>
              <circle cx="395" cy="195" r="6"/>
              <circle cx="445" cy="135" r="5"/>
              <circle cx="465" cy="180" r="4"/>
              <circle cx="420" cy="220" r="3"/>
              <circle cx="475" cy="220" r="4"/>
              <circle cx="490" cy="155" r="3"/>
            </g>
          </g>
        );
      case "karst":
        return (
          <g opacity="0.5" fill="currentColor">
            {/* Triangular karst peaks scattered in the destination region */}
            <g opacity="0.55">
              <polygon points="130,220 145,190 160,220"/>
              <polygon points="160,232 180,198 200,232"/>
              <polygon points="200,224 215,200 230,224"/>
              <polygon points="110,232 125,210 140,232"/>
              <polygon points="225,222 240,200 255,222"/>
              <polygon points="85,225 100,205 115,225"/>
            </g>
            {/* River through paddies */}
            <path d="M 60 240 Q 140 230 200 250 T 360 260" stroke="var(--accent-2)" strokeWidth="2" fill="none" opacity="0.55"/>
          </g>
        );
      case "jungle":
      default:
        // Jungle cover concentrated around the Cu Chi destination at (130,80).
        return (
          <g opacity="0.45" fill="currentColor">
            {[[110,55],[140,90],[80,100],[160,55],[100,80],[130,115],[170,90],[90,70],[180,70],[120,40],[60,80],[155,115]].map(([x,y],i) => (
              <circle key={i} cx={x} cy={y} r="6"/>
            ))}
          </g>
        );
    }
  };

  return (
    <div className="region-map reveal">
      <div className="region-map-head">
        <div className="region-map-eyebrow">
          <span className="label">Day Trip Route</span>
        </div>
        <div className="region-map-stats">
          <div><span className="label">Bearing</span><b>{bearing}</b></div>
          <div><span className="label">Distance</span><b>{distance}</b></div>
          <div><span className="label">Duration</span><b>{duration}</b></div>
          <div><span className="label">Transport</span><b>{transport}</b></div>
        </div>
      </div>

      <div className="region-map-canvas">
        <svg viewBox="0 0 500 300" preserveAspectRatio="xMidYMid meet">
          <defs>
            <pattern id="r-grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.18"/>
            </pattern>
            <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto">
              <polygon points="0 0, 8 5, 0 10" fill="var(--accent)" />
            </marker>
          </defs>
          <rect width="500" height="300" fill="url(#r-grid)" />

          {terrainEl()}

          {/* Route line — base → destination, curved */}
          <path
            d={`M ${base.x} ${base.y} Q ${cx} ${cy} ${dest.x} ${dest.y}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeDasharray="6 5"
            strokeLinecap="square"
            markerEnd="url(#arrowhead)"
          />

          {/* Base pin (open square) */}
          <g transform={`translate(${base.x}, ${base.y})`}>
            <rect x="-9" y="-9" width="18" height="18" fill="var(--bg)" stroke="currentColor" strokeWidth="2"/>
            <circle cx="0" cy="0" r="2.5" fill="currentColor"/>
            {base.x > 320 ? (
              <>
                <text x="-14" y="4" fontFamily="Bricolage Grotesque, sans-serif" fontSize="14" fontWeight="700" fill="currentColor" textAnchor="end">{base.name}</text>
                <text x="-14" y="18" fontFamily="JetBrains Mono, monospace" fontSize="9" letterSpacing="1" fill="currentColor" opacity="0.55" textAnchor="end">BASE</text>
              </>
            ) : (
              <>
                <text x="14" y="4" fontFamily="Bricolage Grotesque, sans-serif" fontSize="14" fontWeight="700" fill="currentColor">{base.name}</text>
                <text x="14" y="18" fontFamily="JetBrains Mono, monospace" fontSize="9" letterSpacing="1" fill="currentColor" opacity="0.55">BASE</text>
              </>
            )}
          </g>

          {/* Destination pin (filled accent) */}
          <g transform={`translate(${dest.x}, ${dest.y})`}>
            <rect x="-11" y="-11" width="22" height="22" fill="var(--accent)"/>
            <text x="0" y="4" fontFamily="JetBrains Mono, monospace" fontSize="12" fontWeight="700" fill="#fff" textAnchor="middle">★</text>
            {dest.x > 320 ? (
              <>
                <text x="-16" y="4" fontFamily="Bricolage Grotesque, sans-serif" fontSize="14" fontWeight="700" fill="currentColor" textAnchor="end">{dest.name}</text>
                <text x="-16" y="18" fontFamily="JetBrains Mono, monospace" fontSize="9" letterSpacing="1" fill="currentColor" opacity="0.55" textAnchor="end">DESTINATION</text>
              </>
            ) : (
              <>
                <text x="16" y="4" fontFamily="Bricolage Grotesque, sans-serif" fontSize="14" fontWeight="700" fill="currentColor">{dest.name}</text>
                <text x="16" y="18" fontFamily="JetBrains Mono, monospace" fontSize="9" letterSpacing="1" fill="currentColor" opacity="0.55">DESTINATION</text>
              </>
            )}
          </g>

          {/* Distance label on the route midpoint */}
          <g transform={`translate(${cx}, ${cy})`}>
            <rect x="-32" y="-11" width="64" height="22" fill="var(--bg)" stroke="var(--accent)" strokeWidth="1.5"/>
            <text x="0" y="4" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="700" letterSpacing="1" fill="var(--accent)" textAnchor="middle">{distance}</text>
          </g>
        </svg>
      </div>
    </div>
  );
}
function VietnamMap({ activeId, onPickPin }) {
  // Hand-traced simplified Vietnam outline on a 600×900 viewbox.
  // Real coastline, real country shape — kept blocky for the brutalist feel.
  const VIETNAM_PATH = `
    M 318 78
    L 358 70 L 398 72 L 432 86 L 460 104 L 478 120
    L 488 132 L 478 142 L 460 138 L 440 140 L 432 152
    L 444 168 L 466 178 L 488 192 L 502 212 L 498 232
    L 482 244 L 462 244 L 444 250 L 436 268 L 432 288
    L 422 308 L 410 326 L 396 342 L 384 360 L 376 380
    L 368 402 L 360 426 L 354 452 L 350 478 L 348 506
    L 344 534 L 336 558 L 322 578 L 304 596 L 294 618
    L 296 640 L 304 660 L 308 682 L 304 702 L 292 722
    L 282 744 L 268 762 L 246 776 L 220 782 L 196 776
    L 174 760 L 160 740 L 156 718 L 162 696 L 178 678
    L 196 666 L 218 660 L 232 650 L 238 632 L 232 614
    L 218 600 L 200 590 L 184 572 L 178 550 L 184 528
    L 198 510 L 210 490 L 218 466 L 220 442 L 216 418
    L 208 396 L 204 374 L 210 352 L 222 332 L 238 314
    L 254 296 L 268 276 L 276 254 L 278 230 L 272 210
    L 260 192 L 248 174 L 240 154 L 246 134 L 260 118
    L 280 102 L 300 90 Z
  `;

  return (
    <svg viewBox="0 0 600 900" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.16"/>
        </pattern>
        <pattern id="sea" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="0.5" opacity="0.10"/>
        </pattern>
      </defs>

      {/* Sea / background */}
      <rect width="600" height="900" fill="url(#sea)" />
      <rect width="600" height="900" fill="url(#grid)" />

      {/* Compass + scale strip — top-right */}
      <g transform="translate(520, 60)" fill="currentColor" opacity="0.55">
        <line x1="0" y1="-22" x2="0" y2="22" stroke="currentColor" strokeWidth="1" />
        <polygon points="0,-22 -4,-12 4,-12" />
        <text x="0" y="-28" fontFamily="JetBrains Mono, monospace" fontSize="9" textAnchor="middle" letterSpacing="1">N</text>
      </g>

      {/* Bordering countries — labels only, abstract */}
      <text x="92" y="200" fontFamily="JetBrains Mono, monospace" fontSize="9" letterSpacing="2" opacity="0.45" fill="currentColor">LAOS</text>
      <text x="68" y="540" fontFamily="JetBrains Mono, monospace" fontSize="9" letterSpacing="2" opacity="0.45" fill="currentColor">CAMBODIA</text>
      <text x="510" y="540" fontFamily="JetBrains Mono, monospace" fontSize="9" letterSpacing="2" opacity="0.5" fill="currentColor" textAnchor="end">EAST SEA</text>
      <text x="500" y="156" fontFamily="JetBrains Mono, monospace" fontSize="9" letterSpacing="2" opacity="0.5" fill="currentColor" textAnchor="end">GULF OF TONKIN</text>
      <text x="370" y="76" fontFamily="JetBrains Mono, monospace" fontSize="9" letterSpacing="2" opacity="0.45" fill="currentColor">CHINA</text>

      {/* Country fill */}
      <path
        d={VIETNAM_PATH}
        fill="var(--bg-2)"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="miter"
      />

      {/* Hainan island sketch (east, for orientation) */}
      <ellipse cx="540" cy="222" rx="22" ry="14" fill="var(--bg-2)" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      <text x="540" y="226" fontFamily="JetBrains Mono, monospace" fontSize="7" fill="currentColor" opacity="0.55" textAnchor="middle" letterSpacing="1">HAINAN</text>

      {/* Halong bay islands — small dots east of Hanoi */}
      <g fill="currentColor" opacity="0.55">
        <circle cx="488" cy="200" r="2" />
        <circle cx="498" cy="212" r="1.5" />
        <circle cx="506" cy="198" r="1.5" />
        <circle cx="514" cy="208" r="2" />
        <circle cx="520" cy="220" r="1.2" />
      </g>

      {/* Route line — south to north, dashed terracotta */}
      <path
        d="M 220 770 Q 240 720 250 680 Q 270 600 290 520 Q 310 440 330 360 Q 350 290 380 240 L 460 220"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeDasharray="6 4"
        strokeLinecap="square"
      />

      {/* Pins — coordinates updated to sit on the real country */}
      {D.mapPins.map((p, i) => {
        const isActive = activeId === p.id;
        const r = isActive ? 13 : 9;
        const dir = p.labelDir || "right";
        // Estimate label width from character count — close enough for layout.
        const labelW = Math.max(70, p.label.length * 8 + 20);
        const subW = Math.max(80, p.sub.length * 5 + 16);
        const boxW = Math.max(labelW, subW);
        const lx = dir === "left" ? -(r + 6) - boxW : r + 6;
        const tx = dir === "left" ? -(r + 12) : r + 12;
        const anchor = dir === "left" ? "end" : "start";
        return (
          <g key={p.id} transform={`translate(${p.x}, ${p.y})`} onClick={() => onPickPin?.(p.id)} style={{ cursor: "pointer" }}>
            <circle r={r + 10} fill="var(--accent)" opacity={isActive ? 0.20 : 0} />
            <rect x={-r} y={-r} width={r*2} height={r*2} fill="var(--accent)" />
            <text x={0} y={4} fill="#fff" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="700" textAnchor="middle">
              {i+1}
            </text>
            <g>
              <rect x={lx} y={-12} width={boxW} height={28} fill="var(--bg)" opacity="0.92" />
              <text x={tx} y={2} fill="currentColor" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="700" fontSize="14" textAnchor={anchor}>
                {p.label}
              </text>
              <text x={tx} y={14} fill="currentColor" opacity="0.55" fontFamily="JetBrains Mono, monospace" fontSize="9" letterSpacing="0.6" textAnchor={anchor}>
                {p.sub.toUpperCase()}
              </text>
            </g>
          </g>
        );
      })}

      {/* Country name */}
      <text x="306" y="430" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="800" fontSize="28" letterSpacing="2" fill="currentColor" opacity="0.18" textAnchor="middle">VIỆT NAM</text>
    </svg>
  );
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
          <VietnamMap />
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
          HCMC sorted. Hanoi sorted for the first three nights. Final Hanoi stay locks in once the cruise dates settle.
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

/* ===== MARQUEE ===================================== */
function Marquee() {
  const items = ["Saigon", "Mekong Delta", "Cu Chi", "Hanoi", "Hoan Kiem", "Hạ Long Bay", "Ninh Bình", "Temple of Literature", "Pho", "Banh Mi", "Egg Coffee"];
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[0,1].map((k) => items.map((t, i) => (
          <React.Fragment key={k + "-" + i}>
            <span>{t}</span><i>◆</i>
          </React.Fragment>
        )))}
      </div>
    </div>
  );
}

/* ===== APP ========================================= */
function App() {
  const [activeDay, setActiveDay] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [focusPin, setFocusPin] = useState(null);
  const dashRef = useRef(null);

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

  const [showTweaks, setShowTweaks] = useState(false);
  const [themeLock, setThemeLock] = useState("auto"); // auto | day | night

  // Tweaks panel: register listener, post available
  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === "__activate_edit_mode") setShowTweaks(true);
      if (e.data?.type === "__deactivate_edit_mode") setShowTweaks(false);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (themeLock === "day") document.documentElement.setAttribute("data-theme", "day");
    if (themeLock === "night") document.documentElement.setAttribute("data-theme", "night");
  }, [themeLock]);

  return (
    <>
      <Hero onScrollDown={scrollPastHero} />
      <Dashboard />
      <DayBar active={activeDay} onJump={jumpToDay} onJumpSection={jumpToSection} />

      <Itinerary
        onOpenMap={openMap}
        onActiveDayChange={(n) => {
          if (themeLock !== "auto") {
            // user has overridden, still update active day for the bar
          }
          setActiveDay(n);
        }}
      />

      <MapSection onOpenMap={() => { setFocusPin(null); setDrawerOpen(true); }} />
      <Flights />
      <Hotels />
      <Phrases />

      <footer className="foot">
        <div className="label eyebrow">06 — End of File</div>
        <div className="foot-title">See you on<br/>the other side.</div>
        <p style={{ margin: 0, color: "var(--fg-muted)", maxWidth: 460 }}>
          Plans update as things are confirmed. Bookmark this page and check back any time — the countdown's already running.
        </p>
        <div className="foot-row">
          <span>The Doos · Vietnam '26</span>
          <span>Christine · Ashraf · Jason · Chris</span>
        </div>
      </footer>

      <MapDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} focusId={focusPin} />

      {showTweaks && (
        <div style={{
          position: "fixed", right: 14, bottom: 14, zIndex: 200,
          background: "var(--card)", color: "var(--card-fg)",
          border: "1px solid var(--rule)", padding: 16, width: 240,
          boxShadow: "0 20px 50px -20px rgba(0,0,0,0.45)",
          fontFamily: "Manrope, sans-serif",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span className="label">Tweaks</span>
            <button onClick={() => { setShowTweaks(false); window.parent.postMessage({ type: "__edit_mode_dismissed" }, "*"); }} aria-label="Close">
              <Icon.Close s={14}/>
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="label" style={{ color: "var(--fg-muted)" }}>Theme</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
              {["auto", "day", "night"].map((m) => (
                <button key={m}
                  className="btn-ghost"
                  style={{ background: themeLock === m ? "var(--fg)" : "transparent", color: themeLock === m ? "var(--bg)" : "inherit" }}
                  onClick={() => setThemeLock(m)}>
                  {m}
                </button>
              ))}
            </div>
            <span className="label" style={{ color: "var(--fg-muted)", marginTop: 8 }}>Jump</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <button className="btn-ghost" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Top</button>
              <button className="btn-ghost" onClick={() => jumpToDay(7)}>Ha Long ★</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<App />);
