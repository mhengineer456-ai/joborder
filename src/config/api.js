// Centralized API & Environment Configuration for SalesMH React Frontend

export const BACKEND_API_URL =
  process.env.REACT_APP_BACKEND_URL ||
  'https://joborder-app-backend-production.up.railway.app/api';

export const GOOGLE_API_KEY =
  process.env.REACT_APP_GOOGLE_API_KEY || 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk';

export const JOB_ORDER_SPREADSHEET_ID =
  process.env.REACT_APP_JOB_ORDER_SPREADSHEET_ID || '1fKSwGBIpzWEFk566WRQ4bzQ0anJlmasoY8TwrTLQHXI';

export const CUTTING_SPREADSHEET_ID =
  process.env.REACT_APP_CUTTING_SPREADSHEET_ID || '1Hj3JeJEKB43aYYWv8gk2UhdU6BWuEQfCg5pBlTdBMNA';

export const TRACKING_SPREADSHEET_ID =
  process.env.REACT_APP_TRACKING_SPREADSHEET_ID || '1jTju43L6-M1_f-zl67IMsI-sj7RMiLXOXN6z0vzSyck';

export const APPSCRIPT_CHALLAN_URL =
  process.env.REACT_APP_APPSCRIPT_CHALLAN_URL ||
  'https://script.google.com/macros/s/AKfycbz1k9jfPQ7sbBqJggliaUTcyqSHThkPHSjrP7dfD0nLHXDozD-gIKSad3A9Yp6M1jTJlw/exec';

export const APPSCRIPT_JOB_ORDER_URL =
  process.env.REACT_APP_APPSCRIPT_JOB_ORDER_URL ||
  'https://script.google.com/macros/s/AKfycbxCARYdZJL_BNnZhDHT41Cl_gRQVvIEPlSOFARnLymIKlFvy8k52CCx-RsMtdtTLdvdYw/exec';

export const APPSCRIPT_SALES_ORDER_URL =
  process.env.REACT_APP_APPSCRIPT_SALES_ORDER_URL ||
  'https://script.google.com/macros/s/AKfycbwh24O_HFs9ihShK5ArOOvJOXfPkveX9Tx6VFyaKSNhK0WMT_-TSZoo5p5q_k8ZlDbR/exec';

export const APPSCRIPT_TRACKING_URL =
  process.env.REACT_APP_APPSCRIPT_TRACKING_URL ||
  'https://script.google.com/macros/s/AKfycbzV1WU0QyYN1brvsX1GNttlehah1eQMsgpnBshjRXpf7GxW2KfFJyYNqPGJiclE0NRX/exec';

export const APPSCRIPT_QR_SCAN_URL =
  process.env.REACT_APP_APPSCRIPT_QR_SCAN_URL ||
  'https://script.google.com/macros/s/AKfycbzFNn-bwuxvmGt7tu5SZnBtxRNLlpMa056e5Awi09TBrZkoMJICq6aVEMrILBGfb08uMQ/exec';

export const APPS_SCRIPT_FALLBACK_URL =
  process.env.REACT_APP_APPSCRIPT_PARTA_URL ||
  'https://script.google.com/macros/s/AKfycbxTvtHG8PvIO7joStX6htOoyeQ8l0V1ItzZEEWhNFLxbXyU22KEUCD3rE8Q2TtW7verzQ/exec';
