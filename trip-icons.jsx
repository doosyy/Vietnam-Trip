// Inline SVG icons — kept minimal, brutalist stroke style
const Icon = {
  Sun: ({ s = 24 }) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" />
    </svg>,

  Cloud: ({ s = 24 }) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
      <path d="M7 18h11a4 4 0 0 0 0-8 6 6 0 0 0-11.5-2A4 4 0 0 0 7 18Z" />
    </svg>,

  CloudSun: ({ s = 24 }) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v2M14 8h2M2 8h2M3.5 3.5l1.4 1.4M11.1 4.9l1.4-1.4" />
      <path d="M10 19h8a3 3 0 0 0 0-6 4.5 4.5 0 0 0-7.7-1.6A3 3 0 0 0 10 19Z" />
    </svg>,

  Storm: ({ s = 24 }) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
      <path d="M7 16h11a4 4 0 0 0 0-8 6 6 0 0 0-11.5-2A4 4 0 0 0 7 16Z" />
      <path d="M11 17l-2 4h3l-1 3" />
    </svg>,

  Plus: ({ s = 18 }) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <path d="M12 5v14M5 12h14" />
    </svg>,

  Close: ({ s = 18 }) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>,

  Swap: ({ s = 18 }) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" data-comment-anchor="ed817456e1-svg-38-5">
      <path d="M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4" />
    </svg>,

  Map: ({ s = 18 }) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
      <path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z" />
      <path d="M9 3v16M15 5v16" />
    </svg>,

  Arrow: ({ s = 24 }) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>,

  Plane: ({ s = 18 }) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1L15 22v-1.5L13 19v-5.5L21 16Z" />
    </svg>

};

window.Icon = Icon;

function weatherIcon(name, size = 44) {
  switch (name) {
    case "storm":return <Icon.Storm s={size} />;
    case "cloud":return <Icon.Cloud s={size} />;
    case "cloud-sun":return <Icon.CloudSun s={size} />;
    case "sun":
    default:return <Icon.Sun s={size} />;
  }
}
window.weatherIcon = weatherIcon;

// WMO weather code -> { icon, cond }. Shared by the dashboard and the trip forecast.
function wmoWeather(code) {
  if (code === 0) return { icon: "sun", cond: "Clear" };
  if (code === 1) return { icon: "sun", cond: "Mainly clear" };
  if (code === 2) return { icon: "cloud-sun", cond: "Partly cloudy" };
  if (code === 3) return { icon: "cloud", cond: "Overcast" };
  if (code >= 45 && code <= 48) return { icon: "cloud", cond: "Fog" };
  if (code >= 51 && code <= 57) return { icon: "cloud", cond: "Drizzle" };
  if (code >= 61 && code <= 67) return { icon: "storm", cond: "Rain" };
  if (code >= 80 && code <= 82) return { icon: "storm", cond: "Showers" };
  if (code >= 95) return { icon: "storm", cond: "Thunderstorm" };
  return { icon: "cloud", cond: "Cloudy" };
}
window.wmoWeather = wmoWeather;