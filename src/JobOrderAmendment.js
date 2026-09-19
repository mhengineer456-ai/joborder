// src/JobOrderAmendment.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiSearch, FiArrowLeft, FiEdit3, FiSave, FiCheckCircle, FiAlertCircle,
  FiFileText, FiLayers, FiPackage, FiTool, FiTag, FiHash, FiClock,
  FiUser, FiCalendar, FiCheck, FiX, FiRefreshCw, FiPrinter, FiEye,
  FiLock, FiUnlock, FiInfo, FiSliders, FiChevronRight, FiList
} from "react-icons/fi";
import { BACKEND_API_URL } from "./config/api";
import { useAuth } from "./auth/AuthContext";
import "./JobOrderAmendment.css";

const API_KEY = "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk";
const SPREADSHEET_ID = "1fKSwGBIpzWEFk566WRQ4bzQ0anJlmasoY8TwrTLQHXI";
const SHEET_NAME = "JobOrder";
const RANGE = `${SHEET_NAME}!A1:ZZZ`;

const DROPDOWNS_SHEET_ID = "1Frg7kHPiiGeydB02LsGKJ-0UeO8N45-19skJRRvU_Qg";
const DROPDOWNS_TAB = "Parties";

const GAS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzR4FKoU2RIxSGb9gOZhOUUEFIbfwDVPpPYdvcwEMOYQUn0glG2ccyFhfobg_hSgoFeYQ/exec";

const POSITION_TAGS = ["FRONT", "BACK", "RIB", "ARM", "LEFT", "RIGHT", "POCKET", "COLLAR", "HOOD", "GULLA"];

const getPriorityBadgeClass = (priority) => {
  const p = String(priority || "").toUpperCase().trim();
  if (p === "HIGH" || p === "CRITICAL") return "joa-badge-high";
  if (p === "MEDIUM") return "joa-badge-med";
  if (p === "LOW") return "joa-badge-low";
  return "joa-badge-repeat";
};

const normalizeLot = (v) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, "").trim();

