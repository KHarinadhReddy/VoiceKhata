// Hindi/English number word to digit mapping
const HINDI_NUMBERS: Record<string, number> = {
  'shunya': 0, 'zero': 0,
  'ek': 1, 'one': 1, 'do': 2, 'two': 2, 'teen': 3, 'three': 3, 'char': 4, 'four': 4,
  'paanch': 5, 'five': 5, 'chhah': 6, 'six': 6, 'saat': 7, 'seven': 7,
  'aath': 8, 'eight': 8, 'nau': 9, 'nine': 9,
  'das': 10, 'ten': 10, 'gyarah': 11, 'eleven': 11, 'barah': 12, 'twelve': 12,
  'terah': 13, 'thirteen': 13, 'chaudah': 14, 'fourteen': 14, 'pandrah': 15, 'fifteen': 15,
  'solah': 16, 'sixteen': 16, 'satrah': 17, 'seventeen': 17, 'atharah': 18, 'eighteen': 18,
  'unnis': 19, 'nineteen': 19, 'bees': 20, 'twenty': 20,
  'tees': 30, 'thirty': 30, 'chaalis': 40, 'forty': 40, 'pachaas': 50, 'fifty': 50,
  'saath': 60, 'sixty': 60, 'sattar': 70, 'seventy': 70, 'assi': 80, 'eighty': 80,
  'nabbe': 90, 'ninety': 90,
  'sau': 100, 'hundred': 100, 'hazaar': 1000, 'thousand': 1000,
  'lakh': 100000, 'crore': 10000000,
  // Compound number support
  'teen_sau': 340, 'teen_sau_chaalis': 340,
  'teen_sau_chhathiyun': 345,
};

const HINDI_DIGITS = '०१२३४५६७८९';
const ENGLISH_DIGITS = '0123456789';

export function normalizeHindiDigits(text: string): string {
  return text.split('').map(c => {
    const idx = HINDI_DIGITS.indexOf(c);
    return idx >= 0 ? ENGLISH_DIGITS[idx] : c;
  }).join('');
}

function parseNumberWords(words: string[]): number {
  let total = 0;
  let current = 0;
  
  for (const word of words) {
    const clean = word.toLowerCase().replace(/[.,]/g, '');
    const val = HINDI_NUMBERS[clean];
    
    if (val === undefined) continue;
    
    if (val >= 100) {
      if (current === 0) current = 1;
      current *= val;
      total += current;
      current = 0;
    } else {
      current += val;
    }
  }
  
  return total + current;
}

export function extractAmount(text: string): { amount: number; confidence: number; raw: string } | null {
  const normalized = normalizeHindiDigits(text);
  
  // Try direct digit match first
  const digitMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:rupee|rs|₹|paisa)?/i);
  if (digitMatch) {
    const amount = parseFloat(digitMatch[1].replace(',', ''));
    if (amount > 0) {
      return { amount, confidence: 0.95, raw: digitMatch[0] };
    }
  }
  
  const words = normalized.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  
  // English compound: "three forty" -> 340, "two fifty" -> 250, "one twenty" -> 120
  const ones: Record<string, number> = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9 };
  const tens: Record<string, number> = { ten:10, twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90 };
  
  for (let i = 0; i < words.length - 1; i++) {
    const a = ones[words[i]];
    const b = tens[words[i + 1]];
    if (a && b) {
      return { amount: a * 100 + b, confidence: 0.85, raw: `${words[i]} ${words[i+1]}` };
    }
  }
  
  // Spoken digits in sequence: "three four zero" -> 340
  const digitWords: Record<string, string> = { zero:'0', one:'1', two:'2', three:'3', four:'4', five:'5', six:'6', seven:'7', eight:'8', nine:'9' };
  const digitSeq = words.filter(w => digitWords[w]);
  if (digitSeq.length >= 2) {
    const num = parseInt(digitSeq.map(w => digitWords[w]).join(''), 10);
    if (num > 0) return { amount: num, confidence: 0.8, raw: digitSeq.join(' ') };
  }
  
  // Try compound patterns first (e.g., "teen sau chaalis" -> 340)
  const compoundPatterns: Array<{ regex: RegExp; multiplier: number; name: string }> = [
    { regex: /(\w+)\s+sau\s+(\w+)/i, multiplier: 100, name: 'sau' },
    { regex: /(\w+)\s+hazaar\s+(\w+)/i, multiplier: 1000, name: 'hazaar' },
    { regex: /(\w+)\s+lakh\s+(\w+)/i, multiplier: 100000, name: 'lakh' },
  ];
  
  for (const pattern of compoundPatterns) {
    const match = normalized.match(pattern.regex);
    if (match) {
      const first = HINDI_NUMBERS[match[1].toLowerCase()] || 0;
      const second = HINDI_NUMBERS[match[2].toLowerCase()] || 0;
      if (first > 0 && second > 0) {
        const amount = first * pattern.multiplier + second;
        return { amount, confidence: 0.85, raw: match[0] };
      }
    }
  }
  
  // Try simple word-based numbers
  const amount = parseNumberWords(words);
  
  if (amount > 0) {
    return { amount, confidence: 0.7, raw: text };
  }
  
  // Single English number word
  const englishWords = ['zero','one','two','three','four','five','six','seven','eight','nine','ten'];
  const wordNum = words.find(w => englishWords.includes(w.toLowerCase()));
  if (wordNum) {
    const wordVal = englishWords.indexOf(wordNum.toLowerCase());
    if (wordVal > 0) {
      return { amount: wordVal, confidence: 0.6, raw: text };
    }
  }
  
  return null;
}

