function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createProofToken() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Secure proof token generation is unavailable in this environment.');
  }

  const bytes = new Uint8Array(24);
  cryptoApi.getRandomValues(bytes);
  return bytesToHex(bytes);
}
