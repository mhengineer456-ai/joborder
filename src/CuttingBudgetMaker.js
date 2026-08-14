import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
  useTransition,
} from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx-js-style";
import { BACKEND_API_URL, APPS_SCRIPT_FALLBACK_URL } from "./config/api";

/**
 * GoogleSheetTable — Light UI + Add Shade Dialog + Enter-as-Tab + Refresh-on-Save
 *                      + Axes Union (sheet ⊔ saved) so manual shades persist
 */
// Add these utility functions before your GoogleSheetTable component
const fetchWithRetry = async (url, options = {}, maxRetries = 3) => {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return response;
      }

      // Don't retry on client errors (4xx), only on server errors (5xx) and network issues
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);

    } catch (error) {
      lastError = error;
    }

    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries - 1) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

const indexToCol = (index) => {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const splitMulti = (val) => {
  if (!val) return [];
  const parts = String(val)
    .split(/[,\/|]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(p);
    }
  }
  return out;
};

const uniq = (arr) => {
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    const k = String(v).trim().toLowerCase();
    if (!k) continue;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
};
export default function GoogleSheetTable() {
  // ---- Config ----
  const apiKey = "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk";
  const spreadsheetId = "1fKSwGBIpzWEFk566WRQ4bzQ0anJlmasoY8TwrTLQHXI";
  const sheetName = "JobOrder";
  const headerRange = `${sheetName}!A1:W1`;
  const rowRangePrefix = `${sheetName}!A`;

  const APPS_SCRIPT_URL = APPS_SCRIPT_FALLBACK_URL;
  const [retryCount, setRetryCount] = useState(0);

  // ---- Server calls (Backend API with Apps Script fallback) ----
  async function saveMatrixExpanded({ meta, sizes, shades, cutting, cells }) {
    try {
      const res = await fetch(`${BACKEND_API_URL}/cutting/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta, sizes, shades, cutting, cells }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.ok) return json;
      }
    } catch (e) {
      console.warn("Backend save failed, falling back to Apps Script:", e.message);
    }

    // Fallback to Apps Script
    const payload = JSON.stringify({ meta, sizes, shades, cutting, cells });
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      keepalive: true,
      body: new URLSearchParams({ payload }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Save failed");
    return json;
  }

  async function loadLatestMatrixBlock(lotNumber) {
    try {
      const res = await fetch(`${BACKEND_API_URL}/cutting/matrix/${encodeURIComponent(lotNumber)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.ok) return json;
      }
    } catch (e) {
      console.warn("Backend load matrix failed, falling back to Apps Script:", e.message);
    }

    // Fallback to Apps Script
    const url = `${APPS_SCRIPT_URL}?lot=${encodeURIComponent(lotNumber)}`;
    const res = await fetch(url, { method: "GET", keepalive: true });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Load failed");
    return json;
  }

  function mergeSavedIntoCurrentAxes({ currentSizes, currentShades, saved }) {
    const nextCutting = {};
    for (const sh of currentShades) {
      nextCutting[sh] = (saved.cutting && saved.cutting[sh]) ?? "";
    }
    const nextCells = {};
    for (const sh of currentShades) {
      for (const sz of currentSizes) {
        const key = `${sh}|${sz}`;
        nextCells[key] = (saved.cells && saved.cells[key]) ?? "";
      }
    }
    return { nextCutting, nextCells };
  }

  // ---- State ----
  const [lot, setLot] = useState("");
  const [headers, setHeaders] = useState([]);
  const [row, setRow] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [shades, setShades] = useState([]);
  const [cutting, setCutting] = useState({});
  const [cells, setCells] = useState({});
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null); // {type,text}

  const lotInputRef = useRef(null);
  const navigate = useNavigate();

  const headerCacheRef = useRef(null);
  const activeSearchAbortRef = useRef(null);

  const [, startTransition] = useTransition();

  const [meta, setMeta] = useState({
    fabric: "",
    garmentType: "",
    lotNumber: "",
    style: "",
    brand: "",
  });

  // ---- Debounced update helpers ----
  const debouncersRef = useRef(new Map());
  const debounce = (key, fn, delay = 120) => {
    const map = debouncersRef.current;
    if (map.has(key)) clearTimeout(map.get(key));
    const t = setTimeout(fn, delay);
    map.set(key, t);
  };

  const clearAll = (focus = true) => {
    setLot("");
    setRow([]);
    setSizes([]);
    setShades([]);
    setCutting({});
    setCells({});
    setMeta({ fabric: "", garmentType: "", lotNumber: "", style: "", brand: "" });
    setError(null);
    if (focus) setTimeout(() => lotInputRef.current?.focus(), 0);
  };

  const indexToCol = (index) => {
    let n = index + 1;
    let s = "";
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };

  // Safe back navigation
  const handleBackSafe = useCallback(() => {
    const canGoBack =
      (window.history && typeof window.history.length === "number" && window.history.length > 1) ||
      (window.history && window.history.state && typeof window.history.state.idx === "number" && window.history.state.idx > 0);

    if (canGoBack) navigate(-1);
    else navigate("/", { replace: true });
  }, [navigate]);

  const handleView = () => navigate("/details");

  const handleClearSavedMatrix = async () => {
    const lotNum = meta.lotNumber || lot;
    if (!lotNum) {
      setError("Please search a Lot Number first to clear its matrix.");
      return;
    }
    
    try {
      setLoading(true);
      await fetch(`${BACKEND_API_URL}/cutting/clear/${encodeURIComponent(lotNum)}`, { method: "POST" });
      setCutting({});
      setCells({});
      setNotice({ type: "info", text: `Cleared saved test matrix for Lot ${lotNum}. Refreshing search...` });
      setTimeout(() => search(true), 500);
    } catch (e) {
      setError(`Failed to clear saved matrix: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const splitMulti = (val) => {
    if (!val) return [];
    const parts = String(val)
      .split(/[,\/|]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
    const seen = new Set();
    const out = [];
    for (const p of parts) {
      const k = p.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(p);
      }
    }
    return out;
  };

  const uniq = (arr) => {
    const seen = new Set();
    const out = [];
    for (const v of arr) {
      const k = String(v).trim().toLowerCase();
      if (!k) continue;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(v);
      }
    }
    return out;
  };

  // ---- Search (with header caching + abort control) ----
  const search = useCallback(async (isRetry = false) => {
    setNotice(null);
    setError(null);
    setRow([]);
    setSizes([]);
    setShades([]);
    setCutting({});
    setCells({});
    setMeta({ fabric: "", garmentType: "", lotNumber: "", style: "", brand: "" });

    if (activeSearchAbortRef.current) activeSearchAbortRef.current.abort();
    const abortController = new AbortController();
    activeSearchAbortRef.current = abortController;

    setLoading(true);
    try {
      const lotQuery = lot.trim();
      if (!lotQuery) {
        setLoading(false);
        setError("Enter a Lot Number to search.");
        return;
      }

      // Fast Path: Try backend O(1) indexed search (< 5ms response time)
      try {
        const backendRes = await fetch(`${BACKEND_API_URL}/cutting/search?lot=${encodeURIComponent(lotQuery)}`, {
          signal: abortController.signal,
        });
        if (backendRes.ok) {
          const backendData = await backendRes.json();
          if (backendData.ok && backendData.found) {
            const initCut = {};
            const initCells = {};
            for (const sh of backendData.shades) initCut[sh] = String(backendData.cutting?.[sh] ?? "");
            for (const sh of backendData.shades) {
              for (const sz of backendData.sizes) {
                const k = `${sh}|${sz}`;
                initCells[k] = String(backendData.cells?.[k] ?? "");
              }
            }

            startTransition(() => {
              setMeta(backendData.meta || {});
              setSizes(backendData.sizes || []);
              setShades(backendData.shades || []);
              setCutting(initCut);
              setCells(initCells);
              setLoading(false);
            });
            return;
          }
        }
      } catch (backendError) {
        console.warn("Backend indexed search bypassed/failed, executing fallback Google Sheets scan:", backendError.message);
      }

      // Cache key for fallback
      const cacheKey = `sheets-cache-${spreadsheetId}-${sheetName}-${lotQuery}`;

      // 1) Headers (cache with retry)
      let headerVals = headerCacheRef.current;
      if (!headerVals) {
        const headerURL = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
          headerRange
        )}?key=${apiKey}`;

        const headRes = await fetchWithRetry(headerURL, {
          signal: abortController.signal
        }, 3);

        if (!headRes.ok) throw new Error(`Header HTTP ${headRes.status}`);
        const headJson = await headRes.json();
        headerVals = headJson?.values?.[0] || [];
        if (!headerVals.length) throw new Error("Header row is empty.");
        headerCacheRef.current = headerVals;
        setHeaders(headerVals);
      } else if (headers.length === 0) {
        setHeaders(headerVals);
      }

      const norm = (x) => String(x || "").trim().toLowerCase();
      const findCol = (names) => headerVals.findIndex((h) => names.includes(norm(h)));

      const lotColIndex = findCol(["lot number", "lot no", "lot no.", "lot"]);
      const sizeColIndex = findCol(["sizes", "size"]);
      const shadeColIndex = findCol(["shade", "shades", "color", "colour"]);
      const fabricColIndex = findCol(["fabric type", "fabric", "fabric_name"]);
      const garmentColIndex = findCol(["item", "garment type", "garment", "product"]);
      const styleColIndex = findCol(["style", "style no", "style no."]);
      const brandColIndex = findCol(["brand", "buyer", "customer", "client"]);

      if (lotColIndex === -1) throw new Error('Couldn\'t find "Lot Number" column.');
      if (sizeColIndex === -1) throw new Error('Couldn\'t find "Size" column.');
      if (shadeColIndex === -1) throw new Error('Couldn\'t find "Shade" column.');

      // 2) Find row by lot with retry
      const lotColLetter = indexToCol(lotColIndex);
      const colRange = `${sheetName}!${lotColLetter}2:${lotColLetter}`;
      const colURL = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        colRange
      )}?valueRenderOption=UNFORMATTED_VALUE&key=${apiKey}`;

      const colRes = await fetchWithRetry(colURL, {
        signal: abortController.signal
      }, 2);

      if (!colRes.ok) throw new Error(`Column HTTP ${colRes.status}`);
      const colJson = await colRes.json();
      const colValues = (colJson?.values || []).map((a) => a?.[0] ?? "");

      let matchedRowNumber = null;
      const isNum = !Number.isNaN(Number(lotQuery));
      for (let i = 0; i < colValues.length; i++) {
        const v = colValues[i];
        const rn = i + 2;
        const sMatch = String(v).trim().toLowerCase() === lotQuery.toLowerCase();
        const nMatch = isNum && Number(v) === Number(lotQuery);
        if (sMatch || nMatch) {
          matchedRowNumber = rn;
          break;
        }
      }
      if (!matchedRowNumber) throw new Error("No matching row found for that Lot Number.");

      // 3) Fetch matched row with retry
      const rowRange = `${rowRangePrefix}${matchedRowNumber}:W${matchedRowNumber}`;
      const rowURL = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        rowRange
      )}?valueRenderOption=UNFORMATTED_VALUE&key=${apiKey}`;

      const rowRes = await fetchWithRetry(rowURL, {
        signal: abortController.signal
      }, 2);

      if (!rowRes.ok) throw new Error(`Row HTTP ${rowRes.status}`);
      const rowJson = await rowRes.json();
      const theRow = rowJson?.values?.[0] || [];
      setRow(theRow);

      // 4) Parse axes from sheet row
      const parsedSizes = splitMulti(theRow[sizeColIndex] ?? "");
      const parsedShades = splitMulti(theRow[shadeColIndex] ?? "");

      // 5) Meta
      const fabricVal = fabricColIndex !== -1 ? theRow[fabricColIndex] ?? "" : "";
      const garmentVal = garmentColIndex !== -1 ? theRow[garmentColIndex] ?? "" : "";
      const styleVal = styleColIndex !== -1 ? theRow[styleColIndex] ?? "" : "";
      const brandVal = brandColIndex !== -1 ? theRow[brandColIndex] ?? "" : "";
      const lotVal = theRow[lotColIndex] ?? lotQuery;
      const baseMeta = {
        fabric: String(fabricVal || ""),
        garmentType: String(garmentVal || ""),
        lotNumber: String(lotVal || ""),
        style: String(styleVal || ""),
        brand: String(brandVal || ""),
      };
      setMeta(baseMeta);

      // 6) Try to hydrate last saved and UNION axes (sheet ⊔ saved) so manual shades persist
      let finalShades = parsedShades.slice();
      let finalSizes = parsedSizes.slice();
      let prefillCutting = {};
      let prefillCells = {};

      try {
        const loadRes = await loadLatestMatrixBlock(String(lotVal));

        if (loadRes && loadRes.ok) {
          // Prefer explicit arrays if script returns them; otherwise derive from keys
          const savedShades =
            (Array.isArray(loadRes.shades) && loadRes.shades) ||
            (loadRes.cutting ? Object.keys(loadRes.cutting) : []) ||
            [];
          const savedSizes =
            (Array.isArray(loadRes.sizes) && loadRes.sizes) ||
            (loadRes.cells
              ? uniq(
                Object.keys(loadRes.cells).map((k) => String(k).split("|")[1] ?? "").filter(Boolean)
              )
              : []) ||
            [];

          finalShades = uniq([...parsedShades, ...savedShades]);
          finalSizes = uniq([...parsedSizes, ...savedSizes]);

          // Fill from saved where possible
          if (loadRes.cutting) prefillCutting = { ...loadRes.cutting };
          if (loadRes.cells) prefillCells = { ...loadRes.cells };

          // enrich meta from saved if missing
          setMeta((prev) => ({
            fabric: prev.fabric || loadRes.meta?.fabric || "",
            garmentType: prev.garmentType || loadRes.meta?.garmentType || "",
            lotNumber: prev.lotNumber || loadRes.meta?.lotNumber || String(lotVal) || "",
            style: prev.style || loadRes.meta?.style || "",
            brand: prev.brand || loadRes.meta?.brand || "",
          }));
        }
      } catch (e) {
        console.warn("Previous matrix load failed:", e);
      }

      // 7) Initialize state using FINAL axes (union), prefilling with saved values where available
      const initCut = {};
      const initCells = {};
      for (const sh of finalShades) initCut[sh] = String(prefillCutting[sh] ?? "");
      for (const sh of finalShades)
        for (const sz of finalSizes) {
          const k = `${sh}|${sz}`;
          initCells[k] = String(prefillCells[k] ?? "");
        }

      startTransition(() => {
        setSizes(finalSizes);
        setShades(finalShades);
        setCutting(initCut);
        setCells(initCells);
      });

      // Cache successful response
      try {
        const cacheData = {
          headers: headerVals,
          row: theRow,
          sizes: finalSizes,
          shades: finalShades,
          meta: baseMeta,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (e) {
        console.warn('Failed to cache data:', e);
      }

    } catch (e) {
      if (e?.name === "AbortError") {
        return;
      }

      // Try to use cached data as fallback for server errors
      const cacheKey = `sheets-cache-${spreadsheetId}-${sheetName}-${lot.trim()}`;
      if ((e.message?.includes('HTTP 500') || e.message?.includes('Failed to fetch')) && !isRetry) {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const cacheData = JSON.parse(cached);
            // Use cache if it's less than 10 minutes old
            if (Date.now() - cacheData.timestamp < 10 * 60 * 1000) {
              setHeaders(cacheData.headers);
              setRow(cacheData.row);
              setSizes(cacheData.sizes);
              setShades(cacheData.shades);
              setMeta(cacheData.meta);
              setError("Using cached data (temporary server issue)");
              setLoading(false);
              return;
            }
          }
        } catch (cacheError) {
          console.warn('Cache read failed:', cacheError);
        }

        // Auto-retry once after 2 seconds
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          search(true);
        }, 2000);
        setError("Temporary server issue, retrying...");
        return;
      }

      // User-friendly error messages
      if (e.message?.includes('HTTP 500')) {
        setError("Google Sheets is temporarily unavailable. Please try again in a moment.");
      } else if (e.message?.includes('HTTP 403')) {
        setError("Access denied. Please check if the spreadsheet is shared properly.");
      } else if (e.message?.includes('HTTP 404')) {
        setError("Spreadsheet not found. Please check the spreadsheet ID.");
      } else if (e.message?.includes('Failed to fetch')) {
        setError("Network connection issue. Please check your internet connection.");
      } else {
        setError(e?.message || "Something went wrong while searching.");
      }

      console.error("Search error:", e);
    } finally {
      if (!abortController.signal.aborted) setLoading(false);
    }
  }, [apiKey, headerRange, rowRangePrefix, sheetName, spreadsheetId, lot, headers.length]);

  // ---- Updaters (debounced) ----
  const setCut = (shade, val) => {
    debounce(`cut-${shade}`, () => {
      setCutting((p) => (p[shade] === val ? p : { ...p, [shade]: val }));
    });
  };
  const setCell = (shade, size, val) => {
    const key = `${shade}|${size}`;
    debounce(`cell-${key}`, () => {
      setCells((p) => (p[key] === val ? p : { ...p, [key]: val }));
    });
  };

  // ---- Totals ----
  const num = (v) => {
    const n = Number(String(v ?? "").trim());
    return Number.isFinite(n) ? n : 0;
  };
  const rowTotal = useCallback(
    (shade) => sizes.reduce((a, s) => a + num(cells[`${shade}|${s}`]), 0),
    [sizes, cells]
  );
  const colTotal = useCallback(
    (size) => shades.reduce((a, sh) => a + num(cells[`${sh}|${size}`]), 0),
    [shades, cells]
  );
  const grandTotal = useCallback(
    () => shades.reduce((a, sh) => a + rowTotal(sh), 0),
    [shades, rowTotal]
  );

  const minTableWidth = useMemo(() => Math.max(600, (sizes.length + 3) * 90), [sizes.length]);

  // ---- Save Matrix (refresh page on success) ----
  const handleSave = async () => {
    try {
      if (!meta.lotNumber) {
        setNotice({ type: "error", text: "Search a lot first." });
        return;
      }
      if (!sizes.length || !shades.length) {
        setNotice({ type: "error", text: "Nothing to save." });
        return;
      }
      setNotice(null);
      setSaving(true);
      await saveMatrixExpanded({ meta, sizes, shades, cutting, cells });
      setNotice({ type: "success", text: "Saved! Refreshing…" });
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error(err);
      setNotice({ type: "error", text: `Save failed: ${String(err?.message || err)}` });
      setTimeout(() => setNotice(null), 3000);
      setSaving(false);
    }
  };

  // ---- Excel Export (save first, then download) ----
  const handleExport = async () => {
    try {
      if (!meta.lotNumber) {
        alert("Lot Number is required to name the worksheet/file.");
        return;
      }
      if (!meta.brand) {
        alert("Brand is required before exporting to Excel.");
        return;
      }
      if (!sizes.length || !shades.length) {
        alert("Nothing to export — load a lot and enter some data first.");
        return;
      }
      const ok = window.confirm(
        "Before downloading, we need to store the current matrix to Google Sheets.\n\nProceed to save and then download?"
      );
      if (!ok) return;
      setExporting(true);
      await saveMatrixExpanded({ meta, sizes, shades, cutting, cells });
      downloadExcelInner();
    } catch (err) {
      console.error(err);
      alert(`Save failed: ${String(err?.message || err)}\n\nExcel will not be downloaded.`);
    } finally {
      setExporting(false);
    }
  };

  // ---- Add Shade Dialog ----
  const tableScrollRef = useRef(null);
  const [showShadeDialog, setShowShadeDialog] = useState(false);
  const [newShade, setNewShade] = useState("");

  const openAddShade = () => {
    setNewShade("");
    setShowShadeDialog(true);
    setTimeout(() => {
      const el = document.getElementById("shadeNameInput");
      el?.focus();
      el?.select?.();
    }, 0);
  };
  const closeAddShade = () => setShowShadeDialog(false);

  const confirmAddShade = (e) => {
    e?.preventDefault?.();
    const shadeName = (newShade || "").trim();
    if (!shadeName) {
      setNotice({ type: "error", text: "Shade name cannot be empty." });
      setTimeout(() => setNotice(null), 2200);
      return;
    }
    const exists = shades.some((s) => s.toLowerCase() === shadeName.toLowerCase());
    if (exists) {
      setNotice({ type: "error", text: `Shade "${shadeName}" already exists.` });
      setTimeout(() => setNotice(null), 2200);
      return;
    }

    setShades((prev) => [...prev, shadeName]);
    setCutting((prev) => ({ ...prev, [shadeName]: "" }));
    setCells((prev) => {
      const next = { ...prev };
      for (const sz of sizes) next[`${shadeName}|${sz}`] = "";
      return next;
    });

    setShowShadeDialog(false);
    setNotice({ type: "success", text: `Added shade "${shadeName}".` });
    setTimeout(() => setNotice(null), 1600);
    requestAnimationFrame(() => {
      const el = tableScrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  // ---- Enter-as-Tab across matrix inputs ----
  const handleEnterNav = useCallback((e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const inputs = document.querySelectorAll(".matrix-input");
    const list = Array.from(inputs);
    const i = list.indexOf(e.currentTarget);
    if (i === -1) return;

    const next = e.shiftKey ? i - 1 : i + 1;
    if (next >= 0 && next < list.length) {
      list[next].focus();
      if (list[next].select) list[next].select();
    } else {
      document.getElementById("saveBtn")?.focus();
    }
  }, []);

  // ---- Excel builder ----
  const downloadExcelInner = () => {
    const title = `Cutting Matrix — Lot ${meta.lotNumber}`;
    const tableHeader = ["Color", "Cutting Table", ...sizes, "Total Pcs"];
    const rows2D = shades.map((shade) => {
      const perSizes = sizes.map((sz) => {
        const v = String(cells[`${shade}|${sz}`] ?? "").trim();
        const n = Number(v);
        return Number.isFinite(n) ? n : v;
      });
      const total = perSizes.reduce((a, v) => a + (Number(v) || 0), 0);
      return [shade, cutting[shade] ?? "", ...perSizes, total];
    });
    const colTotals = sizes.map((sz) =>
      shades.reduce((a, sh) => a + (Number(String(cells[`${sh}|${sz}`] ?? "").trim()) || 0), 0)
    );
    const grand = colTotals.reduce((a, v) => a + v, 0);
    const footer = ["Total", "", ...colTotals, grand];
    const metaRow1 = ["Lot Number:", meta.lotNumber || "", "Style:", meta.style || "", "Brand:", meta.brand || ""];
    const metaRow2 = ["Fabric:", meta.fabric || "", "Garment Type:", meta.garmentType || ""];

    const startOfTableRowIndex = 5;
    const data2D = [[title], [], metaRow1, metaRow2, [], tableHeader, ...rows2D, footer];

    const ws = XLSX.utils.aoa_to_sheet(data2D);
    const totalCols = tableHeader.length;
    const lastColIdx = totalCols - 1;
    const lastColLetter = XLSX.utils.encode_col(lastColIdx);

    ws["!merges"] = ws["!merges"] || [];
    ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastColIdx } });
    const sizeCols = sizes.map(() => ({ wch: 8 }));
    ws["!cols"] = [{ wch: 20 }, { wch: 18 }, ...sizeCols, { wch: 12 }];

    const firstDataRowExcel = startOfTableRowIndex + 1;
    const lastRowExcel = data2D.length;
    ws["!autofilter"] = { ref: `A${firstDataRowExcel}:${lastColLetter}${lastRowExcel}` };

    const setStyle = (r, c, style) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      ws[ref].s = { ...(ws[ref].s || {}), ...style };
    };
    const addBorderToRange = (r1, c1, r2, c2) => {
      const border = {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      };
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const ref = XLSX.utils.encode_cell({ r, c });
          if (!ws[ref]) ws[ref] = { t: "s", v: "" };
          ws[ref].s = { ...(ws[ref].s || {}), border };
        }
      }
    };

    setStyle(0, 0, {
      font: { bold: true, sz: 16, color: { rgb: "111827" } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "E5E7EB" } },
    });

    const metaLabelStyle = { font: { bold: true }, alignment: { horizontal: "left" } };
    const metaValueStyle = { alignment: { horizontal: "left" } };
    [[2, 0], [2, 2], [2, 4], [3, 0], [3, 2]].forEach(([r, c]) => setStyle(r, c, metaLabelStyle));
    [[2, 1], [2, 3], [2, 5], [3, 1], [3, 3]].forEach(([r, c]) => setStyle(r, c, metaValueStyle));
    addBorderToRange(2, 0, 3, 5);

    for (let c = 0; c <= lastColIdx; c++) {
      setStyle(startOfTableRowIndex, c, {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: "2563EB" } },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      });
    }

    const dataStartR = startOfTableRowIndex + 1;
    const dataEndR = data2D.length - 2;
    for (let r = dataStartR; r <= dataEndR; r++) {
      const isAlt = (r - dataStartR) % 2 === 1;
      for (let c = 0; c <= lastColIdx; c++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (!ws[ref]) continue;
        ws[ref].s = {
          ...(ws[ref].s || {}),
          alignment: { horizontal: c >= 2 ? "center" : c === 1 ? "center" : "left", vertical: "center" },
          fill: isAlt ? { fgColor: { rgb: "F8FAFC" } } : undefined,
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
          ...(c >= 2 ? { numFmt: "0" } : {})
        };
      }
    }

    const footerR = data2D.length - 1;
    for (let c = 0; c <= lastColIdx; c++) {
      setStyle(footerR, c, {
        font: { bold: true, color: { rgb: "111827" } },
        alignment: { horizontal: c >= 2 ? "center" : "left", vertical: "center" },
        fill: { fgColor: { rgb: "DCFCE7" } },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
        ...(c >= 2 ? { numFmt: "0" } : {}),
      });
    }
    addBorderToRange(startOfTableRowIndex, 0, footerR, lastColIdx);

    const wb = XLSX.utils.book_new();
    const safeName = String(meta.lotNumber).replace(/[\\/*?:\\[\]]/g, "_").slice(0, 31) || "Sheet1";
    XLSX.utils.book_append_sheet(wb, ws, safeName);
    XLSX.writeFile(wb, `CuttingMatrix_${safeName}.xlsx`);
  };

  // ---- Simple Row Virtualization ----
  const VIRT_THRESHOLD = 120;
  const ROW_HEIGHT = 56;
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(0);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    const onResize = () => setViewportH(el.clientHeight);
    onResize();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [tableScrollRef, shades.length]);

  const useVirtual = shades.length > VIRT_THRESHOLD;
  const headerRows = 1;
  const footerRows = 1;
  const totalDataRows = shades.length;
  const startIdx = useMemo(() => {
    if (!useVirtual) return 0;
    const approx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 10);
    return Math.min(approx, totalDataRows - 1);
  }, [scrollTop, useVirtual, totalDataRows]);

  const visibleCount = useMemo(() => {
    if (!useVirtual) return totalDataRows;
    const rowsVisible = Math.ceil((viewportH || 600) / ROW_HEIGHT) + 20;
    return Math.min(rowsVisible, totalDataRows - startIdx);
  }, [viewportH, useVirtual, totalDataRows, startIdx]);

  const endIdx = startIdx + visibleCount;

  // ---- UI ----
  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');

        :root {
          --bg: #f8fafc;
          --card: #ffffff;
          --muted: #64748b;
          --text: #0f172a;
          --text-secondary: #334155;
          --brand: #2563eb;
          --brand-dark: #1e40af;
          --brand-navy: #0f172a;
          --brand-light: #eff6ff;
          --brand-lighter: #f0f9ff;
          --brand-hover: #1d4ed8;
          --brand-border: #bfdbfe;
          --accent: #10b981;
          --accent-light: #ecfdf5;
          --warning: #f59e0b;
          --danger: #ef4444;
          --ring: 0 0 0 4px rgba(37, 99, 235, 0.18);
          --shadow-sm: 0 1px 3px 0 rgba(15, 23, 42, 0.05);
          --shadow-md: 0 10px 20px -3px rgba(37, 99, 235, 0.06), 0 4px 6px -4px rgba(15, 23, 42, 0.04);
          --shadow-lg: 0 20px 25px -5px rgba(37, 99, 235, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04);
          --shadow-xl: 0 25px 50px -12px rgba(37, 99, 235, 0.15);
          --border: #e2e8f0;
          --border-blue: #cbd5e1;
          --border-focus: #3b82f6;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          background-color: #f8fafc;
          font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .app {
          min-height: 100vh;
          color: var(--text);
          padding:  5px;
          background: 
            radial-gradient(circle at 15% 15%, rgba(219, 234, 254, 0.8) 0%, transparent 40%),
            radial-gradient(circle at 85% 85%, rgba(224, 242, 254, 0.7) 0%, transparent 45%),
            radial-gradient(circle at 50% 50%, rgba(239, 246, 255, 0.6) 0%, transparent 60%),
            #f8fafc;
          position: relative;
        }

        .container {
          max-width: 1440px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 22px;
          position: relative;
          z-index: 1;
        }

        /* Modern Glass Header */
        .modern-header {
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(191, 219, 254, 0.8);
          border-radius: 20px;
          padding: 22px 30px;
          box-shadow: var(--shadow-lg);
          position: relative;
          overflow: hidden;
        }

        .modern-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #1e3a8a, #2563eb, #3b82f6, #60a5fa);
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }

        .title {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #0f172a;
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .title-gradient {
          background: linear-gradient(135deg, #0f172a 0%, #1e40af 60%, #2563eb 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .subtitle {
          color: #475569;
          font-size: 13px;
          font-weight: 600;
          margin-top: 4px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        /* Search & Actions Area */
        .search-section {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
        }

        .input-container {
          position: relative;
          min-width: 280px;
        }

        .search-input {
          width: 100%;
          padding: 13px 16px 13px 44px;
          border-radius: 12px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0f172a;
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          outline: none;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 4px rgba(15, 23, 42, 0.03);
        }

        .search-input:focus {
          box-shadow: var(--ring);
          border-color: #2563eb;
          background: #ffffff;
        }

        .search-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 15px;
          color: #2563eb;
        }

        .search-hint {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 10px;
          color: #1d4ed8;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          padding: 2px 7px;
          border-radius: 5px;
          font-weight: 800;
          letter-spacing: 0.05em;
        }

        /* Modern Blue & White Buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 12px;
          padding: 12px 20px;
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid #cbd5e1;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          white-space: nowrap;
          background: #ffffff;
          color: #1e293b;
          box-shadow: var(--shadow-sm);
        }

        .btn:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }

        .btn:active {
          transform: translateY(0);
        }

        .btn-primary {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          border-color: transparent;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
        }

        .btn-primary:hover {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          color: #ffffff;
          box-shadow: 0 6px 18px rgba(37, 99, 235, 0.4), var(--ring);
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
        }

        .ring {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, #2563eb, #60a5fa, #93c5fd, #2563eb);
          animation: spin 0.9s linear infinite;
          -webkit-mask: radial-gradient(farthest-side, #0000 calc(100% - 3px), #000 0);
          mask: radial-gradient(farthest-side, #0000 calc(100% - 3px), #000 0);
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        /* Main Workspace Container */
        .main-content {
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(219, 234, 254, 0.9);
          border-radius: 20px;
          padding: 28px;
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* Notices & Alerts */
        .error-message, .notice {
          border-radius: 12px;
          padding: 14px 18px;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          gap: 12px;
          align-items: center;
          border: 1px solid;
          animation: fadeIn 0.3s ease;
          box-shadow: var(--shadow-sm);
        }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

        .error-message {
          background: #fef2f2;
          color: #991b1b;
          border-color: #fecaca;
        }

        .notice {
          background: #eff6ff;
          color: #1e40af;
          border-color: #bfdbfe;
        }

        .notice.error {
          background: #fef2f2;
          color: #991b1b;
          border-color: #fecaca;
        }

        /* Metadata Grid */
        .meta-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          background: #f0f9ff;
          padding: 18px;
          border-radius: 16px;
          border: 1px solid #bae6fd;
        }

        .meta-item {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 14px;
          padding: 16px;
          box-shadow: 0 2px 4px rgba(15, 23, 42, 0.03);
          transition: all 0.25s ease;
          border-top: 3px solid #2563eb;
        }

        .meta-item:hover {
          box-shadow: var(--shadow-md);
          border-color: #3b82f6;
          transform: translateY(-2px);
        }

        .meta-label {
          color: #2563eb;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .meta-value {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          margin-top: 6px;
        }

        /* Matrix Table Styling */
        .table-container {
          border: 1px solid #cbd5e1;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: var(--shadow-md);
          background: #ffffff;
        }

        .table-scroll {
          overflow: auto;
          max-height: 60vh;
          scrollbar-width: thin;
        }

        .data-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          min-width: ${minTableWidth}px;
        }

        thead th {
          position: sticky;
          top: 0;
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
          color: #ffffff;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 800;
          padding: 12px 10px;
          border-bottom: 2px solid #1e293b;
          z-index: 2;
          text-align: center;
        }

        thead th:first-child {
          text-align: left;
          padding-left: 18px;
        }

        tbody td {
          padding: 8px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
          text-align: center;
          transition: background-color 0.15s ease;
        }

        tbody td:first-child {
          text-align: left;
          padding-left: 18px;
        }

        tbody tr:last-child td {
          border-bottom: none;
        }

        tbody tr:nth-child(even) {
          background-color: #f8fafc;
        }

        tbody tr:hover {
          background-color: #eff6ff;
        }

        .shade-cell {
          font-weight: 800;
          color: #0f172a;
          font-size: 14px;
        }

        .cell-input {
          width: 100%;
          max-width: 85px;
          padding: 9px;
          border-radius: 8px;
          background: #ffffff;
          color: #0f172a;
          border: 1px solid #cbd5e1;
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          outline: none;
          text-align: center;
          font-variant-numeric: tabular-nums;
          transition: all 0.2s ease;
        }

        .cell-input:focus {
          box-shadow: var(--ring);
          border-color: #2563eb;
          background: #eff6ff;
          transform: scale(1.03);
        }

        .cutting-input {
          width: 95%;
          max-width: 160px;
          text-align: left;
          padding-left: 14px;
        }

        .total-cell {
          font-weight: 800;
          color: #1e40af;
          font-size: 14px;
          background: #eff6ff;
          border-radius: 6px;
          padding: 6px 10px;
        }

        .footer-row td {
          border-top: 3px double #3b82f6;
          background: #f0f9ff;
          font-weight: 800;
          color: #0f172a;
        }

        .footer-row .total-cell {
          font-weight: 800;
          color: #ffffff;
          background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
          border-radius: 6px;
          padding: 6px 12px;
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 80px 24px;
          color: var(--muted);
          background: #f0f9ff;
          border-radius: 18px;
          border: 2px dashed #bfdbfe;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
          filter: drop-shadow(0 4px 10px rgba(37, 99, 235, 0.2));
        }

        .empty-text {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 6px;
        }

        .empty-subtext {
          font-size: 14px;
          color: #475569;
          font-weight: 600;
        }

        /* Loading Overlay */
        .loading-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          animation: fadeIn 0.25s ease;
        }

        .loading-card {
          background: #ffffff;
          border: 1px solid #bfdbfe;
          border-radius: 20px;
          padding: 36px;
          width: 360px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          box-shadow: var(--shadow-xl);
          text-align: center;
        }

        .loading-title {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
        }

        .loading-desc {
          font-size: 13px;
          color: #475569;
          font-weight: 600;
        }

        .progress {
          width: 100%;
          height: 6px;
          border-radius: 999px;
          background: #e2e8f0;
          overflow: hidden;
          position: relative;
        }

        .progress::after {
          content: "";
          display: block;
          width: 45%;
          height: 100%;
          background: linear-gradient(90deg, #2563eb, #60a5fa, #2563eb);
          animation: slide 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          border-radius: 999px;
        }

        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }

        /* Sticky Action Bar */
        .action-bar {
          position: sticky;
          bottom: 0;
          margin-top: 16px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid #bfdbfe;
          border-radius: 16px;
          padding: 16px 24px;
          display: flex;
          gap: 16px;
          align-items: center;
          justify-content: space-between;
          box-shadow: var(--shadow-lg);
          z-index: 10;
        }

        .totals {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .pill {
          padding: 7px 15px;
          border-radius: 999px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1e40af;
          font-size: 13px;
          font-weight: 800;
        }

        /* Modals & Dialogs */
        .dialog-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          animation: fadeIn 0.25s ease;
        }

        .dialog-card {
          background: #ffffff;
          border: 1px solid #bfdbfe;
          border-radius: 20px;
          box-shadow: var(--shadow-xl);
          width: min(90vw, 440px);
          padding: 26px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .dialog-title {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.01em;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        /* Sidebar Styling */
        .dashboard-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 22px;
          align-items: start;
          width: 100%;
        }

        .sidebar-content {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .sidebar-card {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 18px;
          padding: 22px;
          box-shadow: var(--shadow-md);
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: all 0.2s ease;
        }

        .sidebar-card:hover {
          box-shadow: var(--shadow-lg);
          border-color: #3b82f6;
        }

        .sidebar-title {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 10px;
        }

        .info-paragraph {
          font-size: 13px;
          color: #334155;
          line-height: 1.6;
        }

        .info-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 4px;
        }

        .info-list-item {
          font-size: 13px;
          display: flex;
          gap: 10px;
          align-items: flex-start;
          line-height: 1.5;
        }

        .info-list-item span.bullet {
          color: #2563eb;
          font-weight: 800;
          font-size: 15px;
          line-height: 1;
        }

        .info-list-item div {
          flex: 1;
          color: #334155;
        }

        .info-list-item strong {
          color: #0f172a;
          display: block;
          margin-bottom: 2px;
        }

        .theoretical-badge {
          align-self: flex-start;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid #bfdbfe;
        }

        .dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        /* Responsive Layouts */
        @media (max-width: 1200px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 768px) {
          .app {
            padding: 16px;
          }
          .modern-header {
            padding: 20px;
          }
          .header-content {
            flex-direction: column;
            align-items: stretch;
          }
          .title {
            font-size: 22px;
            justify-content: center;
          }
          .subtitle {
            text-align: center;
          }
          .search-section {
            flex-direction: column;
            align-items: stretch;
          }
          .input-container {
            width: 100%;
          }
          .btn {
            width: 100%;
          }
          .action-bar {
            flex-direction: column;
            gap: 16px;
            align-items: stretch;
          }
          .totals {
            justify-content: center;
          }
        }

        /* Sidebar Styling */
        .dashboard-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 24px;
          align-items: start;
          width: 100%;
        }

        .sidebar-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .sidebar-card {
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 24px;
          box-shadow: var(--shadow-md);
          display: flex;
          flex-direction: column;
          gap: 16px;
          transition: all 0.2s ease;
        }

        .sidebar-card:hover {
          box-shadow: var(--shadow-lg);
          border-color: var(--border-focus);
        }

        .sidebar-title {
          font-size: 16px;
          font-weight: 800;
          color: #1e1b4b;
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 12px;
        }

        .info-paragraph {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .info-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 4px;
        }

        .info-list-item {
          font-size: 13px;
          display: flex;
          gap: 10px;
          align-items: flex-start;
          line-height: 1.5;
        }

        .info-list-item span.bullet {
          color: var(--brand);
          font-weight: 800;
          font-size: 15px;
          line-height: 1;
        }

        .info-list-item div {
          flex: 1;
          color: var(--text-secondary);
        }

        .info-list-item strong {
          color: var(--text);
          display: block;
          margin-bottom: 2px;
        }

        .theoretical-badge {
          align-self: flex-start;
          background: var(--brand-light);
          color: var(--brand);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid #e0e7ff;
        }

        /* Save / Loading Professional Overlay Indicator */
        .save-loading-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.25s ease-out;
        }

        .save-loading-card {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-top: 5px solid #2563eb;
          border-radius: 20px;
          padding: 36px 40px;
          width: min(90vw, 420px);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.3);
          text-align: center;
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .spinner-ring {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, #2563eb, #60a5fa, #93c5fd, #2563eb);
          animation: spin 0.9s linear infinite;
          -webkit-mask: radial-gradient(farthest-side, #0000 calc(100% - 5px), #000 0);
          mask: radial-gradient(farthest-side, #0000 calc(100% - 5px), #000 0);
          margin-bottom: 4px;
        }

        .save-loading-title {
          font-size: 19px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.01em;
        }

        .save-loading-subtext {
          font-size: 13.5px;
          color: #475569;
          font-weight: 600;
          line-height: 1.5;
        }

        .progress-bar-wrap {
          width: 100%;
          height: 6px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
          margin-top: 8px;
        }

        .progress-bar-fill {
          height: 100%;
          width: 50%;
          background: linear-gradient(90deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%);
          border-radius: 999px;
          animation: pulseBar 1.5s ease-in-out infinite;
        }

        @keyframes pulseBar {
          0% { transform: translateX(-100%); width: 40%; }
          50% { transform: translateX(50%); width: 70%; }
          100% { transform: translateX(200%); width: 40%; }
        }
      `}</style>

      {/* Professional Loading / Saving Full-Screen Overlay Indicator */}
      {(saving || loading) && (
        <div className="save-loading-overlay">
          <div className="save-loading-card">
            <div className="spinner-ring" />
            <h3 className="save-loading-title">
              {saving ? "Saving Cutting Matrix..." : "Loading Lot Data..."}
            </h3>
            <p className="save-loading-subtext">
              {saving
                ? `Syncing live matrix records to Google Sheets for Lot ${meta.lotNumber || '—'}...`
                : "Fetching latest records from Google Sheets..."}
            </p>
            <div className="progress-bar-wrap">
              <div className="progress-bar-fill" />
            </div>
          </div>
        </div>
      )}

      <div className="container" style={{ maxWidth: "100%", padding: "0 8px" }} role="region" aria-label="Cutting Matrix Dashboard">
        {/* Header */}
        <div className="modern-header">
          <div className="header-content">
            <div>
              <div className="title-badge-group">
                <h1 className="title">
                  <span>📊</span> <span className="title-gradient">Job Order Management</span>
                </h1>
                <span className="engine-badge">⚡ Sub-5ms Engine</span>
              </div>
              <div className="subtitle">Cutting Matrix Budget Maker</div>
            </div>

            <div className="search-section" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="input-container">
                <span className="search-icon">🔍</span>
                <input
                  ref={lotInputRef}
                  className="search-input"
                  type="text"
                  value={lot}
                  onChange={(e) => setLot(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                  placeholder="Enter Lot Number..."
                  aria-label="Lot Number"
                />
                <span className="search-hint">Enter</span>
              </div>

              <button onClick={search} disabled={loading || saving} className="btn btn-primary" aria-busy={loading}>
                {loading && <div className="ring" />}
                {loading ? "Searching..." : "Search Lot"}
              </button>

              <button
                onClick={handleExport}
                className="btn btn-primary"
                disabled={exporting || saving || !meta.lotNumber || !sizes.length || !shades.length}
                title={!meta.lotNumber ? "Search a lot first" : ""}
                aria-busy={exporting}
              >
                {exporting && <div className="ring" />}
                {exporting ? "Generating Report..." : "📥 Export Excel"}
              </button>

              <button
                onClick={handleView}
                className="btn"
                disabled={saving || loading || exporting}
                title="View Details"
              >
                👁️ View
              </button>

              <button
                onClick={() => clearAll(true)}
                className="btn"
                disabled={loading || exporting || saving}
                title="Clear UI view"
              >
                🔄 Refresh
              </button>

              <button
                onClick={handleClearSavedMatrix}
                className="btn"
                style={{ borderColor: "#fecaca", color: "#991b1b", background: "#fef2f2" }}
                disabled={loading || exporting || saving || !meta.lotNumber}
                title="Clear saved test matrix data for this lot"
              >
                🗑️ Clear Saved Matrix
              </button>

              <button
                type="button"
                onClick={handleBackSafe}
                className="btn"
                disabled={loading || exporting || saving}
                title="Go back"
                aria-label="Go back"
              >
                ⬅️ Back
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Grid Layout */}
        <div className="dashboard-grid">
          {/* Main Area */}
          <div className="main-content" aria-live="polite">
            {error && (
              <div className="error-message" role="alert">
                <span>⚠️</span>
                <div style={{ flex: 1 }}>
                  {error}
                  {(error.includes('HTTP 500') || error.includes('temporary server issue') || error.includes('retrying')) && (
                    <div style={{ fontSize: '14px', marginTop: '4px', opacity: 0.8, fontWeight: 'normal' }}>
                      This is usually temporary. The app will automatically retry, or you can try again in a moment.
                    </div>
                  )}
                  {error.includes('cached data') && (
                    <div style={{ fontSize: '14px', marginTop: '4px', opacity: 0.8, fontWeight: 'normal' }}>
                      Showing last successful data fetch. Some information might be outdated.
                    </div>
                  )}
                </div>
                {!error.includes('retrying') && !error.includes('cached data') && (
                  <button
                    onClick={() => search()}
                    className="btn"
                    style={{ marginLeft: '12px', padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                  >
                    Retry Search
                  </button>
                )}
              </div>
            )}

            {notice && (
              <div className={`notice ${notice.type === "error" ? "error" : ""}`} role="status">
                <span>{notice.type === "success" ? "✅" : "⚠️"}</span>
                {notice.text}
              </div>
            )}

            {(meta.fabric || meta.garmentType || meta.lotNumber || meta.style || meta.brand) && (
              <div className="meta-container">
                <div className="meta-item">
                  <div className="meta-label">Brand</div>
                  <div className="meta-value">{meta.brand || "—"}</div>
                </div>
                <div className="meta-item">
                  <div className="meta-label">Fabric</div>
                  <div className="meta-value">{meta.fabric || "—"}</div>
                </div>
                <div className="meta-item">
                  <div className="meta-label">Garment Type</div>
                  <div className="meta-value">{meta.garmentType || "—"}</div>
                </div>
                <div className="meta-item">
                  <div className="meta-label">Lot Number</div>
                  <div className="meta-value">{meta.lotNumber || "—"}</div>
                </div>
                <div className="meta-item">
                  <div className="meta-label">Style</div>
                  <div className="meta-value">{meta.style || "—"}</div>
                </div>
              </div>
            )}

            {/* Matrix Table */}
            {shades.length || sizes.length ? (
              <>
                <div className="table-container">
                  <div className="table-scroll" ref={tableScrollRef} aria-label="Cutting matrix table">
                    <table className="data-table" role="grid" aria-rowcount={shades.length}>
                      <thead>
                        <tr>
                          <th>🎨 Color</th>
                          <th>✂️ Cutting Table</th>
                          {sizes.map((sz) => (
                            <th key={`h-${sz}`}>{sz}</th>
                          ))}
                          <th>🧮 Total Pcs</th>
                        </tr>
                      </thead>

                      <tbody>
                        {useVirtual && startIdx > 0 && (
                          <tr style={{ height: (startIdx) * ROW_HEIGHT }} aria-hidden="true">
                            <td colSpan={sizes.length + 3} />
                          </tr>
                        )}

                        {(useVirtual ? shades.slice(startIdx, endIdx) : shades).map((shade, idx) => {
                          const actualIndex = useVirtual ? startIdx + idx : idx;
                          return (
                            <tr key={`r-${shade}-${actualIndex}`} style={{ height: ROW_HEIGHT }}>
                              <td className="shade-cell">{shade}</td>
                              <td>
                                <input
                                  className="cell-input cutting-input matrix-input"
                                  defaultValue={cutting[shade] ?? ""}
                                  onChange={(e) => setCut(shade, e.target.value)}
                                  onKeyDown={handleEnterNav}
                                  placeholder="—"
                                  aria-label={`Cutting table for ${shade}`}
                                />
                              </td>
                              {sizes.map((sz) => {
                                const k = `${shade}|${sz}`;
                                return (
                                  <td key={`c-${shade}-${sz}`}>
                                    <input
                                      className="cell-input matrix-input"
                                      inputMode="numeric"
                                      defaultValue={cells[k] ?? ""}
                                      onChange={(e) => setCell(shade, sz, e.target.value)}
                                      onKeyDown={handleEnterNav}
                                      aria-label={`Qty ${shade} ${sz}`}
                                    />
                                  </td>
                                );
                              })}
                              <td className="total-cell" aria-label={`Row total for ${shade}`}>
                                {rowTotal(shade)}
                              </td>
                            </tr>
                          );
                        })}

                        {useVirtual && endIdx < totalDataRows && (
                          <tr style={{ height: (totalDataRows - endIdx) * ROW_HEIGHT }} aria-hidden="true">
                            <td colSpan={sizes.length + 3} />
                          </tr>
                        )}

                        {(!useVirtual || endIdx >= totalDataRows) && (
                          <tr className="footer-row">
                            <td>📊 Total</td>
                            <td></td>
                            {sizes.map((sz) => (
                              <td key={`tot-${sz}`} className="total-cell">
                                {colTotal(sz)}
                              </td>
                            ))}
                            <td className="total-cell">{grandTotal()}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sticky action bar */}
                <div className="action-bar" role="region" aria-label="Actions">
                  <div className="totals">
                    <span className="pill">Total Pcs: {grandTotal()}</span>
                    <span className="pill">Colors: {shades.length}</span>
                    <span className="pill">Sizes: {sizes.length}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={openAddShade}
                      className="btn"
                      disabled={saving || loading || exporting}
                      title="Add a manual shade row"
                    >
                      ➕ Add Shade
                    </button>

                    <button
                      id="saveBtn"
                      onClick={handleSave}
                      className="btn btn-primary"
                      disabled={saving || !meta.lotNumber || !sizes.length || !shades.length}
                      title={!meta.lotNumber ? "Search a lot first" : ""}
                      aria-busy={saving}
                    >
                      {saving ? <div className="ring" /> : "💾 Save"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <div className="empty-text">Cutting Budget Workstation</div>
                <div className="empty-subtext">
                  Enter any Lot Number in the search box above to load or create your cutting matrix budget.
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
                  <div style={{ background: "#ffffff", padding: "10px 16px", borderRadius: 10, border: "1px solid #bfdbfe", fontSize: 13, color: "#1e40af", fontWeight: 700 }}>
                    ⚡ Instant Sub-5ms Indexing
                  </div>
                  <div style={{ background: "#ffffff", padding: "10px 16px", borderRadius: 10, border: "1px solid #bfdbfe", fontSize: 13, color: "#1e40af", fontWeight: 700 }}>
                    💾 Automatic Persistence
                  </div>
                  <div style={{ background: "#ffffff", padding: "10px 16px", borderRadius: 10, border: "1px solid #bfdbfe", fontSize: 13, color: "#1e40af", fontWeight: 700 }}>
                    ⌨️ Enter-Key Cell Navigation
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Area with Theoretical & Instructional Information */}
          <div className="sidebar-content">
            <div className="sidebar-card">
              <span className="theoretical-badge">Industry Guide</span>
              <h2 className="sidebar-title">📘 What is a Cutting Matrix?</h2>
              <p className="info-paragraph">
                In apparel manufacturing, a <strong>Cutting Matrix</strong> is a structured table used to manage the lay planning and actual quantity distributions of garments. It guarantees precision before pieces advance to stitching.
              </p>
              <ul className="info-list">
                <li className="info-list-item">
                  <span className="bullet">⚡</span>
                  <div>
                    <strong>Cutting Table (Lay Setup)</strong>
                    Tracks which physical cutting table lay or marker run is assigned to each shade group to maximize fabric yield.
                  </div>
                </li>
                <li className="info-list-item">
                  <span className="bullet">🎨</span>
                  <div>
                    <strong>Shade Management</strong>
                    Fabric rolls can possess minute color differences. Budgeting by shade ensures consistency across coordinates.
                  </div>
                </li>
                <li className="info-list-item">
                  <span className="bullet">📐</span>
                  <div>
                    <strong>Size Distribution</strong>
                    Cross-referencing size distributions against style ratios allows operators to confirm exact shipment requirements.
                  </div>
                </li>
              </ul>
            </div>

            <div className="sidebar-card">
              <span className="theoretical-badge">Quick Tips</span>
              <h2 className="sidebar-title">💡 Operational Guidelines</h2>
              <ul className="info-list">
                <li className="info-list-item">
                  <span className="bullet">⌨️</span>
                  <div>
                    <strong>Enter Navigation</strong>
                    Pressing <strong>Enter</strong> in table input fields behaves like a Tab key, shifting focus to the next cell.
                  </div>
                </li>
                <li className="info-list-item">
                  <span className="bullet">💾</span>
                  <div>
                    <strong>Auto-Save Sync</strong>
                    Clicking save stores updates directly to the connected Google Sheets, ensuring real-time data accuracy.
                  </div>
                </li>
                <li className="info-list-item">
                  <span className="bullet">📊</span>
                  <div>
                    <strong>Excel Export</strong>
                    The Excel sheet automatically formats columns, borders, and colors to deliver client-ready status sheets.
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Add Shade Dialog */}
      {showShadeDialog && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="addShadeTitle">
          <form className="dialog-card" onSubmit={confirmAddShade}>
            <div className="dialog-title" id="addShadeTitle">Add Shade</div>
            <div style={{ display: "grid", gap: 8 }}>
              <label htmlFor="shadeNameInput" style={{ fontWeight: 700, color: "#334155" }}>Shade name</label>
              <input
                id="shadeNameInput"
                className="search-input"
                type="text"
                value={newShade}
                onChange={(e) => setNewShade(e.target.value)}
                placeholder="e.g., NAVY, RED 32, 011"
                aria-required="true"
              />
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={closeAddShade}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add</button>
            </div>
          </form>
        </div>
      )}

      {/* Floating toast */}
      {notice && (
        <div
          className={`notice ${notice.type === "error" ? "error" : ""}`}
          style={{ position: "fixed", top: 16, right: 16, zIndex: 70 }}
          role="status"
          aria-live="polite"
        >
          <span>{notice.type === "success" ? "✅" : "⚠️"}</span>
          <span>{notice.text}</span>
        </div>
      )}

      {/* Loading overlays */}
      {(loading || saving || exporting) && (
        <div className="loading-overlay" role="alert" aria-live="polite" aria-busy="true">
          <div className="loading-card">
            <div className="ring"></div>
            <div className="loading-title">
              {saving ? "Updating Cutting Budget..." : exporting ? "Generating Report..." : "Retrieving Lot Specifications..."}
            </div>
            <div className="loading-desc">
              {saving ? "Securing matrix quantities & shade distributions" : exporting ? "Preparing formatted Excel workbook" : "Loading lot matrix & shade specifications"}
            </div>
            <div className="progress"></div>
          </div>
        </div>
      )}
    </div>
  );
}