const JobOrderAmendment = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Safely attempt useAuth
  let authUser = null;
  try {
    const auth = useAuth();
    authUser = auth?.user;
  } catch (_) {}

  const [lotQuery, setLotQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [originalFormData, setOriginalFormData] = useState(null);
  const [formData, setFormData] = useState({});

  const [lists, setLists] = useState({
    partyName: [], garmentType: [], section: [], season: [],
    emb: [], printing: [], pattern: [], style: [], fabric: [], brand: []
  });

  const [embPositions, setEmbPositions] = useState({
    FRONT: false, BACK: false, RIB: false, ARM: false, LEFT: false,
    RIGHT: false, POCKET: false, COLLAR: false, HOOD: false, GULLA: false, other: ""
  });
  const [printPositions, setPrintPositions] = useState({
    FRONT: false, BACK: false, RIB: false, ARM: false, LEFT: false,
    RIGHT: false, POCKET: false, COLLAR: false, HOOD: false, GULLA: false, other: ""
  });

  const [showEmbModal, setShowEmbModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const [amendmentReason, setAmendmentReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loggedInUser = useMemo(() => {
    if (authUser && authUser.username) return authUser.username;
    try {
      const authRaw = localStorage.getItem("auth_user");
      if (authRaw) {
        const parsed = JSON.parse(authRaw);
        if (parsed?.username) return parsed.username;
      }
    } catch (_) {}
    return (
      localStorage.getItem("mh-user-name") ||
      localStorage.getItem("userName") ||
      localStorage.getItem("user") ||
      "Admin / Production"
    );
  }, [authUser]);

  // Fetch Dropdown options from Parties tab
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${DROPDOWNS_SHEET_ID}/values/${DROPDOWNS_TAB}!A1:Z100?key=${API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        const values = json.values || [];
        if (!values.length) return;

        const headers = values[0] || [];
        const nextLists = {};
        headers.forEach((h, colIdx) => {
          const key = String(h || "").trim();
          const items = values.slice(1).map((r) => String(r[colIdx] || "").trim()).filter(Boolean);
          nextLists[key] = Array.from(new Set(items));
        });
        setLists((prev) => ({ ...prev, ...nextLists }));
      } catch (err) {
        console.warn("Dropdown load warning:", err);
      }
    };
    fetchDropdowns();
  }, []);

  // Fetch all JobOrder records for fast lookup
  const fetchJobOrders = useCallback(async () => {
    setLoading(true);
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(RANGE)}?key=${API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load sheet (HTTP ${res.status})`);
      const json = await res.json();
      const [headers = [], ...rows] = json.values || [];

      const parsed = rows.map((r, rowIdx) => {
        const o = { _rowNumber: rowIdx + 2 };
        headers.forEach((h, i) => {
          o[String(h || "").trim()] = r[i] ?? "";
        });
        return o;
      });

      setRecords(parsed);
      return parsed;
    } catch (err) {
      setErrorMessage(err.message || "Failed to load Job Orders");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobOrders();
  }, [fetchJobOrders]);

  // Load Record into Form
  const loadRecordToForm = useCallback((row) => {
    setSelectedRecord(row);
    const initialData = {
      jobOrderNo: String(row["Job Order No"] || row["JobOrder"] || ""),
      lotNumber: String(row["Lot Number"] || row["Lot No."] || row["Lot"] || ""),
      orderNo: String(row["Order No."] || row["Order No"] || ""),
      date: String(row["Date"] || new Date().toISOString().split("T")[0]),
      partyName: String(row["Party Name"] || ""),
      fabric: String(row["Fabric"] || ""),
      brand: String(row["Brand"] || ""),
      shade: String(row["Shade"] || ""),
      size: String(row["Size"] || ""),
      quantity: String(row["Quantity"] || ""),
      unit: String(row["Unit"] || "PCS"),
      garmentType: String(row["Garment Type"] || ""),
      section: String(row["Section"] || ""),
      season: String(row["Season"] || ""),
      emb: String(row["Emb"] || ""),
      embDetails: String(row["Emb Details"] || row["Embroidery Details"] || ""),
      printing: String(row["Printing"] || ""),
      printingDetails: String(row["Printing Details"] || ""),
      pattern: String(row["Pattern"] || ""),
      style: String(row["Style"] || ""),
      remarks: String(row["Remarks"] || ""),
      directStitching: String(row["Direct Stitching"] || "no").toLowerCase() === "yes" ? "yes" : "no",
      priority: String(row["Priority"] || "MEDIUM"),
      zip: String(row["Zip"] || ""),
      bottomType: String(row["Bottom Type"] || ""),
      tapeLace: String(row["Tape/Lace"] || ""),
      sticker: String(row["Sticker"] || ""),
      bone: String(row["Bone"] || ""),
      collar: String(row["Collar"] || ""),
      fullBaju: String(row["FULL BAJU"] || row["Full Baju"] || "NO"),
      fabricSupervisor: String(row["FABRIC_SUPERVISOR"] || row["Fabric Supervisor"] || ""),
      imageUrl: String(row["Image URL"] || ""),
      submittedBy: String(row["Submitted By"] || ""),
    };

    setFormData(initialData);
    setOriginalFormData(initialData);
    setAmendmentReason("");

    // Hydrate Emb positions
    const embDet = initialData.embDetails;
    const nextEmbPos = { FRONT: false, BACK: false, RIB: false, ARM: false, LEFT: false, RIGHT: false, POCKET: false, COLLAR: false, HOOD: false, GULLA: false, other: "" };
    if (embDet) {
      embDet.split(",").forEach((tok) => {
        const t = tok.trim();
        if (t.startsWith("OTHER:")) nextEmbPos.other = t.slice(6).trim();
        else if (nextEmbPos[t] !== undefined) nextEmbPos[t] = true;
      });
    }
    setEmbPositions(nextEmbPos);

    // Hydrate Print positions
    const prtDet = initialData.printingDetails;
    const nextPrintPos = { FRONT: false, BACK: false, RIB: false, ARM: false, LEFT: false, RIGHT: false, POCKET: false, COLLAR: false, HOOD: false, GULLA: false, other: "" };
    if (prtDet) {
      prtDet.split(",").forEach((tok) => {
        const t = tok.trim();
        if (t.startsWith("OTHER:")) nextPrintPos.other = t.slice(6).trim();
        else if (nextPrintPos[t] !== undefined) nextPrintPos[t] = true;
      });
    }
    setPrintPositions(nextPrintPos);
  }, []);

  // Handle URL prefill or Search
  useEffect(() => {
    const qLot = params.get("lot");
    const qJob = params.get("job");
    if ((qLot || qJob) && records.length) {
      const targetLot = normalizeLot(qLot);
      const targetJob = String(qJob || "").trim().toLowerCase();
      const match = records.find((r) => {
        const rLot = normalizeLot(r["Lot Number"] || r["Lot No."] || r["Lot"]);
        const rJob = String(r["Job Order No"] || "").trim().toLowerCase();
        return (targetLot && rLot === targetLot) || (targetJob && rJob === targetJob);
      });
      if (match) loadRecordToForm(match);
    }
  }, [params, records, loadRecordToForm]);

  // Filtered Records for Sidebar Search List
  const filteredRecords = useMemo(() => {
    if (!lotQuery.trim()) return records.slice(0, 30);
    const q = lotQuery.trim().toLowerCase();
    const normQ = normalizeLot(q);

    return records.filter((r) => {
      const rLot = normalizeLot(r["Lot Number"] || r["Lot No."] || r["Lot"]);
      const rJob = String(r["Job Order No"] || "").trim().toLowerCase();
      const rParty = String(r["Party Name"] || "").trim().toLowerCase();
      const rFabric = String(r["Fabric"] || "").trim().toLowerCase();
      return rLot.includes(normQ) || rJob.includes(q) || rParty.includes(q) || rFabric.includes(q);
    }).slice(0, 40);
  }, [records, lotQuery]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (filteredRecords.length > 0) {
      loadRecordToForm(filteredRecords[0]);
    } else {
      setErrorMessage(`No Job Order found matching "${lotQuery}".`);
    }
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Toggle position chip directly
  const toggleEmbPosition = (key) => {
    const next = { ...embPositions, [key]: !embPositions[key] };
    setEmbPositions(next);
    const picks = Object.entries(next)
      .filter(([k, v]) => (k === "other" ? next.other.trim() : v))
      .map(([k]) => (k === "other" ? `OTHER:${next.other.trim()}` : k));
    handleFieldChange("embDetails", picks.join(", "));
  };

  const togglePrintPosition = (key) => {
    const next = { ...printPositions, [key]: !printPositions[key] };
    setPrintPositions(next);
    const picks = Object.entries(next)
      .filter(([k, v]) => (k === "other" ? next.other.trim() : v))
      .map(([k]) => (k === "other" ? `OTHER:${next.other.trim()}` : k));
    handleFieldChange("printingDetails", picks.join(", "));
  };

  // Compute Modified Fields Diff
  const modifiedFields = useMemo(() => {
    if (!originalFormData) return [];
    const diffs = [];
    const labelMap = {
      brand: "Brand",
      emb: "Embroidery",
      embDetails: "Embroidery Details",
      printing: "Printing",
      printingDetails: "Printing Details",
      pattern: "Pattern",
      style: "Style",
      remarks: "Remarks",
    };

    Object.keys(labelMap).forEach((key) => {
      const oldVal = String(originalFormData[key] ?? "").trim();
      const newVal = String(formData[key] ?? "").trim();
      if (oldVal !== newVal) {
        diffs.push({
          fieldKey: key,
          label: labelMap[key],
          oldValue: oldVal || "—",
          newValue: newVal || "—",
        });
      }
    });

    return diffs;
  }, [originalFormData, formData]);

  // Handle Save / Submit Amendment
  const handleConfirmAmendment = async () => {
    if (!selectedRecord || !originalFormData) return;
    if (!amendmentReason.trim()) {
      alert("Please enter a reason for this amendment.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const timestamp = new Date().toISOString();
    const lotNumber = formData.lotNumber;
    const jobOrderNo = formData.jobOrderNo;

    const payload = {
      action: "amendJobOrder",
      lotNumber,
      jobOrderNo,
      amendedBy: loggedInUser,
      amendmentReason: amendmentReason.trim(),
      timestamp,
      updatedData: {
        ...formData,
        "Last Amended By": loggedInUser,
        "Last Amended At": timestamp,
        "Amendment Reason": amendmentReason.trim(),
      },
      changes: modifiedFields,
    };

    try {
      let success = false;
      try {
        const res = await fetch(`${BACKEND_API_URL}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const j = await res.json();
          if (j && j.success !== false) success = true;
        }
      } catch (backendErr) {
        console.warn("Backend direct action failed, trying GAS endpoint:", backendErr.message);
      }

      if (!success) {
        const res = await fetch(GAS_WEB_APP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `payload=${encodeURIComponent(JSON.stringify(payload))}`,
        });
        if (res.ok) {
          const j = await res.json().catch(() => ({}));
          if (j.success !== false) success = true;
        }
      }

      setSuccessMessage(`Job Order for Lot "${lotNumber}" amended and logged successfully!`);
      setShowReviewModal(false);
      setOriginalFormData({ ...formData });

      fetchJobOrders();
      setTimeout(() => setSuccessMessage(""), 6000);
    } catch (err) {
      console.error("Amendment save error:", err);
      setErrorMessage("Failed to save amendment: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download PDF representation of amended Job Order
  const handleDownloadPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const PAGE_W = doc.internal.pageSize.getWidth();

      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 64, 175);
      doc.text("JOB ORDER (AMENDED COPY)", PAGE_W / 2, 45, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Amended by: ${loggedInUser} | Date: ${new Date().toLocaleDateString("en-IN")}`, PAGE_W / 2, 62, { align: "center" });

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(1);
      doc.line(30, 75, PAGE_W - 30, 75);

      let y = 95;
      const printRow = (label, val, x = 40) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(String(label).toUpperCase() + ":", x, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        doc.text(String(val || "—"), x + 100, y);
      };

      printRow("Lot Number", formData.lotNumber, 40);
      printRow("Job Order No", formData.jobOrderNo, 320);
      y += 20;

      printRow("Party Name", formData.partyName, 40);
      printRow("Order No", formData.orderNo, 320);
      y += 20;

      printRow("Fabric", formData.fabric, 40);
      printRow("Brand", formData.brand, 320);
      y += 20;

      printRow("Garment Type", formData.garmentType, 40);
      printRow("Quantity", `${formData.quantity} ${formData.unit}`, 320);
      y += 20;

      printRow("Shade", formData.shade, 40);
      printRow("Size", formData.size, 320);
      y += 20;

      printRow("Embroidery", formData.emb, 40);
      printRow("Printing", formData.printing, 320);
      y += 20;

      printRow("Pattern", formData.pattern, 40);
      printRow("Style", formData.style, 320);
      y += 25;

      doc.setDrawColor(226, 232, 240);
      doc.line(30, y, PAGE_W - 30, y);
      y += 20;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.text("AMENDMENT SUMMARY & REASON:", 40, y);
      y += 16;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(amendmentReason || "Standard production amendment", 40, y);
      y += 25;

      if (modifiedFields.length) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("MODIFIED FIELDS:", 40, y);
        y += 14;

        modifiedFields.forEach((d) => {
          doc.setFont("helvetica", "normal");
          doc.text(`• ${d.label}: ${d.oldValue} ➔ ${d.newValue}`, 48, y);
          y += 14;
        });
      }

      doc.save(`JobOrder_Amended_${formData.lotNumber || "JO"}.pdf`);
    } catch (err) {
      alert("Failed to generate PDF: " + err.message);
    }
  };

  return (
    <div className="joa-app-wrapper">
      {/* Top Navbar Header */}
      <header className="joa-navbar">
        <div className="joa-nav-left">
          <button className="joa-nav-back" onClick={() => navigate("/dashboard")} title="Back to Dashboard">
            <FiArrowLeft />
          </button>
          <div className="joa-nav-brand">
            <div className="joa-nav-icon">
              <FiEdit3 />
            </div>
            <div>
              <h1 className="joa-nav-title">Job Order Amendment </h1>
              <p className="joa-nav-subtitle">Update authorized specifications with full audit tracking</p>
            </div>
          </div>
        </div>

        <div className="joa-nav-right">
          <div className="joa-user-pill">
            <span className="joa-user-dot" />
            <FiUser className="joa-user-ic" />
            <span>{loggedInUser}</span>
          </div>
        </div>
      </header>

      <div className="joa-master-detail-layout">
        {/* LEFT HAND SIDE: Find & Select Job Order Sidebar */}
        <aside className="joa-sidebar">
          <div className="joa-sidebar-header">
            <div className="joa-sb-title">
              <FiSearch className="joa-sb-icon" />
              <h3>Find & Select Job Order</h3>
            </div>
            <p className="joa-sb-sub">Search by Lot #, Job Order, Party, or Fabric</p>

            <form className="joa-sb-search-form" onSubmit={handleSearchSubmit}>
              <div className="joa-sb-input-wrapper">
                <FiHash className="joa-sb-input-ic" />
                <input
                  className="joa-sb-input"
                  placeholder="Type Lot Number or Party..."
                  value={lotQuery}
                  onChange={(e) => setLotQuery(e.target.value)}
                  autoFocus
                />
                {lotQuery && (
                  <button type="button" className="joa-sb-clear" onClick={() => setLotQuery("")}>
                    <FiX />
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Job Orders List */}
          <div className="joa-sidebar-list">
            <div className="joa-list-count">
              <span><FiList /> {filteredRecords.length} Job Orders Available</span>
              {loading && <FiRefreshCw className="joa-spin" />}
            </div>

            {filteredRecords.length === 0 ? (
              <div className="joa-list-empty">
                No Job Orders match "{lotQuery}"
              </div>
            ) : (
              filteredRecords.map((r, idx) => {
                const lotNo = r["Lot Number"] || r["Lot No."] || r["Lot"] || "—";
                const jobNo = r["Job Order No"] || r["JobOrder"] || "—";
                const party = r["Party Name"] || "Unknown Party";
                const garment = r["Garment Type"] || r["Fabric"] || "";
                const isSelected = selectedRecord && (
                  normalizeLot(selectedRecord["Lot Number"] || selectedRecord["Lot No."] || selectedRecord["Lot"]) === normalizeLot(lotNo)
                );

                return (
                  <div
                    key={idx}
                    className={`joa-list-item ${isSelected ? "selected" : ""}`}
                    onClick={() => loadRecordToForm(r)}
                  >
                    <div className="joa-item-left">
                      <div className="joa-item-lot">#{lotNo}</div>
                      <div className="joa-item-party">{party}</div>
                      <div className="joa-item-sub">
                        <span>JO: {jobNo}</span>
                        {garment && <span>• {garment}</span>}
                      </div>
                    </div>
                    <div className="joa-item-right">
                      <span className={`joa-stat-badge ${getPriorityBadgeClass(r["Priority"])}`}>
                        {r["Priority"] || "MED"}
                      </span>
                      <FiChevronRight className="joa-item-arrow" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* RIGHT HAND SIDE: Job Order Specification Details */}
        <main className="joa-main-content">
          {/* Banner Alerts */}
          {successMessage && (
            <div className="joa-banner joa-banner-success">
              <FiCheckCircle className="joa-banner-icon" />
              <div className="joa-banner-content">{successMessage}</div>
              <button className="joa-banner-btn" onClick={handleDownloadPDF}>
                <FiPrinter /> Download PDF Record
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="joa-banner joa-banner-error">
              <FiAlertCircle className="joa-banner-icon" />
              <div className="joa-banner-content">{errorMessage}</div>
              <button className="joa-banner-close" onClick={() => setErrorMessage("")}>×</button>
            </div>
          )}

          {selectedRecord && originalFormData ? (
            <div className="joa-details-view">
              {/* Top Passport Bar */}
              <div className="joa-passport-bar">
                <div className="joa-passport-item main">
                  <span className="joa-pass-label">LOT NUMBER</span>
                  <span className="joa-pass-val font-mono">#{formData.lotNumber || "—"}</span>
                </div>
                <div className="joa-passport-item">
                  <span className="joa-pass-label">JOB ORDER NO</span>
                  <span className="joa-pass-val">{formData.jobOrderNo || "—"}</span>
                </div>
                <div className="joa-passport-item">
                  <span className="joa-pass-label">PARTY NAME</span>
                  <span className="joa-pass-val highlight">{formData.partyName || "—"}</span>
                </div>
                <div className="joa-passport-item">
                  <span className="joa-pass-label">GARMENT TYPE</span>
                  <span className="joa-pass-val">{formData.garmentType || "—"}</span>
                </div>
                <div className="joa-passport-item">
                  <span className="joa-pass-label">QUANTITY</span>
                  <span className="joa-pass-val">{formData.quantity} {formData.unit}</span>
                </div>
                <div className="joa-passport-item badge-col">
                  <span className="joa-pass-label">PRIORITY</span>
                  <span className={`joa-stat-badge ${getPriorityBadgeClass(formData.priority)}`}>
                    {formData.priority || "MEDIUM"}
                  </span>
                </div>
              </div>

              {/* Split Details Grid: Locked vs Editable */}
              <div className="joa-split-layout">
                {/* LEFT COLUMN inside Details: Read-Only Locked Parameters */}
                <div className="joa-panel joa-panel-locked">
                  <div className="joa-panel-header locked">
                    <div className="joa-panel-title">
                      <FiLock className="joa-icon-locked" />
                      <div>
                        <h3>Locked Parameters</h3>
                        <p>Core order details locked from modification</p>
                      </div>
                    </div>
                    <span className="joa-lock-badge">
                      <FiLock /> Read Only
                    </span>
                  </div>

                  <div className="joa-panel-body">
                    <div className="joa-readonly-grid">
                      <div className="joa-ro-item">
                        <span className="joa-ro-label">Order Date</span>
                        <span className="joa-ro-val">{formData.date || "—"}</span>
                      </div>
                      <div className="joa-ro-item">
                        <span className="joa-ro-label">Order No.</span>
                        <span className="joa-ro-val">{formData.orderNo || "—"}</span>
                      </div>
                      <div className="joa-ro-item">
                        <span className="joa-ro-label">Party Name</span>
                        <span className="joa-ro-val">{formData.partyName || "—"}</span>
                      </div>
                      <div className="joa-ro-item">
                        <span className="joa-ro-label">Fabric Specification</span>
                        <span className="joa-ro-val">{formData.fabric || "—"}</span>
                      </div>
                      <div className="joa-ro-item">
                        <span className="joa-ro-label">Garment Type</span>
                        <span className="joa-ro-val">{formData.garmentType || "—"}</span>
                      </div>
                      <div className="joa-ro-item">
                        <span className="joa-ro-label">Gender / Section</span>
                        <span className="joa-ro-val">{formData.section || "—"}</span>
                      </div>
                      <div className="joa-ro-item">
                        <span className="joa-ro-label">Season</span>
                        <span className="joa-ro-val">{formData.season || "—"}</span>
                      </div>
                      <div className="joa-ro-item">
                        <span className="joa-ro-label">Quantity & Unit</span>
                        <span className="joa-ro-val">{formData.quantity} {formData.unit}</span>
                      </div>
                      <div className="joa-ro-item">
                        <span className="joa-ro-label">Full Baju</span>
                        <span className="joa-ro-val">{formData.fullBaju || "NO"}</span>
                      </div>
                      <div className="joa-ro-item">
                        <span className="joa-ro-label">Fabric Supervisor</span>
                        <span className="joa-ro-val">{formData.fabricSupervisor || "—"}</span>
                      </div>
                      <div className="joa-ro-item full-width">
                        <span className="joa-ro-label">Shades & Combinations</span>
                        <span className="joa-ro-val font-mono">{formData.shade || "—"}</span>
                      </div>
                      <div className="joa-ro-item full-width">
                        <span className="joa-ro-label">Size Specification</span>
                        <span className="joa-ro-val">{formData.size || "—"}</span>
                      </div>
                    </div>

                    {/* Trims Card */}
                    <div className="joa-subcard-locked">
                      <h4 className="joa-subcard-title">Trims & Accessories (Locked)</h4>
                      <div className="joa-trims-grid">
                        <div className="joa-trim-chip"><span className="t-lbl">ZIP:</span> <span className="t-val">{formData.zip || "NO"}</span></div>
                        <div className="joa-trim-chip"><span className="t-lbl">BOTTOM:</span> <span className="t-val">{formData.bottomType || "Normal"}</span></div>
                        <div className="joa-trim-chip"><span className="t-lbl">STICKER:</span> <span className="t-val">{formData.sticker || "NO"}</span></div>
                        <div className="joa-trim-chip"><span className="t-lbl">BONE:</span> <span className="t-val">{formData.bone || "NO"}</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN inside Details: Editable Specifications */}
                <div className="joa-panel joa-panel-editable">
                  <div className="joa-panel-header editable">
                    <div className="joa-panel-title">
                      <FiSliders className="joa-icon-editable" />
                      <div>
                        <h3>Editable Specifications</h3>
                        <p>Modify Brand, Emb, Printing, Pattern, Style, Remarks</p>
                      </div>
                    </div>
                    <span className="joa-edit-badge">
                      <FiUnlock /> Editable Access
                    </span>
                  </div>

                  <div className="joa-panel-body">
                    {/* Brand & Identity */}
                    <div className="joa-field-card">
                      <div className="joa-field-header">
                        <label className="joa-field-label">
                          <FiTag /> BRAND NAME
                        </label>
                        {originalFormData.brand !== formData.brand && (
                          <span className="joa-diff-tag">MODIFIED</span>
                        )}
                      </div>
                      <input
                        list="dl-brand"
                        className={`joa-edit-input ${originalFormData.brand !== formData.brand ? "is-changed" : ""}`}
                        value={formData.brand || ""}
                        onChange={(e) => handleFieldChange("brand", e.target.value)}
                        placeholder="Select or enter Brand name..."
                      />
                      <datalist id="dl-brand">
                        {(lists.brand || lists["Brand"] || []).map((item, idx) => (
                          <option key={idx} value={item} />
                        ))}
                      </datalist>
                    </div>

                    {/* Pattern & Style Grid */}
                    <div className="joa-form-row">
                      <div className="joa-field-card">
                        <div className="joa-field-header">
                          <label className="joa-field-label">
                            <FiLayers /> PATTERN
                          </label>
                          {originalFormData.pattern !== formData.pattern && (
                            <span className="joa-diff-tag">MODIFIED</span>
                          )}
                        </div>
                        <input
                          list="dl-pattern"
                          className={`joa-edit-input ${originalFormData.pattern !== formData.pattern ? "is-changed" : ""}`}
                          value={formData.pattern || ""}
                          onChange={(e) => handleFieldChange("pattern", e.target.value)}
                          placeholder="e.g. Cut & Sew, Raglan"
                        />
                        <datalist id="dl-pattern">
                          {(lists.pattern || lists["Pattern"] || []).map((item, idx) => (
                            <option key={idx} value={item} />
                          ))}
                        </datalist>
                      </div>

                      <div className="joa-field-card">
                        <div className="joa-field-header">
                          <label className="joa-field-label">
                            <FiPackage /> STYLE
                          </label>
                          {originalFormData.style !== formData.style && (
                            <span className="joa-diff-tag">MODIFIED</span>
                          )}
                        </div>
                        <input
                          list="dl-style"
                          className={`joa-edit-input ${originalFormData.style !== formData.style ? "is-changed" : ""}`}
                          value={formData.style || ""}
                          onChange={(e) => handleFieldChange("style", e.target.value)}
                          placeholder="e.g. Hooded, Round Neck"
                        />
                        <datalist id="dl-style">
                          {(lists.style || lists["Style"] || []).map((item, idx) => (
                            <option key={idx} value={item} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    {/* Embroidery Section */}
                    <div className="joa-field-card highlight-card">
                      <div className="joa-field-header">
                        <label className="joa-field-label">
                          <FiTool /> EMBROIDERY DETAILS
                        </label>
                        {originalFormData.emb !== formData.emb && (
                          <span className="joa-diff-tag">MODIFIED</span>
                        )}
                      </div>
                      <input
                        className={`joa-edit-input ${originalFormData.emb !== formData.emb ? "is-changed" : ""}`}
                        value={formData.emb || ""}
                        onChange={(e) => handleFieldChange("emb", e.target.value)}
                        placeholder="e.g. Chest Logo Embroidery, High Density"
                      />

                      {/* Interactive Embroidery Placement Chips */}
                      <div className="joa-position-block">
                        <div className="joa-pos-subhead">
                          <span>Embroidery Placement Positions:</span>
                          <button type="button" className="joa-text-btn" onClick={() => setShowEmbModal(true)}>
                            More Positions / Custom
                          </button>
                        </div>
                        <div className="joa-chip-group">
                          {POSITION_TAGS.map((pos) => {
                            const active = !!embPositions[pos];
                            return (
                              <button
                                key={pos}
                                type="button"
                                className={`joa-interactive-chip ${active ? "active" : ""}`}
                                onClick={() => toggleEmbPosition(pos)}
                              >
                                {active && <FiCheck />} {pos}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Printing Section */}
                    <div className="joa-field-card highlight-card">
                      <div className="joa-field-header">
                        <label className="joa-field-label">
                          <FiPrinter /> PRINTING DETAILS
                        </label>
                        {originalFormData.printing !== formData.printing && (
                          <span className="joa-diff-tag">MODIFIED</span>
                        )}
                      </div>
                      <input
                        className={`joa-edit-input ${originalFormData.printing !== formData.printing ? "is-changed" : ""}`}
                        value={formData.printing || ""}
                        onChange={(e) => handleFieldChange("printing", e.target.value)}
                        placeholder="e.g. Plastisol Back Print, Rubber Gel"
                      />

                      {/* Interactive Printing Placement Chips */}
                      <div className="joa-position-block">
                        <div className="joa-pos-subhead">
                          <span>Printing Placement Positions:</span>
                          <button type="button" className="joa-text-btn" onClick={() => setShowPrintModal(true)}>
                            More Positions / Custom
                          </button>
                        </div>
                        <div className="joa-chip-group">
                          {POSITION_TAGS.map((pos) => {
                            const active = !!printPositions[pos];
                            return (
                              <button
                                key={pos}
                                type="button"
                                className={`joa-interactive-chip ${active ? "active" : ""}`}
                                onClick={() => togglePrintPosition(pos)}
                              >
                                {active && <FiCheck />} {pos}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Remarks & Reason */}
                    <div className="joa-field-card">
                      <div className="joa-field-header">
                        <label className="joa-field-label">
                          <FiFileText /> GENERAL REMARKS
                        </label>
                        {originalFormData.remarks !== formData.remarks && (
                          <span className="joa-diff-tag">MODIFIED</span>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        className={`joa-edit-textarea ${originalFormData.remarks !== formData.remarks ? "is-changed" : ""}`}
                        value={formData.remarks || ""}
                        onChange={(e) => handleFieldChange("remarks", e.target.value)}
                        placeholder="Add any special production instructions or buyer notes..."
                      />
                    </div>

                    <div className="joa-field-card reason-card">
                      <label className="joa-field-label required">
                        <FiAlertCircle /> REASON FOR AMENDMENT (AUDIT REQUIRED) *
                      </label>
                      <input
                        className="joa-reason-input"
                        placeholder="State reason (e.g. Buyer updated brand logo, changed embroidery position)..."
                        value={amendmentReason}
                        onChange={(e) => setAmendmentReason(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State when no record selected */
            <div className="joa-empty-state">
              <div className="joa-empty-icon">
                <FiSearch />
              </div>
              <h3>Select a Job Order</h3>
              <p>Choose a Job Order from the list on the left to view and amend specifications.</p>
            </div>
          )}
        </main>
      </div>

      {/* Floating Live Action Bar */}
      {selectedRecord && modifiedFields.length > 0 && (
        <div className="joa-floating-bar">
          <div className="joa-bar-left">
            <span className="joa-mod-count">{modifiedFields.length}</span>
            <div>
              <div className="joa-bar-title">{modifiedFields.length} Field{modifiedFields.length > 1 ? "s" : ""} Modified</div>
              <div className="joa-bar-sub">Ready to be committed to JobOrder sheet</div>
            </div>
          </div>

          <div className="joa-bar-right">
            <button
              type="button"
              className="joa-bar-btn ghost"
              onClick={() => setFormData({ ...originalFormData })}
            >
              Reset Changes
            </button>
            <button
              type="button"
              className="joa-bar-btn primary"
              onClick={() => setShowReviewModal(true)}
            >
              <FiSave /> Review & Confirm Amendments
            </button>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="joa-modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="joa-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="joa-dialog-header">
              <div>
                <h3>Confirm Job Order Amendments</h3>
                <p>Review modified fields before submitting changes to Google Sheets</p>
              </div>
              <button className="joa-dialog-close" onClick={() => setShowReviewModal(false)}>×</button>
            </div>

            <div className="joa-dialog-body">
              <div className="joa-summary-box">
                <div><strong>Lot Number:</strong> #{formData.lotNumber}</div>
                <div><strong>Job Order No:</strong> {formData.jobOrderNo}</div>
                <div><strong>Amended By:</strong> {loggedInUser}</div>
              </div>

              <table className="joa-review-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Original Value</th>
                    <th>New Amended Value</th>
                  </tr>
                </thead>
                <tbody>
                  {modifiedFields.map((d, i) => (
                    <tr key={i}>
                      <td className="f-name">{d.label}</td>
                      <td className="f-old">{d.oldValue}</td>
                      <td className="f-new">{d.newValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="joa-modal-reason">
                <label>Reason for Amendment *</label>
                <input
                  className="joa-edit-input"
                  value={amendmentReason}
                  onChange={(e) => setAmendmentReason(e.target.value)}
                  placeholder="Enter reason for audit record..."
                />
              </div>
            </div>

            <div className="joa-dialog-footer">
              <button className="joa-bar-btn ghost" onClick={() => setShowReviewModal(false)}>
                Cancel
              </button>
              <button
                className="joa-bar-btn primary"
                disabled={isSubmitting || !amendmentReason.trim()}
                onClick={handleConfirmAmendment}
              >
                {isSubmitting ? "Submitting Amendments..." : "Commit & Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extended Emb Modal */}
      {showEmbModal && (
        <div className="joa-modal-overlay" onClick={() => setShowEmbModal(false)}>
          <div className="joa-dialog sm" onClick={(e) => e.stopPropagation()}>
            <div className="joa-dialog-header">
              <h3>Embroidery Placement Positions</h3>
              <button className="joa-dialog-close" onClick={() => setShowEmbModal(false)}>×</button>
            </div>
            <div className="joa-dialog-body">
              <div className="joa-pos-grid-modal">
                {POSITION_TAGS.map((k) => (
                  <label key={k} className="joa-pos-check-item">
                    <input
                      type="checkbox"
                      checked={!!embPositions[k]}
                      onChange={(e) => setEmbPositions((prev) => ({ ...prev, [k]: e.target.checked }))}
                    />
                    <span>{k}</span>
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <label className="joa-field-label">Custom Embroidery Placement</label>
                <input
                  className="joa-edit-input"
                  value={embPositions.other}
                  onChange={(e) => setEmbPositions((prev) => ({ ...prev, other: e.target.value }))}
                  placeholder="Describe custom placement..."
                />
              </div>
            </div>
            <div className="joa-dialog-footer">
              <button
                className="joa-bar-btn primary"
                onClick={() => {
                  const picks = Object.entries(embPositions)
                    .filter(([k, v]) => (k === "other" ? embPositions.other.trim() : v))
                    .map(([k]) => (k === "other" ? `OTHER:${embPositions.other.trim()}` : k));
                  handleFieldChange("embDetails", picks.join(", "));
                  setShowEmbModal(false);
                }}
              >
                Save Placement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extended Print Modal */}
      {showPrintModal && (
        <div className="joa-modal-overlay" onClick={() => setShowPrintModal(false)}>
          <div className="joa-dialog sm" onClick={(e) => e.stopPropagation()}>
            <div className="joa-dialog-header">
              <h3>Printing Placement Positions</h3>
              <button className="joa-dialog-close" onClick={() => setShowPrintModal(false)}>×</button>
            </div>
            <div className="joa-dialog-body">
              <div className="joa-pos-grid-modal">
                {POSITION_TAGS.map((k) => (
                  <label key={k} className="joa-pos-check-item">
                    <input
                      type="checkbox"
                      checked={!!printPositions[k]}
                      onChange={(e) => setPrintPositions((prev) => ({ ...prev, [k]: e.target.checked }))}
                    />
                    <span>{k}</span>
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <label className="joa-field-label">Custom Printing Placement</label>
                <input
                  className="joa-edit-input"
                  value={printPositions.other}
                  onChange={(e) => setPrintPositions((prev) => ({ ...prev, other: e.target.value }))}
                  placeholder="Describe custom placement..."
                />
              </div>
            </div>
            <div className="joa-dialog-footer">
              <button
                className="joa-bar-btn primary"
                onClick={() => {
                  const picks = Object.entries(printPositions)
                    .filter(([k, v]) => (k === "other" ? printPositions.other.trim() : v))
                    .map(([k]) => (k === "other" ? `OTHER:${printPositions.other.trim()}` : k));
                  handleFieldChange("printingDetails", picks.join(", "));
                  setShowPrintModal(false);
                }}
              >
                Save Placement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobOrderAmendment;
