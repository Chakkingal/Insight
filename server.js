const express = require("express");
const path = require("path");
const fetch = require("node-fetch");
const Papa = require("papaparse");

const app = express();
const PORT = process.env.PORT || 3000;

// =============================
// GOOGLE SHEET LINKS (HIDDEN HERE)
// =============================
const SHEETS = {
  expenseCSV:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTb3NBRMu37zvWtTBeiDzHD1h15mhU2UmH8kKYofKbfPQ3QIZRKhYjiZWH41xQfURepbIE7W2pF0Nt-/pub?gid=980089094&single=true&output=csv",

  receiptCSV:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTb3NBRMu37zvWtTBeiDzHD1h15mhU2UmH8kKYofKbfPQ3QIZRKhYjiZWH41xQfURepbIE7W2pF0Nt-/pub?gid=2012196942&single=true&output=csv",

  contraCSV:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTb3NBRMu37zvWtTBeiDzHD1h15mhU2UmH8kKYofKbfPQ3QIZRKhYjiZWH41xQfURepbIE7W2pF0Nt-/pub?gid=1047506309&single=true&output=csv"
};

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Helper: fetch csv and convert to JSON
async function fetchCSVasJSON(url) {
  const response = await fetch(url);
  const csvText = await response.text();

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true
  });

  return parsed.data;
}

// API: expense
app.get("/api/expense", async (req, res) => {
  try {
    const data = await fetchCSVasJSON(SHEETS.expenseCSV);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to load expense data" });
  }
});

// API: receipt
app.get("/api/receipt", async (req, res) => {
  try {
    const data = await fetchCSVasJSON(SHEETS.receiptCSV);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to load receipt data" });
  }
});

// API: contra
app.get("/api/contra", async (req, res) => {
  try {
    const data = await fetchCSVasJSON(SHEETS.contraCSV);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to load contra data" });
  }
});

// Default route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("✅ Insight Dashboard running on port:", PORT);
});