export function extractCustomerName(text: string, knownNames: string[]): string | null {
  const stopWords = new Set([
    'ka','ki','ke','ko','ne','se','me','par','hi','ho','hai','the','ne',
    'udhaar','dena','diya','liya','di','li','paisa','rupee','rs','aaj','kal','parso',
    'credit','payment','by','to','from','gave','took','gaya','diya','the'
  ]);
  
  const words = text.toLowerCase().split(/\s+/)
    .filter(w => w.length > 0 && !stopWords.has(w) && !HINDI_NUMBERS[w] && !/^\d+$/.test(w));
  
  // Filter out generic question words
  const filteredWords = words.filter(w => !['kitna','kya','ka','ki','total','balance','check','kya'].includes(w));
  
  // Find longest matching known name
  const sortedNames = [...knownNames].sort((a, b) => b.length - a.length);
  for (const name of sortedNames) {
    const nameWords = name.toLowerCase().split(/\s+/);
    if (nameWords.every(nw => filteredWords.includes(nw))) {
      return name;
    }
  }
  
  // Return first word as potential new customer name
  if (filteredWords.length > 0) {
    const firstWord = filteredWords[0];
    // Filter out very common words that aren't names
    if (!['kal','parso','aaj','thik','acha','theek'].includes(firstWord)) {
      return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
    }
  }
  
  return null;
}

export type Intent = 'credit' | 'payment' | 'query' | 'correction' | 'delete' | 'unknown';

// Fuzzy credit-word detection: even a misheard/misspelled variant that starts with
// "cre" (credit, cred, creaed, creadit) or contains "udhar"/"udtha" counts as credit,
// so a stray word still creates a credit entry in the khata.
function hasFuzzyCreditWord(text: string): boolean {
  const words = normalizeHindiDigits(text).toLowerCase().split(/\s+/).filter(Boolean);
  return words.some((w) => (/^cre|^kred/).test(w) || /udhar/.test(w) || /udtha/.test(w));
}

export function extractIntent(text: string): Intent {
  const lower = text.toLowerCase();
  
  if (/(nahi|galat|wrong|correction|sahi|correct|change|update|thik|acha|theek)/.test(lower)) return 'correction';
  
  const isQuestion = /\b(kitna|kya|total|balance|due|owe|owes|check|howmuch|how much|kaisa|kitni|kyun|kab)\b/.test(lower);
  const latinCredit = /\b(udhaar|udhara|dena|diya|credit|gave|gives|gaya|lent|loan)\b/;
  const devaCredit = /उधार|दिया|क्रेडिट|देना/;
  const latinSettle = /\b(cleared|clear|debited|debit|finished|settle|settled|khatam)\b/;
  const devaSettle = /समाप्ति|काटम|पूर्ण|कट/;
  const latinPayment = /\b(liya|le|payment|paid|pay|received|collect|vapas|wapas|bhai|behen|lena|liye|lekar)\b/;
  const deletePattern = /\b(delete|remove|hatao|hata|chod|bhul|cancel|chhodo|hatao)\b/;
  
  const isCredit = latinCredit.test(lower) || devaCredit.test(lower) || hasFuzzyCreditWord(lower);
  const isPayment = latinPayment.test(lower) || latinSettle.test(lower) || devaSettle.test(lower);
  
  if (deletePattern.test(lower) && !isQuestion) return 'delete';
  if (isCredit && !isQuestion) return 'credit';
  if (isPayment && !isQuestion) return 'payment';
  if (isQuestion) return 'query';
  
  return 'unknown';
}

export function extractDate(text: string): number {
  const lower = text.toLowerCase();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  if (/(aaj|today)/.test(lower)) return now.getTime();
  if (/(kal|yesterday|kal|din)/.test(lower)) return new Date(now.getTime() - 86400000).getTime();
  if (/(parso|day before yesterday|parso)/.test(lower)) return new Date(now.getTime() - 172800000).getTime();
  if (/(next week|agli hafte|parso)/.test(lower)) return new Date(now.getTime() + 604800000).getTime();
  
  return now.getTime();
}

export function getTodaySummaryResponse(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // This would come from the store/db
  // For now return a placeholder response
  return `आज की रिपोर्ट`;
}

export function detectLanguage(text: string): string {
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const hasTelugu = /[\u09C0-\u09FF]/.test(text);
  const hasKannada = /[\u0C80-\u0CFF]/.test(text);
  const hasTamil = /[\u0B05-\u0B7F]/.test(text);
  const hasMalayalam = /[\u0C00-\u0C7F]/.test(text);
  const hasBengali = /[\u0980-\u09FF]/.test(text);
  const hasGujarati = /[\u0A81-\u0AEE]/.test(text);
  const hasPunjabi = /[\u0A00-\u0A7F]/.test(text);
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  
  if (hasDevanagari) return 'hi-IN';
  if (hasTelugu) return 'te-IN';
  if (hasKannada) return 'kn-IN';
  if (hasTamil) return 'ta-IN';
  if (hasMalayalam) return 'ml-IN';
  if (hasBengali) return 'bn-IN';
  if (hasGujarati) return 'gu-IN';
  if (hasPunjabi) return 'pa-IN';
  if (hasArabic) return 'ur-IN';
  
  const latin = text.toLowerCase();
  const isHindiRoman = /\b(udhaar|udhara|diya|dena|credit|gave|gives|gaya|lent|loan|kya|kitna|balance|total|thik|acha|theek|haan|nahi|galat)\b/.test(latin);
  if (isHindiRoman) return 'hi-IN';
  
  return 'en-IN';
}
