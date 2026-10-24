/*
 * Loqelo site settings. Edit these values; no build step is needed.
 * Nothing secret belongs in this file: it is public. The Brevo API key lives in api/config.php.
 */
window.LOQELO_CONFIG = {
  // Google Analytics 4 Measurement ID (looks like "G-XXXXXXXXXX"). Leave empty to disable analytics.
  ga4Id: "",

  // Cloudflare Turnstile site key (optional extra spam protection). Leave empty to disable.
  turnstileSiteKey: "",

  // Where the waitlist form sends data. Keep the default when the site runs on PHP hosting.
  endpoint: "api/subscribe.php",

  // true = forms are simulated (for design previews only). Must be false on the live site.
  previewMode: true,

  // Languages offered in the language picker. Each needs a file in /i18n (e.g. i18n/de.json).
  languages: ["en", "pl", "nl"],
  defaultLanguage: "en",

  // Launch month shown in the timeline (year, month 1-12).
  launch: { year: 2027, month: 2 }
};
