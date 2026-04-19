# 🛡️ ForgeGuard: AI-Powered Document Forensic Suite

**ForgeGuard** is a state-of-the-art forensic document verification system designed for investigators, legal professionals, and financial institutions. It leverages multiple cryptographic and computer vision signals to detect forgeries, tampering, and hidden data in digital documents and videos.

---

## 🚀 Key Features

### 🔍 Multi-Signal Forgery Detection
ForgeGuard doesn't rely on a single check. It combines multiple forensic signals for a high-confidence verdict:
*   **Error Level Analysis (ELA)**: Detects inconsistent compression levels indicating digital manipulation.
*   **Copy-Move Detection**: Identifies cloned or duplicated regions within a document using ORB feature matching.
*   **Noise Map Consistency**: Analyzes Laplacian residuals to find "composited" elements.
*   **Metadata Analysis**: Checks for suspicious editing software (Photoshop, GIMP) and missing EXIF data.
*   **OCR Anomaly Detection**: Uses Tesseract to find font inconsistencies and low-confidence text regions.

### 📽️ Video Forensic Scanning
The first of its kind to support video forensics in a lightweight web suite.
*   Extracts keyframes from `.mp4`, `.avi`, and `.mov` files.
*   Runs the full forensic suite on every frame to detect frame-level tampering.

### 🕵️ Steganography "Ghost Bit" Analysis
Detects hidden communication inside images by visualizing the **Least Significant Bit (LSB)** plane. If patterns emerge in the "Ghost" map, hidden data is present.

### ⛓️ Blockchain-Backed Trust Ledger
Every scanned document is notarized on a secure, tamper-proof SQLite ledger (simulating a blockchain). 
*   **Integrity Check**: Re-upload any document to verify if even a single pixel has changed since its original notarization.

### 🎫 Tamper-Evident QR Certificates
Downloadable forensic reports come with a dynamic QR code. Scanning the QR code leads back to the official verification page, proving the report itself hasn't been forged.

### 🤖 Explainable AI (XAI) Assistant
Integrated with **Google Gemini**, ForgeGuard provides an AI forensic expert you can chat with to understand complex reports or ask specific questions about the findings.

---

## 🛠️ Technology Stack

*   **Frontend**: Next.js 14, React, Tailwind-inspired Vanilla CSS, Three.js (LiquidEther), Particles.js.
*   **Backend**: FastAPI (Python), OpenCV, NumPy, Pillow, PyMuPDF, Tesseract OCR.
*   **Database**: SQLite3 (Notarization Ledger).
*   **AI**: Google Gemini Pro (Explainable AI).

---

## 📦 Installation & Setup

### Prerequisites
*   Python 3.10+
*   Node.js 18+
*   Tesseract OCR (Installed on system)

### Backend Setup
1. Navigate to the `backend` directory.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the server:
   ```bash
   python main.py
   ```

### Frontend Setup
1. Navigate to the `frontend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

---

## 🛡️ Digital Chain of Custody
ForgeGuard ensures a complete digital chain of custody by logging hashes, timestamps, and forensic verdicts, making it a powerful tool for court-admissible evidence preparation.

---
**ForgeGuard** — *The truth is in the pixels.*
