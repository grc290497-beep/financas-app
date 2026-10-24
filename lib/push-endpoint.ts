// The server POSTs to a subscription's endpoint, so only the browsers' push
// services are accepted: anything else would let a user aim our server at any
// URL (SSRF).
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge on Android, Samsung Internet
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^web\.push\.apple\.com$/, // Safari and installed iPhone apps
  /\.notify\.windows\.com$/, // Edge on Windows
];

export function isPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.port &&
      !url.username &&
      PUSH_HOSTS.some((host) => host.test(url.hostname))
    );
  } catch {
    return false;
  }
}
