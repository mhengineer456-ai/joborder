import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { FiSearch, FiRefreshCw, FiScissors, FiCheckCircle, FiClock, FiGrid, FiDownload, FiUser, FiTag, FiShoppingBag } from "react-icons/fi";

const Container = styled.div`
  padding: 2rem;
  background: radial-gradient(circle at 15% 15%, rgba(219, 234, 254, 0.8) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(224, 242, 254, 0.7) 0%, transparent 45%), #f8fafc;
  min-height: 100vh;
  font-family: 'Plus Jakarta Sans', 'Outfit', sans-serif;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
  background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%);
  padding: 1.75rem 2rem;
  border-radius: 20px;
  box-shadow: 0 20px 25px -5px rgba(37, 99, 235, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: white;
`;

const BackButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: white;
  padding: 0.6rem 1.1rem;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateX(-2px);
  }
`;

const TitleSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const IconWrapper = styled.div`
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: white;
  padding: 0.75rem;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  backdrop-filter: blur(4px);
`;

const Title = styled.h1`
  font-size: 1.75rem;
  font-weight: 800;
  background: linear-gradient(135deg, #ffffff 0%, #bfdbfe 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
`;

const Subtitle = styled.p`
  color: #bfdbfe;
  font-size: 0.875rem;
  font-weight: 500;
  margin: 0.25rem 0 0 0;
`;

const Controls = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`;

const RefreshButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 12px;
  font-weight: 700;
  color: white;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
  transition: all 0.2s;

  &:hover {
    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
    box-shadow: 0 6px 18px rgba(37, 99, 235, 0.35);
    transform: translateY(-1px);
  }

  svg {
    transition: transform 0.3s;
  }
  
  &:active svg {
    transform: rotate(180deg);
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2.5rem;
`;

const StatCard = styled.div`
  background: white;
  padding: 1.25rem 1.5rem;
  border-radius: 16px;
  border: 1px solid #cbd5e1;
  border-top: 4px solid #2563eb;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 10px 20px -3px rgba(37, 99, 235, 0.07);
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 15px 25px -5px rgba(37, 99, 235, 0.12);
  }
`;

const StatIcon = styled.div`
  background: ${props => props.bg || "#eff6ff"};
  color: ${props => props.color || "#0f52ba"};
  padding: 0.75rem;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
`;

const StatInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const StatValue = styled.span`
  font-size: 1.6rem;
  font-weight: 800;
  color: #0f172a;
`;

const StatLabel = styled.span`
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
`;

const TableContainer = styled.div`
  background: white;
  border-radius: 20px;
  border: 1px solid #cbd5e1;
  overflow: hidden;
  box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.08);
`;

const TableHeader = styled.div`
  padding: 1.5rem 1.8rem;
  background: #f8fafc;
  border-bottom: 1px solid #cbd5e1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
`;

const SearchWrapper = styled.div`
  position: relative;
  width: 100%;
  max-width: 360px;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.7rem 1rem 0.7rem 2.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #0f172a;
  outline: none;
  transition: all 0.2s;

  &:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15);
  }
`;

const SearchIcon = styled(FiSearch)`
  position: absolute;
  left: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
`;

const Th = styled.th`
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #ffffff;
  border-bottom: 2px solid #1e293b;
  white-space: nowrap;
`;

const Td = styled.td`
  padding: 1rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #0f172a;
  border-bottom: 1px solid #e2e8f0;
`;

const Tr = styled.tr`
  transition: all 0.15s;
  background-color: ${props => props.isRecent ? "rgba(37, 99, 235, 0.05)" : "transparent"};
  border-left: ${props => props.isRecent ? "4px solid #2563eb" : "4px solid transparent"};
  
  &:nth-child(even) {
    background-color: ${props => props.isRecent ? "rgba(37, 99, 235, 0.05)" : "#f8fafc"};
  }

  &:hover {
    background: #eff6ff;
  }
`;

const RecentBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.68rem;
  font-weight: 800;
  background: #eff6ff;
  color: #1e40af;
  border: 1px solid #bfdbfe;
  text-transform: uppercase;
  margin-left: 0.5rem;
  vertical-align: middle;
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.3rem 0.8rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
`;

const DownloadButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
  border: none;
  padding: 0.55rem 1rem;
  border-radius: 10px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
  transition: all 0.2s;

  &:hover {
    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
    transform: translateY(-1px);
  &:disabled {
    background: #94a3b8;
    box-shadow: none;
    cursor: not-allowed;
    transform: none;
  }
`;

const LoadingSpinner = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: #0f52ba;
  gap: 1rem;

  .spinner {
    animation: rotate 1.5s linear infinite;
    font-size: 2rem;
  }

  @keyframes rotate {
    100% {
      transform: rotate(360deg);
    }
  }
`;

const ErrorContainer = styled.div`
  padding: 1.5rem;
  background: #fef2f2;
  border: 1px solid #fee2e2;
  border-radius: 8px;
  color: #991b1b;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
`;

const EmptyState = styled.div`
  padding: 4rem;
  text-align: center;
  color: #64748b;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
`;

// Helper PDF utilities
async function loadJsPDF() {
  const mod = await import("jspdf");
  return mod.jsPDF || mod.default;
}

const pause = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function withTimeout(promise, ms = 4000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(""), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); })
      .catch(() => { clearTimeout(t); resolve(""); });
  });
}

function tryParseDateToISO(s) {
  if (!s) return "";
  const d1 = new Date(s);
  if (!isNaN(d1)) return d1.toISOString();
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (m) {
    const dd = Number(m[1]), mm = Number(m[2]),
      yyyy = Number(m[3] < 100 ? 2000 + Number(m[3]) : m[3]);
    const d2 = new Date(yyyy, mm - 1, dd);
    if (!isNaN(d2)) return d2.toISOString();
  }
  return "";
}

function extractDriveFileId(url) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/file\/d\/([^/]+)/) || u.search.match(/[?&]id=([^&]+)/);
    return m ? m[1] : "";
  } catch { return ""; }
}

function driveUcUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

