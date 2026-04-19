"use client";

/**
 * DocVerify — AI-powered Document Forgery Detection
 * Main page component
 *
 * Flow:
 *   idle  ──►  file selected  ──►  analyzing  ──►  results
 *                                                      │
 *                                               "Analyze another" resets to idle
 */

import React, { useCallback, useRef, useState } from "react";
import LiquidEther from "../components/LiquidEther";
import Particles from "../components/Particles";

// ─── Types ───────────────────────────────────────────────────────────────────

type Verdict = "FORGED" | "SUSPICIOUS" | "GENUINE";

interface FlaggedRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  reason: string;
}

interface AnalysisResult {
  verdict: Verdict;
  confidence: number;
  score_breakdown: {
    ela_score:        number;
    block_ela_score:  number;
    noise_score:      number;
    copy_move_score:  number;
    meta_score:       number;
    font_score:       number;
    ocr_score:        number;
  };
  reasons: string[];
  heatmap: string;               // base64 PNG
  flagged_regions: FlaggedRegion[];
  metadata: {
    filename: string;
    file_type: string;
    file_size_kb: number;
    composite_score: number;
    ela_raw:              Record<string, number>;
    block_ela_debug:      Record<string, number>;
    noise_debug:          Record<string, number>;
    ocr_mean_confidence:  number | null;
    ocr_low_conf_ratio:   number | null;
    pdf_fonts:            string[];
    pdf_num_fonts:        number;
  };
  qr_code?: string;
  file_hash?: string;
  stego_map?: string;
  is_video?: boolean;
  num_frames?: number;
}

interface BatchFile {
  file: File;
  status: "pending" | "analyzing" | "completed" | "error";
  result?: AnalysisResult;
  error?: string;
  progress: number;
}

interface VerificationResult {
  status: "VERIFIED" | "NOT_FOUND";
  filename?: string;
  verdict?: string;
  timestamp?: string;
  message?: string;
  hash?: string;
}

type AppState = "idle" | "analyzing" | "results" | "error";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function verdictColor(v: Verdict) {
  if (v === "FORGED") return "#ef4444";
  if (v === "SUSPICIOUS") return "#f59e0b";
  return "#10b981";
}

function verdictDescription(v: Verdict) {
  if (v === "FORGED")
    return "Strong indicators of tampering were found. This document is likely not authentic.";
  if (v === "SUSPICIOUS")
    return "Some anomalies were detected. Manual verification is recommended.";
  return "No significant forgery indicators detected. This document appears authentic.";
}

// ─── Icons (inline SVG, no external deps) ────────────────────────────────────

const IconShield = () => (
  <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
    <path
      d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.35C16.5 21.15 20 16.25 20 11V5L12 2z"
      fill="url(#shieldGrad)"
    />
    <defs>
      <linearGradient id="shieldGrad" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#8b5cf6" />
      </linearGradient>
    </defs>
  </svg>
);

const IconUpload = () => (
  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="url(#upGrad)" strokeWidth="1.8">
    <defs>
      <linearGradient id="upGrad" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#8b5cf6" />
      </linearGradient>
    </defs>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12M8 8l4-4 4 4" />
  </svg>
);

const IconFile = () => (
  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#8b5cf6" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
    <polyline strokeLinecap="round" strokeLinejoin="round" points="14 2 14 8 20 8" />
  </svg>
);

const IconX = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconWarn = ({ color }: { color: string }) => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" style={{ flexShrink: 0 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);

const IconScan = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
  </svg>
);

const IconDownload = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m-4-4l4 4 4-4" />
  </svg>
);

