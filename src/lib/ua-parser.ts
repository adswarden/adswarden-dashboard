/**
 * Lightweight, deterministic user-agent parsing for dashboard telemetry.
 * Returns display labels with Unknown when not recognized.
 */
export function parseUserAgent(raw: string | null | undefined): { browser: string; os: string } {
  if (!raw || !raw.trim()) {
    return { browser: 'Unknown', os: 'Unknown' };
  }
  const ua = raw.trim();

  let browser = 'Unknown';
  if (/Edg(?:e|A|iOS)?\//.test(ua) || /\bEdg\//.test(ua)) {
    browser = 'Edge';
  } else if (/OPR\/|Opera\//.test(ua)) {
    browser = 'Opera';
  } else if (/Brave\//i.test(ua)) {
    browser = 'Brave';
  } else if (/Vivaldi\//.test(ua)) {
    browser = 'Vivaldi';
  } else if (/Chrome\//.test(ua) && !/Chromium\//.test(ua)) {
    browser = 'Chrome';
  } else if (/Firefox\//.test(ua)) {
    browser = 'Firefox';
  } else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) {
    browser = 'Safari';
  } else if (/MSIE |Trident\//.test(ua)) {
    browser = 'Internet Explorer';
  }

  let os = 'Unknown';
  if (/Windows NT 10/.test(ua)) {
    os = 'Windows';
  } else if (/Windows NT 6\.3|Windows NT 6\.2/.test(ua)) {
    os = 'Windows';
  } else if (/Windows NT 6\.1/.test(ua)) {
    os = 'Windows 7';
  } else if (/Windows NT 6\.0/.test(ua)) {
    os = 'Windows Vista';
  } else if (/Windows NT 5/.test(ua)) {
    os = 'Windows';
  } else if (/Windows/.test(ua)) {
    os = 'Windows';
  } else if (/Mac OS X|macOS/i.test(ua)) {
    os = 'macOS';
  } else if (/Android/.test(ua)) {
    os = 'Android';
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    os = 'iOS';
  } else if (/CrOS/.test(ua)) {
    os = 'Chrome OS';
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
  }

  return { browser, os };
}
