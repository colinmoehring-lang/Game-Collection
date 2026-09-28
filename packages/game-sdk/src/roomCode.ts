const ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY'; // 21 Zeichen, ohne 0/O, 1/I, B/8, S/5

export function generateRoomCode(length: number = 5): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * ALPHABET.length);
    result += ALPHABET[randomIndex];
  }
  return result;
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== 5) return false;
  return code.split('').every(ch => ALPHABET.includes(ch.toUpperCase()));
}
