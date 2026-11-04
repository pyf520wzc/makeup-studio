const KEY = 'makeup-studio-privacy-accepted-at';

export function getPrivacyAcceptedAt(): string | null {
  return localStorage.getItem(KEY);
}

export function hasPrivacyConsent(): boolean {
  return Boolean(getPrivacyAcceptedAt());
}

export function acceptPrivacy(): string {
  const at = new Date().toISOString();
  localStorage.setItem(KEY, at);
  return at;
}

export function clearPrivacyConsent(): void {
  localStorage.removeItem(KEY);
}
