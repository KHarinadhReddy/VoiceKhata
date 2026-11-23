# 🔊 Voice Khata

**Voice-first udhara (credit) ledger for kirana stores** — built for the Gnani Voice Hackathon.

## Problem
Kirana stores run customer credit (udhara) in paper khata books. Nobody types during rush hour.
Shop talk is fast, code-mixed, full of numbers/names, over street noise.

## Solution
A shopkeeper speaks: *"Ramesh ka 340 udhara, kal 200 diya tha"* → app records credit/payment → tells who owes what.

## Features
- 🎤 Push-to-talk voice input (Android/browser)
- 🧠 Multilingual number parsing: "teen sau chaalis", "340", "three forty"
- 📒 Ledger logic: credit/payment/correction, relative dates, disambiguation
- 🔊 Spoken answers via TTS
- 🔒 Encrypted at rest, local-first DB
- 🌍 12-language voice support
- ✅ Judge-visible status pipeline: Heard → Parsed → ✓ Saved

## 🧪 Pre-Scripted Demo Flow (for online round)

1. "Ramesh ka 340 udhara" → Heard → Parsed → Confirm → ✓ Saved
2. "Suresh ne 200 diya" → Heard → Parsed → Confirm → ✓ Saved
3. "Ramesh ka 500 udhara" → Heard → Parsed → Confirm → ✓ Saved
4. "Nahi, 430" → Correction → updates last Ramesh entry → ✓ Corrected
5. "Ramesh ka total?" → Query → spoken answer
6. "Aaj kitna udhara gaya?" → Query → spoken answer

Use **Reset** button (↻) between runs.

## Tech Stack
- React + TypeScript + Vite + Tailwind
- Capacitor (Android + Web)
- @capacitor-community/{sqlite, speech-recognition, text-to-speech, local-notifications}
- Zustand

## Build
```bash
npm run build
npx cap sync
npx cap open android
```

## Run
```bash
npm run dev
```