async function loadImageAsBase64ForPdf(url, opts = {}) {
  return new Promise((resolve) => {
    try {
      const fileId = extractDriveFileId(url);
      const direct = fileId ? driveUcUrl(fileId) : (url || "").toString().trim();
      if (!direct) return resolve("");

      const clean = direct.replace(/^https?:\/\//, "");
      const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(clean)}`;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const maxW = opts.maxWidth || 880;
          const maxH = opts.maxHeight || 880;
          let { width, height } = img;

          if (width > maxW || height > maxH) {
            const r = Math.min(maxW / width, maxH / height);
            width = Math.max(1, Math.floor(width * r));
            height = Math.max(1, Math.floor(height * r));
          }

          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) return resolve("");
              const fr = new FileReader();
              fr.onloadend = () => resolve(fr.result || "");
              fr.readAsDataURL(blob);
            },
            "image/jpeg",
            0.65
          );
        } catch { resolve(""); }
      };
      img.onerror = () => resolve("");
      img.src = proxied;
    } catch { resolve(""); }
  });
}

function drawStar(doc, x, y, size = 12) {
  const spikeCount = 5;
  const outerRadius = size;
  const innerRadius = size / 2;
  const rotation = Math.PI / 2 * 3;

  const points = [];
  for (let i = 0; i < spikeCount; i++) {
    points.push([
      x + Math.cos(rotation + i * 2 * Math.PI / spikeCount) * outerRadius,
      y + Math.sin(rotation + i * 2 * Math.PI / spikeCount) * outerRadius
    ]);
    points.push([
      x + Math.cos(rotation + (i + 0.5) * 2 * Math.PI / spikeCount) * innerRadius,
      y + Math.sin(rotation + (i + 0.5) * 2 * Math.PI / spikeCount) * innerRadius
    ]);
  }

  doc.setFillColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.setLineJoin('miter');
  doc.setLineCap('butt');

  doc.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    doc.lineTo(points[i][0], points[i][1]);
  }
  doc.lineTo(points[0][0], points[0][1]);
  doc.fill();
  doc.stroke();
}

// Columns configuration for JobOrder sheet matching
const JOB_ORDER_HEADERS = [
  "Job Order No", "Date", "Fabric", "Brand", "Shade", "Size", "Quantity", "Unit",
  "Party Name", "Garment Type", "Section", "Season", "Emb", "Emb Details",
  "Printing", "Printing Details", "Pattern", "Style", "Remarks", "Direct Stitching",
  "Submitted By", "Image URL", "Lot Number", "Component", "Priority",
  "Tape/Lace", "Bottom Type", "Zip", "Sticker",
  "Collar", "Bone", "FULL BAJU",
  "FABRIC_SUPERVISOR", "Order No."
];

export default function CutReadyLots() {
  const navigate = useNavigate();
  const [scansData, setScansData] = useState([]);
  const [jobOrdersMap, setJobOrdersMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  const scansSpreadsheetId = "1UU9P1IOjuUYpm3Ojx06V5L-r6K2QRb4mpFQmlGblgDA";
  const scansSheetName = "CuttingScanss";

  const jobSpreadsheetId = "1fKSwGBIpzWEFk566WRQ4bzQ0anJlmasoY8TwrTLQHXI";
  const jobSheetName = "JobOrder";

  const apiKey = "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk";

  const getCell = (row, idx) => {
    if (idx == null) return "";
    return (row[idx] ?? "").toString().trim();
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Cutting Scans
      const scansRange = `${scansSheetName}!A:C`;
      const scansUrl = `https://sheets.googleapis.com/v4/spreadsheets/${scansSpreadsheetId}/values/${encodeURIComponent(scansRange)}?key=${apiKey}`;

      // 2. Fetch Job Orders
      const jobRange = `${jobSheetName}!A1:AW`;
      const jobUrl = `https://sheets.googleapis.com/v4/spreadsheets/${jobSpreadsheetId}/values/${encodeURIComponent(jobRange)}?key=${apiKey}`;

      const [scansRes, jobRes] = await Promise.all([
        fetch(scansUrl),
        fetch(jobUrl)
      ]);

      if (!scansRes.ok) throw new Error(`Cutting scans fetch failed: HTTP ${scansRes.status}`);
      if (!jobRes.ok) throw new Error(`Job orders fetch failed: HTTP ${jobRes.status}`);

      const scansJson = await scansRes.json();
      const jobJson = await jobRes.json();

      // Process Job Orders mapping
      const jobMap = new Map();
      if (jobJson.values && jobJson.values.length > 0) {
        const headerRow = jobJson.values[0].map(h => (h || "").trim());
        const bodyRows = jobJson.values.slice(1);

        const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();
        const hIndex = {};
        headerRow.forEach((h, i) => {
          const exact = h.trim();
          const normalized = norm(h);
          if (!(exact in hIndex)) hIndex[exact] = i;
          if (!(normalized in hIndex)) hIndex[normalized] = i;
        });

        bodyRows.forEach((r) => {
          if (r.some(cell => (cell ?? "").toString().trim() !== "")) {
            const obj = {};
            JOB_ORDER_HEADERS.forEach((H) => {
              obj[H] = getCell(r, hIndex[H]);
            });

            const lotNum = String(obj["Lot Number"]).trim();
            if (lotNum) {
              // Store by Lot Number (case-insensitive keys for safety)
              jobMap.set(lotNum.toLowerCase(), obj);
            }
          }
        });
      }
      setJobOrdersMap(jobMap);

      // Process Cutting Scans
      if (scansJson.values && scansJson.values.length > 0) {
        const rows = scansJson.values.slice(1);
        const formattedScans = rows.map((row, idx) => ({
          id: idx,
          timestamp: row[0] || "",
          lotNumber: (row[1] || "").toString().trim(),
          status: row[2] || ""
        }));
        setScansData(formattedScans);
      } else {
        setScansData([]);
      }

    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load spreadsheet data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter completed scans
  const completedScans = useMemo(() => {
    return scansData.filter(item => String(item.status).trim().toLowerCase() === "completed");
  }, [scansData]);

  // Find the latest timestamp among completed scans to support older database dates relatively
  const latestTimestamp = useMemo(() => {
    if (completedScans.length === 0) return null;
    let maxTime = 0;
    completedScans.forEach(item => {
      const t = new Date(item.timestamp).getTime();
      if (!isNaN(t) && t > maxTime) {
        maxTime = t;
      }
    });
    return maxTime > 0 ? maxTime : null;
  }, [completedScans]);

  // Track which lot IDs are scanned within 24 hours of current time, or relative to latest lot
  const recentScanIds = useMemo(() => {
    const ids = new Set();
    if (completedScans.length === 0) return ids;

    const oneDayMs = 24 * 60 * 60 * 1000;
    const now = new Date().getTime();

    completedScans.forEach(item => {
      const t = new Date(item.timestamp).getTime();
      if (isNaN(t)) return;

      // 1. Within 24 hours of current local time
      const isWithinReal24 = (now - t <= oneDayMs) && (now - t >= 0);

      // 2. Within 24 hours of latest scan timestamp in dataset (fallback)
      const isWithinRelative24 = latestTimestamp ? (latestTimestamp - t <= oneDayMs) : false;

      if (isWithinReal24 || isWithinRelative24) {
        ids.add(item.id);
      }
    });
    return ids;
  }, [completedScans, latestTimestamp]);

  // Merge scan data with job order info and sort by timestamp descending
  const mergedLots = useMemo(() => {
    const list = completedScans.map(scan => {
      const matchedJob = jobOrdersMap.get(scan.lotNumber.toLowerCase());
      return {
        ...scan,
        jobOrder: matchedJob || null
      };
    });
    
    // Sort by timestamp descending (newest entries first)
    return list.sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      if (isNaN(dateA) || isNaN(dateB)) {
        return b.id - a.id;
      }
      return dateB - dateA;
    });
  }, [completedScans, jobOrdersMap]);

  // Search logic
  const filteredLots = useMemo(() => {
    if (!searchQuery.trim()) return mergedLots;
    const q = searchQuery.toLowerCase();
    return mergedLots.filter(item =>
      String(item.lotNumber).toLowerCase().includes(q) ||
      String(item.timestamp).toLowerCase().includes(q) ||
      (item.jobOrder && (
        String(item.jobOrder["Job Order No"]).toLowerCase().includes(q) ||
        String(item.jobOrder["Party Name"]).toLowerCase().includes(q) ||
        String(item.jobOrder["Style"]).toLowerCase().includes(q) ||
        String(item.jobOrder["Fabric"]).toLowerCase().includes(q)
      ))
    );
  }, [mergedLots, searchQuery]);

  // PDF Generation: Generates EXACTLY the first page of the Job Order PDF from AllJobOrder
  const downloadJobOrderFirstPage = async (row) => {
    if (!row || !row.jobOrder) {
      alert("No Job Order details available for this lot.");
      return;
    }

    const joNum = row.jobOrder["Job Order No"] || "Unknown";
    setDownloadingId(row.id);

    try {
      await pause(100);
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a3",
        compress: true,
        putOnlyUsedFonts: true,
      });

      const PAGE = { w: doc.internal.pageSize.getWidth(), h: doc.internal.pageSize.getHeight() };
      
      // Page Scaffolding / Border
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, PAGE.w, PAGE.h, "F");
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.8);
      doc.rect(12, 12, PAGE.w - 24, PAGE.h - 24);

      // Design Constants
      const M = 42;
      const GRID_COL_GAP = 20;
      const IMG_MAX = 900;
      const IMG_TIMEOUT_MS = 4000;

      const F = {
        h3: 20,
        body: 13,
        label: 11.5,
        meta: 10.5,
        small: 8.5
      };

      const setFont = (weight, size) => {
        doc.setFont("Arial", weight);
        doc.setFontSize(size);
        doc.setTextColor(0, 0, 0);
      };

      const asText = (v) => (v == null || String(v).trim() === "" ? "—" : String(v).trim());
      const val = (k) => asText(row.jobOrder[k]);
      const dsEnabled = /^(true|yes|y|1)$/i.test(String(row.jobOrder["Direct Stitching"] || "").trim());

      const vDate = (k) => {
        const value = row.jobOrder[k];
        if (!value) return "—";
        const iso = tryParseDateToISO(value);
        if (!iso) return value;
        const d = new Date(iso);
        return `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })} ${d.getFullYear()}`;
      };

      // Header Layout
      const priorityText = val("Priority") || "";
      const priorityLower = priorityText.toLowerCase();
      const isLotRepeated = priorityLower.includes("repeated") || priorityLower.includes("repeat");

      let headerY = isLotRepeated ? 130 : 115;

      setFont("bold", 26);
      doc.text("JOB ORDER", PAGE.w / 2, 50, { align: "center" });

      if (isLotRepeated) {
        const starSize = 11;
        const starSpacing = 22;
        const totalWidth = 5 * starSpacing - starSpacing / 2;
        const startX = PAGE.w / 2 - totalWidth / 2;
        for (let i = 0; i < 5; i++) {
          drawStar(doc, startX + (i * starSpacing), 72, starSize);
        }
        setFont("bold", 14);
        doc.text("LOT REPEATED", PAGE.w / 2, 95, { align: "center" });
        setFont("bold", 12);
        doc.text(`Job Order #${joNum}`, PAGE.w / 2, 115, { align: "center" });
      } else {
        setFont("bold", 12);
        doc.text(`Job Order #${joNum}`, PAGE.w / 2, 82, { align: "center" });
      }

      // Rounded Badge: JO
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(1);
      doc.circle(M + 25, 48, 20, "FD");
      setFont("bold", 14);
      doc.text("JO", M + 25, 55, { align: "center" });

      const genDate = new Date().toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      });
      setFont("normal", F.meta - 1);
      doc.text(`Generated: ${genDate}`, PAGE.w - M, 43, { align: "right" });
      doc.text(`Submitted by: ${val("Submitted By")}`, PAGE.w - M, 58, { align: "right" });

      if (dsEnabled) {
        const padX = 10, hChip = 24, r = 10;
        setFont("bold", 10);
        const label = "DIRECT STITCHING";
        const wChip = doc.getTextWidth(label) + padX * 2 + 10;
        const xChip = M;
        const yChip = isLotRepeated ? 125 : 110;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(1);
        doc.roundedRect(xChip, yChip - hChip + 2, wChip, hChip, r, r, "FD");
        doc.text(label, xChip + padX + 8, yChip - 6);
      }

      let y = headerY + 20;

      // Section drawing helpers
      const contentW = () => PAGE.w - M * 2;

      const drawCardForPage = async ({ label, value, x, w }) => {
        const padX = 15, padY = 10;
        const labelH = F.label * 1.2;
        const maxWidth = w - padX * 2;
        const txt = value && String(value).trim() ? String(value) : "—";
        const isPriorityCard = label.toLowerCase() === "priority";
        const bodyFontSize = isPriorityCard ? F.body - 2 : F.body;
        const lineH = (bodyFontSize - 1) * 1.3;

        const lines = doc.splitTextToSize(txt, maxWidth);
        const contentH = Math.max(lineH, lines.length * lineH);
        const h = padY + labelH + 6 + contentH + padY;

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(1);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, w, h, 8, 8, "FD");

        setFont("bold", F.label - 1);
        doc.text(label.toUpperCase(), x + w / 2, y + padY + labelH / 2 - 2, { align: "center" });

        setFont(isPriorityCard ? "bold" : "normal", bodyFontSize);
        const textY = y + padY + labelH + 6 + (h - (padY + labelH + 6 + lines.length * lineH)) / 2;
        lines.forEach((line, i) => {
          doc.text(line, x + w / 2, textY + i * lineH, { align: "center" });
        });

        return y + h;
      };

      const drawGridRowForPage = async (items, { cols = items.length, rowGap = 12 } = {}) => {
        const totalW = contentW();
        const gapW = GRID_COL_GAP * (cols - 1);
        const cardW = (totalW - gapW) / cols;

        const heights = items.map(({ value, label }) => {
          const padX = 15, padY = 10, labelH = F.label * 1.2;
          const maxWidth = cardW - padX * 2;
          const lineH = F.body * 1.3;
          const lines = doc.splitTextToSize((value || "—").toString(), maxWidth);
          return padY + labelH + 6 + Math.max(lineH, lines.length * lineH) + padY;
        });

        const rowH = Math.max(...heights);
        const yTop = y;
        let maxBottom = yTop;

        for (let i = 0; i < items.length; i++) {
          const cardX = M + i * (cardW + GRID_COL_GAP);
          y = yTop;
          const bottom = await drawCardForPage({ ...items[i], x: cardX, w: cardW });
          maxBottom = Math.max(maxBottom, bottom);
        }

        y = maxBottom + rowGap;
      };

      const sectionHeaderForPage = async (text) => {
        const yMid = y + 6;
        setFont("bold", F.h3 - 2);
        doc.text(text, PAGE.w / 2, yMid, { align: "center" });
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(1.2);
        doc.line(PAGE.w / 2 - 70, yMid + 10, PAGE.w / 2 + 70, yMid + 10);
        y += 26;
      };

      // 1. Order Details
      const fabricSupervisor = val("FABRIC_SUPERVISOR");
      const orderDetailsTitle = fabricSupervisor && fabricSupervisor !== "—"
        ? `Order Details (${fabricSupervisor})`
        : "Order Details";
      await sectionHeaderForPage(orderDetailsTitle);

      await drawGridRowForPage([
        { label: "Job Order No", value: joNum },
        { label: "Date", value: vDate("Date") },
        { label: "Lot Number", value: val("Lot Number") },
        { label: "Party Name", value: val("Party Name") },
        { label: "Brand", value: val("Brand") },
      ], { cols: 5, rowGap: 12 });

      await drawGridRowForPage([
        { label: "FABRIC SUPERVISOR", value: val("FABRIC_SUPERVISOR") },
        { label: "Order No.", value: val("Order No.") },
      ], { cols: 2, rowGap: 12 });

      await drawGridRowForPage([
        { label: "Fabric", value: val("Fabric") },
        { label: "Garment Type", value: val("Garment Type") },
        { label: "Section", value: val("Section") },
        { label: "Quantity", value: val("Quantity") },
        { label: "Unit", value: val("Unit") },
      ], { cols: 5, rowGap: 12 });

      await drawGridRowForPage([
        { label: "Season", value: val("Season") },
        { label: "Style", value: val("Style") },
        { label: "Pattern", value: val("Pattern") },
        { label: "Size", value: val("Size") },
        { label: "Priority", value: val("Priority") },
      ], { cols: 5, rowGap: 12 });

      await drawGridRowForPage([
        { label: "Shade", value: val("Shade") }
      ], { cols: 1, rowGap: 12 });

      // 2. Accessories
      await sectionHeaderForPage("Accessories");
      await drawGridRowForPage([
        { label: "Collar", value: val("Collar") },
        { label: "Bone", value: val("Bone") },
        { label: "Tape/Lace", value: val("Tape/Lace") },
        { label: "Bottom Type", value: val("Bottom Type") },
        { label: "Zip", value: val("Zip") },
        { label: "FULL BAJU", value: val("FULL BAJU") },
      ], { cols: 6, rowGap: 12 });

      // 3. Special Processes
      await sectionHeaderForPage("Special Processes");
      await drawGridRowForPage([
        { label: "Embroidery", value: val("Emb") },
        { label: "Printing", value: val("Printing") },
        { label: "Direct Stitching", value: dsEnabled ? "Yes" : val("Direct Stitching") },
        { label: "Component", value: val("Component") },
        { label: "Sticker", value: val("Sticker") },
      ], { cols: 5, rowGap: 12 });

      await drawGridRowForPage([
        { label: "Embroidery Details", value: val("Emb Details") },
        { label: "Printing Details", value: val("Printing Details") },
      ], { cols: 2, rowGap: 12 });

      // 4. Remarks & Visual Reference
      await sectionHeaderForPage("Remarks & Visual Reference");

      const twoColW = (contentW() - GRID_COL_GAP) / 2;
      const imageHeight = 220;
      const startY = y;

      const remarksText = val("Remarks") !== "—" ? val("Remarks") : "No remarks provided";
      const padX = 15, padY = 10, labelH = F.label * 1.2;
      const lines = doc.splitTextToSize(remarksText, twoColW - padX * 2);
      const lineH = (F.body - 1) * 1.3;
      const remarksCardHeight = padY + labelH + 6 + Math.max(lineH, lines.length * lineH) + padY;
      const finalHeight = Math.max(remarksCardHeight, imageHeight);

      // Left Box: Remarks
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(1);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(M, startY, twoColW, finalHeight, 8, 8, "FD");
      setFont("bold", F.label - 1);
      doc.text("REMARKS", M + twoColW / 2, startY + padY + labelH / 2 - 2, { align: "center" });

      const textTotalHeight = lines.length * lineH;
      const textStartY = startY + padY + labelH + 6 + (finalHeight - (padY + labelH + 6) - textTotalHeight) / 2;
      setFont("normal", F.body);
      lines.forEach((line, i) => {
        doc.text(line, M + twoColW / 2, textStartY + i * lineH, { align: "center" });
      });

      // Right Box: Image
      const imageX = M + twoColW + GRID_COL_GAP;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(1);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(imageX, startY, twoColW, finalHeight, 8, 8, "FD");
      setFont("bold", F.label - 1);
      doc.text("IMAGE", imageX + twoColW / 2, startY + padY + labelH / 2 - 2, { align: "center" });

      let drewImage = false;
      const imageUrl = row.jobOrder["Image URL"];
      if (imageUrl && imageUrl !== "—") {
        try {
          const dataUrl = await withTimeout(
            loadImageAsBase64ForPdf(imageUrl, { maxWidth: IMG_MAX, maxHeight: IMG_MAX }),
            IMG_TIMEOUT_MS
          );
          if (dataUrl) {
            const p = doc.getImageProperties(dataUrl);
            const fitW = twoColW - 40;
            const fitH = finalHeight - (padY + labelH + 6) - 20;
            const ratio = Math.min(fitW / p.width, fitH / p.height);
            const iw = Math.max(1, p.width * ratio);
            const ih = Math.max(1, p.height * ratio);
            const ix = imageX + (twoColW - iw) / 2;
            const iy = startY + padY + labelH + 8 + (fitH - ih) / 2;
            doc.addImage(dataUrl, "JPEG", ix, iy, iw, ih);
            drewImage = true;
          }
        } catch (_) { }
      }

      if (!drewImage) {
        setFont("normal", F.meta);
        doc.text("No image provided / failed to load", imageX + twoColW / 2, startY + finalHeight / 2, { align: "center" });
      }

      // Save output PDF
      doc.save(`JobOrder_${joNum}_Lot_${row.lotNumber}_Page1.pdf`);
    } catch (err) {
      console.error(err);
      alert(`Could not create Job Order Page 1 PDF: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Container>
      <Header>
        <TitleSection>
          <BackButton onClick={() => navigate(-1)} title="Go Back">
            ← Back
          </BackButton>
          <IconWrapper>
            <FiScissors />
          </IconWrapper>
          <div>
            <Title>Cut-Ready Lots (Merged Info)</Title>
            <Subtitle>Lots with completed cutting, merged with active Job Orders</Subtitle>
          </div>
        </TitleSection>
        <Controls>
          <RefreshButton onClick={fetchData} disabled={loading}>
            <FiRefreshCw className={loading ? "spinner" : ""} />
            Refresh
          </RefreshButton>
        </Controls>
      </Header>

      {error && <ErrorContainer>{error}</ErrorContainer>}

      <StatsGrid>
        <StatCard>
          <StatIcon bg="#ecfdf5" color="#059669">
            <FiCheckCircle />
          </StatIcon>
          <StatInfo>
            <StatValue>{completedScans.length}</StatValue>
            <StatLabel>Total Cut Lots</StatLabel>
          </StatInfo>
        </StatCard>
        <StatCard>
          <StatIcon bg="#eff6ff" color="#0f52ba">
            <FiGrid />
          </StatIcon>
          <StatInfo>
            <StatValue>{scansData.length}</StatValue>
            <StatLabel>Total Scans Records</StatLabel>
          </StatInfo>
        </StatCard>
        <StatCard>
          <StatIcon bg="#fef3c7" color="#d97706">
            <FiShoppingBag />
          </StatIcon>
          <StatInfo>
            <StatValue>
              {Array.from(jobOrdersMap.keys()).length}
            </StatValue>
            <StatLabel>Active Job Orders</StatLabel>
          </StatInfo>
        </StatCard>
        <StatCard>
          <StatIcon bg="#eff6ff" color="#2563eb">
            <FiUser />
          </StatIcon>
          <StatInfo>
            <StatValue>
              {mergedLots.filter(l => l.jobOrder).length}
            </StatValue>
            <StatLabel>Linked Lots</StatLabel>
          </StatInfo>
        </StatCard>
      </StatsGrid>

      <TableContainer>
        <TableHeader>
          <h2 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#0f172a", margin: 0 }}>
            Cut-Ready Lots & Job Details
          </h2>
          <SearchWrapper>
            <SearchIcon />
            <SearchInput
              type="text"
              placeholder="Search by lot, style, fabric, party name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </SearchWrapper>
        </TableHeader>

        {loading ? (
          <LoadingSpinner>
            <FiRefreshCw className="spinner" />
            <span>Fetching data and merging with Job Orders...</span>
          </LoadingSpinner>
        ) : filteredLots.length === 0 ? (
          <EmptyState>
            <FiScissors style={{ fontSize: "2.5rem", color: "#94a3b8" }} />
            <p style={{ fontWeight: "600", margin: 0 }}>No matching completed lots found</p>
            <p style={{ fontSize: "0.875rem", margin: 0 }}>
              {searchQuery ? "Try refining your search query." : "There are currently no completed cutting lots."}
            </p>
          </EmptyState>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <StyledTable>
              <thead>
                <tr>
                  <Th>Timestamp</Th>
                  <Th>Lot Number</Th>
                  <Th>Job Order No</Th>
                  <Th>Party Name</Th>
                  <Th>Fabric</Th>
                  <Th>Style</Th>
                  <Th>Quantity</Th>
                  <Th>Status</Th>
                  <Th style={{ textAlign: "center" }}>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filteredLots.map((row) => {
                  const job = row.jobOrder;
                  const isRecent = recentScanIds.has(row.id);
                  return (
                    <Tr key={row.id} isRecent={isRecent}>
                      <Td>{row.timestamp}</Td>
                      <Td style={{ fontWeight: "600", color: "#0f172a" }}>
                        {row.lotNumber}
                        {isRecent && <RecentBadge>New</RecentBadge>}
                      </Td>
                      <Td style={{ fontWeight: "500" }}>{job ? job["Job Order No"] : <span style={{ color: "#94a3b8" }}>—</span>}</Td>
                      <Td>{job ? job["Party Name"] : <span style={{ color: "#94a3b8" }}>—</span>}</Td>
                      <Td>{job ? job["Fabric"] : <span style={{ color: "#94a3b8" }}>—</span>}</Td>
                      <Td>{job ? job["Style"] : <span style={{ color: "#94a3b8" }}>—</span>}</Td>
                      <Td>{job ? `${job["Quantity"]} ${job["Unit"]}` : <span style={{ color: "#94a3b8" }}>—</span>}</Td>
                      <Td>
                        <StatusBadge>
                          <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#059669" }}></span>
                          {row.status}
                        </StatusBadge>
                      </Td>
                      <Td style={{ textAlign: "center" }}>
                        <DownloadButton 
                          onClick={() => downloadJobOrderFirstPage(row)}
                          disabled={!job || downloadingId === row.id}
                        >
                          <FiDownload />
                          {downloadingId === row.id ? "Downloading..." : "PDF Page 1"}
                        </DownloadButton>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </StyledTable>
          </div>
        )}
      </TableContainer>
    </Container>
  );
}