const IconRefresh = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.49 9A9 9 0 005.64 5.64L4 10M3.51 15a9 9 0 0014.85 3.36L20 14" />
  </svg>
);

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div style={{ padding: "1rem 0" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
        <div className="skeleton skeleton-badge" />
      </div>
      <div className="skeleton skeleton-line w-60" style={{ margin: "0 auto 1rem" }} />
      <div className="skeleton skeleton-block" style={{ marginBottom: "1rem" }} />
      <div className="scores-grid">
        {[1, 2, 3].map((i) => (
          <div key={i} className="score-card">
            <div className="skeleton skeleton-line w-40" />
            <div className="skeleton skeleton-line w-80" />
            <div className="skeleton" style={{ height: "4px", width: "100%" }} />
          </div>
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton skeleton-line w-full" />
      ))}
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

export default function Home() {
  // State
  const [appState, setAppState] = useState<AppState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [imgNaturalSize, setImgNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [renderedSize, setRenderedSize] = useState<{ w: number; h: number } | null>(null);

  // AI Chat State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: "user" | "ai", text: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // New states
  const [isProfessionalTheme, setIsProfessionalTheme] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  const [activeTab, setActiveTab] = useState<"analyze" | "verify">("analyze");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifResult, setVerifResult] = useState<VerificationResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // ── File selection ───────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    const supported = [
      "image/jpeg", "image/png", "image/tiff", "image/webp",
      "image/bmp", "application/pdf", "video/mp4", "video/x-msvideo", "video/quicktime"
    ];
    if (!supported.includes(file.type) && !file.name.toLowerCase().endsWith(".mp4") && !file.name.toLowerCase().endsWith(".avi") && !file.name.toLowerCase().endsWith(".mov")) {
      setErrorMsg(`Unsupported format. Please use images, PDFs, or videos (MP4, AVI, MOV).`);
      setAppState("error");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg("File is too large. Maximum allowed size is 20 MB.");
      setAppState("error");
      return;
    }

    if (isBatchMode) {
      setBatchFiles(prev => [...prev, { file, status: "pending", progress: 0 }]);
      return;
    }

    setSelectedFile(file);
    setErrorMsg("");
    setAppState("idle");
    setResult(null);

    // Generate object URL for preview
    const objUrl = URL.createObjectURL(file);
    if (file.type.startsWith("image/")) {
      setPreviewUrl(objUrl);
    } else {
      setPreviewUrl(null); // PDF — show icon
    }
    setOriginalImageUrl(objUrl);
  }, [isBatchMode]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        if (isBatchMode) {
          files.forEach(f => handleFile(f));
        } else {
          handleFile(files[0]);
        }
      }
    },
    [handleFile, isBatchMode]
  );

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      if (activeTab === "verify") {
        verifyFile(files[0]);
      } else if (isBatchMode) {
        files.forEach(f => handleFile(f));
      } else {
        handleFile(files[0]);
      }
    }
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setOriginalImageUrl(null);
    setResult(null);
    setAppState("idle");
    setChatMessages([]);
    setChatOpen(false);
    setErrorMsg("");
  };

  // ── Analysis ─────────────────────────────────────────────────────────────

  const analyze = async () => {
    if (!selectedFile) return;

    setAppState("analyzing");
    setResult(null);
    setErrorMsg("");

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch(`${apiUrl}/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = body?.detail || `Server returned ${res.status}`;
        throw new Error(detail);
      }

      const data: AnalysisResult = await res.json();
      if (data.verdict) {
        setResult(data);
        setAppState("results");
        setChatMessages([{role: "ai", text: "I've analyzed the document. You can ask me to explain any part of the findings!"}]);
      } else {
        throw new Error("Invalid analysis result received.");
      }

      // Scroll to results after a brief paint delay
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error. Please try again.";
      setErrorMsg(msg);
      setAppState("error");
    }
  };

  const analyzeBatch = async () => {
    if (batchFiles.length === 0) return;
    setAppState("analyzing");

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const updatedFiles = [...batchFiles];
    
    for (let i = 0; i < updatedFiles.length; i++) {
      if (updatedFiles[i].status === "completed") continue;
      
      updatedFiles[i].status = "analyzing";
      updatedFiles[i].progress = 20;
      setBatchFiles([...updatedFiles]);

      try {
        const formData = new FormData();
        formData.append("file", updatedFiles[i].file);
        
        const res = await fetch(`${apiUrl}/analyze`, { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        
        const data: AnalysisResult = await res.json();
        updatedFiles[i].status = "completed";
        updatedFiles[i].result = data;
        updatedFiles[i].progress = 100;
      } catch (err) {
        updatedFiles[i].status = "error";
        updatedFiles[i].error = "Analysis failed";
        updatedFiles[i].progress = 100;
      }
      setBatchFiles([...updatedFiles]);
    }
    
    setAppState("results");
  };

  const verifyFile = async (file: File) => {
    setIsVerifying(true);
    setVerifResult(null);
    setErrorMsg("");
    setAppState("idle"); // Clear any previous analysis errors

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${apiUrl}/verify`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Verification server error");
      const data: VerificationResult = await res.json();
      setVerifResult(data);
    } catch (err) {
      setErrorMsg("Failed to connect to verification ledger.");
      setAppState("error");
    } finally {
      setIsVerifying(false);
    }
  };

  // ── Download report ──────────────────────────────────────────────────────

  const downloadReport = () => {
    if (!result) return;
    const { verdict, confidence, score_breakdown, reasons, metadata } = result;

    const vColor = verdictColor(verdict);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>ForgeGuard Official Report — ${metadata.filename}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&family=Share+Tech+Mono&display=swap');
  body { font-family: 'Crimson Text', serif; max-width: 850px; margin: 0 auto; padding: 2rem 3rem; color: #111; background: #fff; position: relative; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 8rem; color: rgba(0,0,0,0.03); z-index: -1; pointer-events: none; font-weight: bold; font-family: sans-serif; letter-spacing: 0.1em; }
  .header { border-bottom: 3px double #000; padding-bottom: 1.5rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: flex-end; }
  .header h1 { font-size: 2.2rem; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; }
  .header .seal { width: 60px; height: 60px; border: 2px solid #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; text-align: center; line-height: 1.1; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem; background: #f9fafb; border: 1px solid #e5e7eb; padding: 1.5rem; border-radius: 4px; }
  .meta-grid div { font-size: 0.95rem; }
  .meta-label { font-weight: 600; color: #4b5563; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; display: block; margin-bottom: 0.2rem; }
  .verdict-box { border: 2px solid ${vColor}; background: ${vColor}11; padding: 1.5rem; text-align: center; margin-bottom: 2.5rem; border-radius: 4px; }
  .verdict-box h2 { color: ${vColor}; font-size: 2rem; margin: 0 0 0.5rem 0; letter-spacing: 0.1em; text-transform: uppercase; }
  .verdict-box p { margin: 0; font-size: 1.1rem; font-weight: 600; }
  h3 { font-size: 1.3rem; border-bottom: 1px solid #000; padding-bottom: 0.3rem; margin-top: 2.5rem; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-family: sans-serif; font-size: 0.9rem; }
  td, th { padding: 0.75rem 1rem; border-bottom: 1px solid #e5e7eb; text-align: left; }
  th { background: #f3f4f6; font-weight: 700; color: #374151; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; }
  tr:last-child td { border-bottom: 2px solid #000; }
  .findings { margin-bottom: 2.5rem; }
  .findings li { margin-bottom: 0.75rem; font-size: 1.05rem; line-height: 1.5; padding-left: 0.5rem; }
  .heatmap-img { max-width: 100%; max-height: 350px; border: 1px solid #ccc; display: block; margin: 1.5rem auto; border-radius: 4px; }
  .footer { margin-top: 4rem; padding-top: 1rem; border-top: 1px solid #000; font-size: 0.8rem; color: #666; text-align: center; font-family: 'Share Tech Mono', monospace; }
  .signature-block { display: flex; justify-content: space-between; margin-top: 4rem; margin-bottom: 2rem; }
  .signature-line { border-top: 1px solid #000; width: 45%; text-align: center; padding-top: 0.5rem; font-size: 0.9rem; font-style: italic; }
</style>
</head>
<body>
<div class="watermark">${verdict}</div>
<div class="header">
  <div>
    <h1>ForgeGuard Digital Forensics</h1>
    <div style="font-size: 1.1rem; color: #4b5563; margin-top: 0.5rem; font-style: italic;">Official Document Authenticity Report</div>
  </div>
  <div class="seal">OFFICIAL<br/>SEAL</div>
</div>

<div class="meta-grid">
  <div><span class="meta-label">Target File</span>${metadata.filename}</div>
  <div><span class="meta-label">Date of Analysis</span>${new Date().toLocaleString()}</div>
  <div><span class="meta-label">File Type</span>${metadata.file_type}</div>
  <div><span class="meta-label">File Size</span>${metadata.file_size_kb} KB</div>
  <div><span class="meta-label">Scan Reference ID</span>FG-${Math.random().toString(36).substring(2, 10).toUpperCase()}</div>
  <div><span class="meta-label">Analyst ID</span>AUTO-SYS-01</div>
</div>

<div class="verdict-box">
  <h2>${verdict}</h2>
  <p>Confidence: ${confidence}% &nbsp;|&nbsp; Anomaly Score: ${metadata?.composite_score ?? "N/A"}/100</p>
</div>

<h3>I. Findings Summary</h3>
<ul class="findings">
  ${reasons.map((r) => `<li>${r}</li>`).join("")}
</ul>

<h3>II. Forensic Signals Breakdown</h3>
<table>
  <tr><th>Signal Metric</th><th>Weight</th><th>Anomaly Score (0-100)</th></tr>
  <tr><td>ELA (Error Level Analysis)</td><td>35%</td><td><strong>${score_breakdown.ela_score}</strong></td></tr>
  <tr><td>Block-level Variance</td><td>20%</td><td><strong>${score_breakdown.block_ela_score}</strong></td></tr>
  <tr><td>Laplacian Noise Inconsistency</td><td>15%</td><td><strong>${score_breakdown.noise_score}</strong></td></tr>
  <tr><td>Copy-Move Clone Detection</td><td>10%</td><td><strong>${score_breakdown.copy_move_score}</strong></td></tr>
  <tr><td>Metadata / EXIF Verification</td><td>10%</td><td><strong>${score_breakdown.meta_score}</strong></td></tr>
  <tr><td>PDF Font / Software Trace</td><td>5%</td><td><strong>${score_breakdown.font_score}</strong></td></tr>
  <tr><td>OCR Confidence Degradation</td><td>5%</td><td><strong>${score_breakdown.ocr_score}</strong></td></tr>
</table>

${result.heatmap ? `<h3>III. ELA Heatmap Capture</h3><img src="data:image/png;base64,${result.heatmap}" class="heatmap-img" alt="Heatmap"/>` : ''}

${result.qr_code ? `
  <div style="margin-top: 3rem; border-top: 1px solid #eee; padding-top: 2rem; display: flex; align-items: center; gap: 2rem;">
    <img src="data:image/png;base64,${result.qr_code}" style="width: 120px; height: 120px; border: 1px solid #ccc; padding: 5px;" alt="Verification QR"/>
    <div>
      <h4 style="margin: 0; text-transform: uppercase; font-size: 0.9rem;">Digital Integrity Certificate</h4>
      <p style="margin: 0.5rem 0; font-size: 0.85rem; color: #666;">Scan this QR code to verify the authenticity of this report on the ForgeGuard Forensic Ledger.</p>
      <code style="font-size: 0.7rem; background: #f0f0f0; padding: 2px 4px;">SHA256: ${result.file_hash}</code>
    </div>
  </div>` : ''}

<div class="signature-block">
  <div class="signature-line">Automated System Signature</div>
  <div class="signature-line">Date / Time</div>
</div>

<div class="footer">
  This document was generated automatically by the ForgeGuard AI Digital Forensics System.<br/>
  Report is provided for investigatory purposes and may require human verification.
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.focus();
      win.onload = () => win.print();
    }
  };

  // ── Image load handler for scaled flagged boxes ──────────────────────────

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    setRenderedSize({ w: img.clientWidth, h: img.clientHeight });
  };

  // Recalculate rendered size on render (in case layout shifts)
  const computedScaleX =
    imgNaturalSize && renderedSize && imgNaturalSize.w > 0
      ? renderedSize.w / imgNaturalSize.w
      : 1;
  const computedScaleY =
    imgNaturalSize && renderedSize && imgNaturalSize.h > 0
      ? renderedSize.h / imgNaturalSize.h
      : 1;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={isProfessionalTheme ? "professional-theme" : ""}>
      {/* Animated gradient background */}
      <div className="gradient-mesh" aria-hidden="true" />
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -2 }}>
        <LiquidEther
          colors={[ '#5227FF', '#FF9FFC', '#B497CF' ]}
          mouseForce={20}
          cursorSize={100}
          isViscous={false}
          viscous={30}
          iterationsViscous={32}
          iterationsPoisson={32}
          resolution={0.5}
          isBounce={false}
          autoDemo={true}
          autoSpeed={0.5}
          autoIntensity={2.2}
          takeoverDuration={0.25}
          autoResumeDelay={3000}
          autoRampDuration={0.6}
        />
      </div>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1, pointerEvents: 'none' }}>
        <Particles
          particleColors={["#ffffff", "#0ea5e9", "#10b981"]}
          particleCount={200}
          particleSpread={10}
          speed={0.1}
          particleBaseSize={100}
          moveParticlesOnHover={true}
          alphaParticles={false}
          disableRotation={false}
          className=""
        />
      </div>

      <div className="page-wrapper">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="header">
          <div style={{ position: "absolute", top: "1rem", right: "1rem", display: "flex", gap: "1rem", zIndex: 10 }}>
             <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", fontFamily: "'Share Tech Mono', monospace", cursor: "pointer", color: "var(--primary)" }}>
                <input type="checkbox" checked={isProfessionalTheme} onChange={e => setIsProfessionalTheme(e.target.checked)} />
                REDLINE MODE (PRO)
             </label>
             <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", fontFamily: "'Share Tech Mono', monospace", cursor: "pointer", color: "var(--accent)" }}>
                <input type="checkbox" checked={isBatchMode} onChange={e => {
                  setIsBatchMode(e.target.checked);
                  if (e.target.checked) removeFile();
                  else setBatchFiles([]);
                }} />
                BATCH MODE
             </label>
          </div>


          <h1 className="header-logo">
            <IconShield />
            FORENSIC TERMINAL
          </h1>
          <p className="header-tagline">
            Detect forged or tampered documents instantly using Error Level Analysis,
            OCR anomaly detection, and font inconsistency checks.
          </p>

          <div style={{ display: "flex", gap: "2rem", marginTop: "1rem" }}>
            <button 
              onClick={() => setActiveTab("analyze")}
              style={{ background: "none", border: "none", borderBottom: activeTab === "analyze" ? "2px solid var(--primary)" : "none", color: activeTab === "analyze" ? "var(--primary)" : "var(--text-muted)", cursor: "pointer", padding: "0.5rem 1rem", fontFamily: "'Share Tech Mono', monospace" }}
            >
              FORENSIC SCAN
            </button>
            <button 
              onClick={() => setActiveTab("verify")}
              style={{ background: "none", border: "none", borderBottom: activeTab === "verify" ? "2px solid var(--primary)" : "none", color: activeTab === "verify" ? "var(--primary)" : "var(--text-muted)", cursor: "pointer", padding: "0.5rem 1rem", fontFamily: "'Share Tech Mono', monospace" }}
            >
              INTEGRITY CHECK
            </button>
          </div>
        </header>

        {/* ── Main Panel ─────────────────────────────────────────────── */}
        <input
          ref={fileInputRef}
          type="file"
          id="file-input"
          accept="image/*,.pdf,video/mp4,video/x-msvideo,video/quicktime"
          multiple={isBatchMode && activeTab === "analyze"}
          style={{ display: "none" }}
          onChange={onFileInput}
        />

        {activeTab === "analyze" ? (
          <div className="glass-card">

            {/* Drop zone */}
            {(!selectedFile && batchFiles.length === 0) && (
              <div
                id="drop-zone"
                className={`drop-zone${isDragging ? " drag-over" : ""}`}
                role="button"
                tabIndex={0}
                aria-label="Click or drop a file to upload"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
              >
                <div className="drop-zone-icon">
                  <IconUpload />
                </div>
                <p className="drop-zone-title">{isBatchMode ? "INITIALIZE BATCH SCAN" : "INITIALIZE SCAN"}</p>
                <div className="drop-zone-formats">
                  {["JPEG", "PNG", "TIFF", "WebP", "BMP", "PDF", "MP4", "AVI", "MOV"].map((f) => (
                    <span key={f} className="format-chip">{f}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Batch Files List */}
            {isBatchMode && batchFiles.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "300px", overflowY: "auto", padding: "1rem 0" }}>
                {batchFiles.map((bf, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "1rem", background: "rgba(255,255,255,0.05)", padding: "0.75rem", borderRadius: "4px", border: "1px solid var(--border-light)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.9rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bf.file.name}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{formatBytes(bf.file.size)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {bf.status === "analyzing" && <SpinnerSVG />}
                      {bf.status === "completed" && <span style={{ color: "var(--success)", fontSize: "0.8rem" }}>✓ {bf.result?.verdict}</span>}
                      {bf.status === "error" && <span style={{ color: "var(--danger)", fontSize: "0.8rem" }}>FAILED</span>}
                      {bf.status === "pending" && <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>READY</span>}
                      <button onClick={() => setBatchFiles(prev => prev.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer" }}><IconX /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Single File preview */}
            {!isBatchMode && selectedFile && (
              <div className="file-preview" id="file-preview">
                {previewUrl ? (
                  <img src={previewUrl} alt="Selected document" className="file-preview-thumb" />
                ) : (
                  <div className="file-preview-icon"><IconFile /></div>
                )}
                <div className="file-preview-info">
                  <div className="file-preview-name">{selectedFile.name}</div>
                  <div className="file-preview-size">{formatBytes(selectedFile.size)}</div>
                </div>
                <button className="file-preview-remove" onClick={removeFile}><IconX /></button>
              </div>
            )}

            {/* Error banner */}
            {appState === "error" && errorMsg && (
              <div className="error-banner" role="alert">
                <IconWarn color="#f87171" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Analyze button */}
            <button
              id="analyze-btn"
              className="btn-analyze"
              onClick={isBatchMode ? analyzeBatch : analyze}
              disabled={(isBatchMode ? batchFiles.length === 0 : !selectedFile) || appState === "analyzing"}
            >
              {appState === "analyzing" ? (
                <>
                  <SpinnerSVG />
                  {isBatchMode ? "PROCESSING BATCH..." : "EXECUTING FORENSIC SCAN..."}
                </>
              ) : (
                <>
                  <IconScan />
                  {isBatchMode ? `ANALYZE ${batchFiles.length} FILES` : "EXECUTE FORENSIC SCAN"}
                </>
              )}
            </button>
          </div>
        ) : (
          /* Verification Panel */
          <div className="glass-card">
            <div className="section-heading">INTEGRITY VERIFICATION // BLOCKCHAIN LEDGER</div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              Upload a document to verify its integrity against the ForgeGuard forensic ledger. We will check if the cryptographic hash matches a previously notarized version.
            </p>
            
            <div
              className={`drop-zone${isDragging ? " drag-over" : ""}`}
              onClick={() => {
                fileInputRef.current?.click();
              }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) verifyFile(file);
              }}
            >
              <div className="drop-zone-icon"><IconShield /></div>
              <p className="drop-zone-title">{isVerifying ? "VERIFYING..." : "DROP FILE TO VERIFY"}</p>
            </div>

            {errorMsg && activeTab === "verify" && (
              <div className="error-banner" role="alert" style={{ marginTop: "1rem" }}>
                <IconWarn color="#f87171" />
                <span>{errorMsg}</span>
              </div>
            )}

            {verifResult && (
              <div style={{ marginTop: "1.5rem", padding: "1.5rem", background: "rgba(0,0,0,0.3)", borderRadius: "8px", border: `1px solid ${verifResult.status === "VERIFIED" ? "var(--success)" : "var(--danger)"}` }}>
                 <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                    <div style={{ fontSize: "1.5rem" }}>{verifResult.status === "VERIFIED" ? "✓" : "⚠"}</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "1.2rem", color: verifResult.status === "VERIFIED" ? "var(--success)" : "var(--danger)" }}>
                        {verifResult.status === "VERIFIED" ? "INTEGRITY VERIFIED" : "NOT FOUND IN LEDGER"}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Hash: {verifResult.hash}</div>
                    </div>
                 </div>
                 {verifResult.status === "VERIFIED" && (
                   <div style={{ fontSize: "0.9rem" }}>
                      <p><strong>Original Filename:</strong> {verifResult.filename}</p>
                      <p><strong>Original Verdict:</strong> <span style={{ color: verdictColor(verifResult.verdict as Verdict) }}>{verifResult.verdict}</span></p>
                      <p><strong>Notarized On:</strong> {verifResult.timestamp}</p>
                   </div>
                 )}
                 {verifResult.status === "NOT_FOUND" && (
                   <p style={{ fontSize: "0.9rem" }}>No matching record was found. This document may have been tampered with or was never notarized.</p>
                 )}
              </div>
            )}
          </div>
        )}

        {/* ── Results card ────────────────────────────────────────────── */}
        {(appState === "analyzing" || appState === "results") && (
          <div className="glass-card" style={{ marginTop: "1.5rem" }} ref={resultsRef} id="results-panel">

            {appState === "analyzing" && !isBatchMode ? (
              <SkeletonLoader />
            ) : appState === "results" && isBatchMode ? (
              /* Batch Results Dashboard */
              <div>
                <div className="section-heading">BATCH SCAN SUMMARY // {batchFiles.length} FILES</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
                   <div style={{ background: "rgba(255,255,255,0.05)", padding: "1.5rem", borderRadius: "8px", textAlign: "center", border: "1px solid var(--border-light)" }}>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>GENUINE</div>
                      <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--success)" }}>{batchFiles.filter(f => f.result?.verdict === "GENUINE").length}</div>
                   </div>
                   <div style={{ background: "rgba(255,255,255,0.05)", padding: "1.5rem", borderRadius: "8px", textAlign: "center", border: "1px solid var(--border-light)" }}>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>SUSPICIOUS</div>
                      <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--warning)" }}>{batchFiles.filter(f => f.result?.verdict === "SUSPICIOUS").length}</div>
                   </div>
                   <div style={{ background: "rgba(255,255,255,0.05)", padding: "1.5rem", borderRadius: "8px", textAlign: "center", border: "1px solid var(--border-light)" }}>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>FORGED</div>
                      <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--danger)" }}>{batchFiles.filter(f => f.result?.verdict === "FORGED").length}</div>
                   </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                   {batchFiles.map((bf, idx) => (
                     <div key={idx} style={{ padding: "1rem", background: "rgba(0,0,0,0.2)", border: `1px solid ${verdictColor(bf.result?.verdict || "GENUINE")}40`, borderRadius: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{bf.file.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Confidence: {bf.result?.confidence}%</div>
                        </div>
                        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                           <span style={{ color: verdictColor(bf.result?.verdict || "GENUINE"), fontWeight: 800, fontSize: "0.9rem" }}>{bf.result?.verdict}</span>
                           <button className="btn-secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.7rem" }} onClick={() => {
                             setResult(bf.result!);
                             setSelectedFile(bf.file);
                             setAppState("results");
                             setIsBatchMode(false);
                           }}>VIEW FULL</button>
                        </div>
                     </div>
                   ))}
                </div>
                <button className="btn-secondary" style={{ marginTop: "2rem", width: "100%" }} onClick={() => {
                   setBatchFiles([]);
                   setAppState("idle");
                }}>CLEAR BATCH AND RESET</button>
              </div>
            ) : result ? (
              <>
                {/* Verdict badge */}
                <div className="verdict-section">
                   {/* QR Code Overlay */}
                   {result.qr_code && (
                     <div style={{ position: "absolute", top: "1rem", right: "1rem", width: "80px", height: "80px", background: "#fff", padding: "4px", borderRadius: "4px", boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}>
                        <img src={`data:image/png;base64,${result.qr_code}`} alt="Verification QR" style={{ width: "100%", height: "100%" }} />
                        <div style={{ fontSize: "0.5rem", color: "#000", textAlign: "center", marginTop: "2px", fontWeight: 800 }}>VERIFY SCAN</div>
                     </div>
                   )}

                  <div id="verdict-badge" className={`verdict-badge ${result.verdict}`} aria-label={`Verdict: ${result.verdict}`}>
                    {result.verdict === "FORGED" && "⚠ "}
                    {result.verdict === "SUSPICIOUS" && "⚡ "}
                    {result.verdict === "GENUINE" && "✓ "}
                    {result.verdict}
                  </div>
                  <p className="verdict-label">{verdictDescription(result.verdict)}</p>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.5rem", fontFamily: "'Share Tech Mono', monospace" }}>FILE HASH: {result.file_hash}</div>
                  
                  {result.is_video && (
                    <div style={{ marginTop: "1rem", display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 1rem", background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", borderRadius: "4px", fontSize: "0.8rem", fontWeight: 800, color: "#ef4444" }}>
                       <span style={{ width: "8px", height: "8px", background: "#ef4444", borderRadius: "50%", animation: "pulseNeon 1s infinite" }} />
                       VIDEO FORENSIC SCAN // {result.num_frames} KEYFRAMES ANALYZED
                    </div>
                  )}
                </div>

                <div className="divider" />

                {/* Confidence Circle */}
                <div className="confidence-section-circle">
                  <div className="confidence-circle-wrapper">
                    <svg viewBox="0 0 100 100" className="confidence-svg">
                      <circle cx="50" cy="50" r="45" className="circle-bg" />
                      <circle 
                        cx="50" cy="50" r="45" 
                        className={`circle-progress ${result.verdict}`}
                        style={{ '--target-offset': 283 - (283 * result.confidence) / 100 } as React.CSSProperties}
                      />
                    </svg>
                    <div className="confidence-circle-content">
                      <span id="confidence-value" className={`confidence-value ${result.verdict}`}>
                        {result.confidence}%
                      </span>
                      <span className="confidence-label-small">
                        {result.verdict === 'GENUINE' ? 'AUTH' : 'FORGED'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score breakdown — 7 signals */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }} id="score-breakdown">
                  {([
                    { label: "ELA",         val: result.score_breakdown.ela_score,       color: "#3b82f6", tip: "Error Level Analysis (35%)" },
                    { label: "Block ELA",   val: result.score_breakdown.block_ela_score,  color: "#8b5cf6", tip: "Block-level ELA variance (20%)" },
                    { label: "Noise",       val: result.score_breakdown.noise_score,      color: "#06b6d4", tip: "Noise map consistency (15%)" },
                    { label: "Copy-Move",   val: result.score_breakdown.copy_move_score,  color: "#ef4444", tip: "Copy-move detection (10%)" },
                    { label: "Metadata",    val: result.score_breakdown.meta_score,       color: "#f59e0b", tip: "EXIF/metadata anomaly (10%)" },
                    { label: "Font",        val: result.score_breakdown.font_score,       color: "#ec4899", tip: "PDF font inconsistency (5%)" },
                    { label: "OCR",         val: result.score_breakdown.ocr_score,        color: "#10b981", tip: "OCR confidence anomaly (5%)" },
                  ] as const).map(({ label, val, color, tip }) => (
                    <div key={label} className="score-card" title={tip} style={{ background: "var(--bg-800)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "1.25rem" }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>{label}</div>
                      <div style={{ fontSize: "1.8rem", fontWeight: 800, color, marginBottom: "0.7rem" }}>{val}</div>
                      <div style={{ height: "6px", background: "var(--bg-700)", borderRadius: "999px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${val}%`, background: color, borderRadius: "999px", transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)", boxShadow: `0 0 10px ${color}80` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reasons */}
                <div className="reasons-section">
                  <div className="section-heading">
                    SYSTEM LOG // FINDINGS
                  </div>
                  {result.reasons.map((reason, idx) => (
                    <div
                      key={idx}
                      className="reason-item"
                      style={{ animationDelay: `${idx * 0.07}s` }}
                    >
                      <span className="reason-icon">
                        <IconWarn
                          color={
                            result.verdict === "FORGED"
                              ? "#ef4444"
                              : result.verdict === "SUSPICIOUS"
                              ? "#f59e0b"
                              : "#10b981"
                          }
                        />
                      </span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>

                {/* ELA Heatmap overlay */}
                {result.heatmap && (
                  <div className="heatmap-section">
                    <div className="section-heading">ELA HEATMAP // VISUAL ANALYSIS</div>
                    <div
                      className="heatmap-wrapper"
                      id="heatmap-container"
                    >
                      <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
                        {/* Original document */}
                        {originalImageUrl && selectedFile?.type.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            ref={imgRef}
                            src={originalImageUrl}
                            alt="Original document"
                            className="heatmap-original"
                            onLoad={onImgLoad}
                          />
                        ) : (
                          // For PDFs: show heatmap directly as the main image
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            ref={imgRef}
                            src={`data:image/png;base64,${result.heatmap}`}
                            alt="ELA heatmap of document"
                            className="heatmap-original"
                            onLoad={onImgLoad}
                          />
                        )}

                        {/* ELA heatmap semi-transparent overlay (only for real images) */}
                        {selectedFile?.type.startsWith("image/") && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`data:image/png;base64,${result.heatmap}`}
                            alt="ELA heatmap overlay"
                            className="heatmap-overlay"
                            aria-hidden="true"
                          />
                        )}

                        {/* Flagged region bounding boxes */}
                        {result.flagged_regions.map((region, idx) => (
                          <div
                            key={idx}
                            className="flagged-box"
                            title={region.reason}
                            aria-label={`Flagged region: ${region.reason}`}
                            style={{
                              left: `${region.x * computedScaleX}px`,
                              top: `${region.y * computedScaleY}px`,
                              width: `${region.w * computedScaleX}px`,
                              height: `${region.h * computedScaleY}px`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.4rem", textAlign: "center" }}>
                      Bright areas in the heatmap indicate higher error levels — possible signs of digital manipulation.
                      Red boxes mark specific flagged regions.
                    </p>
                  </div>
                )}

                {/* Stego Map Section */}
                {result.stego_map && (
                  <div className="heatmap-section" style={{ marginTop: "2rem" }}>
                    <div className="section-heading">GHOST BIT // STEGANOGRAPHY MAP</div>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
                      Visualizing the Least Significant Bit (LSB) plane. Random static is normal; defined patterns or text suggest hidden data.
                    </p>
                    <div className="heatmap-wrapper" style={{ border: "1px solid var(--accent)", background: "#000" }}>
                       <img src={`data:image/png;base64,${result.stego_map}`} alt="Steganography map" className="heatmap-original" style={{ filter: "brightness(1.5) contrast(1.2) hue-rotate(180deg)" }} />
                    </div>
                  </div>
                )}

                {/* Technical metadata (collapsible) */}
                {result.metadata && (
                  <details style={{ marginBottom: "1rem" }}>
                    <summary style={{ cursor: "pointer", fontSize: "0.9rem", fontFamily: "'Share Tech Mono', monospace", color: "var(--accent)", marginBottom: "0.6rem", userSelect: "none", textTransform: "uppercase" }}>
                      [+] EXPAND RAW METADATA
                    </summary>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                      <tbody>
                        {[
                          ["Filename", result.metadata.filename],
                          ["File Size", `${result.metadata.file_size_kb} KB`],
                          ["ELA Q90 Mean", result.metadata.ela_raw?.mean_q90 ?? "N/A"],
                          ["ELA Ghost Ratio", result.metadata.ela_raw?.ghost_ratio ?? "N/A"],
                          ["Block ELA CV", result.metadata.block_ela_debug?.cv ?? "N/A"],
                          ["Noise CV", result.metadata.noise_debug?.cv ?? "N/A"],
                          ["OCR Mean Confidence", result.metadata.ocr_mean_confidence != null ? `${result.metadata.ocr_mean_confidence}%` : "N/A"],
                          ["OCR Low-Conf Ratio", result.metadata.ocr_low_conf_ratio != null ? `${result.metadata.ocr_low_conf_ratio}%` : "N/A"],
                          ["PDF Font Count", result.metadata.pdf_num_fonts || "N/A"],
                          ...(result.metadata.pdf_fonts?.length ? [["PDF Fonts", result.metadata.pdf_fonts.join(", ")]] : []),
                        ].map(([k, v]) => (
                          <tr key={String(k)}>
                            <td style={{ padding: "0.35rem 0.5rem", fontWeight: 600, color: "var(--text-secondary)", width: "40%", borderBottom: "1px solid var(--border)" }}>{k}</td>
                            <td style={{ padding: "0.35rem 0.5rem", color: "var(--text-primary)", borderBottom: "1px solid var(--border)", wordBreak: "break-all" }}>{String(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}

                {/* Action buttons */}
                <div className="actions-row">
                  <button id="download-report-btn" className="btn-secondary" onClick={downloadReport}>
                    <IconDownload />
                    Download Report
                  </button>
                  <button
                    id="analyze-another-btn"
                    className="btn-secondary"
                    onClick={() => {
                      setAppState("idle");
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      setOriginalImageUrl(null);
                      setResult(null);
                      setErrorMsg("");
                    }}
                  >
                    <IconRefresh />
                    Analyze Another
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Footer */}
        <footer className="footer">
          FORENSIC ANALYSIS TERMINAL v2.0 &nbsp;·&nbsp; RESTRICTED ACCESS &nbsp;·&nbsp; AI DOCUMENT VERIFICATION
        </footer>
      </div>

      {/* ── AI Forensic Assistant Chat ── */}
      {result && (
        <div className={`chat-widget ${chatOpen ? "open" : "closed"}`}>
          <div className="chat-header" onClick={() => setChatOpen(!chatOpen)}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="pulse-dot" style={{ background: "var(--primary)" }} />
              <span style={{ fontWeight: 600, letterSpacing: "0.05em" }}>AI FORENSIC ASSISTANT</span>
            </div>
            <IconX />
          </div>
          
          {chatOpen && (
            <>
              <div className="chat-messages">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-bubble ${msg.role}`}>
                    {msg.text}
                  </div>
                ))}
                {chatLoading && (
                  <div className="chat-bubble ai loading">
                    <SpinnerSVG /> Thinking...
                  </div>
                )}
              </div>
              <form
                className="chat-input-area"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!chatInput.trim() || chatLoading) return;
                  
                  const q = chatInput;
                  setChatInput("");
                  setChatMessages(prev => [...prev, {role: "user", text: q}]);
                  setChatLoading(true);
                  
                  try {
                    const res = await fetch("http://localhost:8000/explain", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ question: q, report: result }),
                    });
                    const data = await res.json();
                    setChatMessages(prev => [...prev, {role: "ai", text: data.answer || "I'm having trouble analyzing that right now."}]);
                  } catch (err) {
                    setChatMessages(prev => [...prev, {role: "ai", text: "Connection error. Ensure the backend is running."}]);
                  } finally {
                    setChatLoading(false);
                  }
                }}
              >
                <input
                  type="text"
                  placeholder="Ask about the findings..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <button type="submit" disabled={chatLoading || !chatInput.trim()}>
                  SEND
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Spinner SVG ───────────────────────────────────────────────────────────────

function SpinnerSVG() {
  return (
    <svg
      width="18" height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path
        strokeLinecap="round"
        d="M12 2a10 10 0 0 1 10 10"
        strokeOpacity="0.3"
      />
      <path
        strokeLinecap="round"
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
      />
    </svg>
  );
}
