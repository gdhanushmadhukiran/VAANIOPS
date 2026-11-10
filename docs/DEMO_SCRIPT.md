# VaaniOps — Live Demonstration & Submission Script

**Target Submission Deadline:** November 10, 2026, 11:59 PM IST  
**Product:** VaaniOps — Voice Operating System for India's Small Businesses  
**Tagline:** *Speak Naturally. Manage Intelligently.*  
**Primary Integration:** Gnani AI Prisma v2.5 (STT) & Timbre v2.5 (TTS)

---

## 1. Demo Introduction (0:00 – 0:45)
**Presenter:**
> "Good morning / evening everyone. Today, over 63 million micro and small businesses across India—automobile mechanics, electricians, plumbers, and local repair shops—manage their entire business verbally. They don't type lengthy forms on keyboards; they speak in their mother tongue with natural mixed vocabulary.
>
> Introducing **VaaniOps**, a Telugu-first Voice Operating System powered by genuine Gnani AI Prisma v2.5 and Timbre v2.5 models. Let's see how a mechanic creates a complete repair order in seconds without typing."

---

## 2. Step 1: Navigating the Business Dashboard (0:45 – 1:15)
1. Open the VaaniOps application in browser (`http://localhost:5173`).
2. Point out the **Dark Navy and Electric Violet** SaaS layout.
3. Show the **Business Overview Metrics**:
   - Total Orders
   - Pending / In Progress Orders
   - Completed Orders
   - Today's Orders
4. Point out the **Spoken Telugu Scenarios** cards on the dashboard, highlighting pre-crafted natural mixed-speech examples for:
   - Motorcycle Mechanics (`రవి గారు బైక్ రిపేర్ కోసం ఇచ్చారు...`)
   - Electricians (`సురేష్ గారి ఇంట్లో ఫ్యాన్ వైరింగ్...`)
   - Plumbers (`వెంకటేష్ గారు పైప్ లీకేజీ రిపేర్...`)

---

## 3. Step 2: Live Voice Recording in Telugu (1:15 – 2:30)
1. Click **"Record Voice Work Order"** or navigate to **Voice Workspace**.
2. Notice the language toggle set to **తెలుగు (te-IN)**.
3. Click the large purple **Microphone button**.
4. The pulse animation begins, and the real-time timer starts counting up with a 30-second cap.
5. Speak clearly into the microphone:
   > *"Ravi garu bike repair kosam icharu. Brake pads change cheyyali. Repu evening delivery."*
6. Click **Stop Recording**.
7. **What happens under the hood:**
   - The browser's Web Audio API decodes the audio and resamples it to **16 kHz Mono 16-bit linear PCM WAV**.
   - The audio preview player appears, allowing the presenter to replay the converted WAV.
   - The WAV is uploaded via HTTP multipart form-data to `/api/transcribe`.
   - Gnani Prisma v2.5 processes the speech and returns the genuine transcript.

---

## 4. Step 3: Information Extraction & Verification (2:30 – 3:30)
1. Look at the **Prisma Transcript Panel**:
   - Displays the recognized speech: `"Ravi garu bike repair kosam icharu. Brake pads change cheyyali. Repu evening delivery."`
   - Shows badge: `prisma-v2.5` and Request ID.
2. Look at the **Extracted Work Order Form**:
   - **Customer Name:** `Ravi` (automatically identified from honorific `garu`).
   - **Vehicle / Asset:** `Bike`.
   - **Service Type:** `Brake pad replacement`.
   - **Description:** `Replace brake pads`.
   - **Promised Delivery Date:** `Tomorrow`.
   - **Promised Delivery Time:** `evening`.
   - **Status:** `pending`.
3. Demonstrate that the user has complete control:
   - Add an estimated cost: type `850` into the Estimated Cost field.
   - Show how missing fields are clearly flagged and easily editable without manual re-entry of the whole order.

---

## 5. Step 4: Confirmation & Spoken Telugu Feedback (3:30 – 4:30)
1. Click **"Confirm & Save Work Order"**.
2. The order is committed to SQLite and assigned a unique order number: e.g. `VO-20261109-8142`.
3. Click **"Play Telugu Confirmation"** (or observe automatic spoken feedback).
4. Gnani Timbre v2.5 synthesizes the confirmation in natural Telugu using the `Kaveri` voice:
   > *"రవి గారి బ్రేక్ ప్యాడ్స్ రీప్లేస్‌మెంట్ సర్వీస్ ఆర్డర్ క్రియేట్ అయ్యింది. డెలివరీ రేపు."*
5. The audio plays directly through the speakers.
**Presenter:**
> "Notice how the mechanic never had to read a confirmation text on a small screen. VaaniOps speaks back to the business owner and customer in natural Telugu using Gnani Timbre v2.5."

---

## 6. Step 5: Orders Manager & Status Tracking (4:30 – 5:15)
1. Navigate to **All Orders**.
2. Search for `Ravi` or filter by `Pending`.
3. Click the status dropdown on the order row and update status from `Pending` to `In Progress`.
4. Click **Details** to open the Order Details modal:
   - Displays full timestamp, asset information, and the original raw voice transcript.
   - Click **Play Spoken Summary** to hear an updated audio status recap anytime.

---

## 7. Step 6: Settings & API Diagnostics (5:15 – 5:45)
1. Navigate to **Settings & APIs**.
2. Point out the **Live System Diagnostics**:
   - FastAPI Backend status: `Online`
   - Prisma v2.5 Endpoint: `api.vachana.ai/stt/v3`
   - Timbre v2.5 Endpoint: `api.vachana.ai/api/v1/tts/inference`
   - Masked API Key: `gn_...***` (safe, never leaks secrets)
3. Demonstrate the **Voice Catalog Selector** (`Kaveri`, `Ananya`, `Chaitanya`, `Venu`) and the live TTS test bench.

---

## 8. Closing (5:45 – 6:00)
**Presenter:**
> "VaaniOps bridges cutting-edge Indic voice AI with real-world small business workflows. Speak naturally in Telugu, manage intelligently, and empower Bharat's local enterprise."

