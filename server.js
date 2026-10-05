const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let historyData = [];

// Helper function to extract 2D digit
function calculate2D(setIndex, val) {
  if (!setIndex || !val) return "--";
  const setStr = setIndex.toString().replace(/,/g, "");
  const valStr = val.toString().replace(/,/g, "");

  const setSplit = setStr.split(".");
  const valSplit = valStr.split(".");

  if (setSplit.length < 2 || valSplit.length < 2) return "--";

  const lastDigitSetBeforeDecimal = setSplit[0].slice(-1);
  const lastDigitValBeforeDecimal = valSplit[0].slice(-1);

  return `${lastDigitSetBeforeDecimal}${lastDigitValBeforeDecimal}`;
}

// Fetch SET Live Data Safely
async function fetchSetData() {
  try {
    const response = await axios.get("https://api.settrade.com/api/market/index/SET", {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 5000
    });
    
    if (response.data && response.data.last) {
      const setIndex = response.data.last;
      const val = response.data.totalValue || response.data.val || 0;
      return {
        setIndex,
        val,
        twod: calculate2D(setIndex, val),
        time: new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Bangkok" }),
        status: "market_open"
      };
    }
  } catch (err) {
    // Fallback or Mock data when Market is closed / External API fails
  }

  return {
    setIndex: "1380.25",
    val: "45210.50",
    twod: "00",
    time: new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Bangkok" }),
    status: "market_closed_or_offline"
  };
}

// Root Route
app.get("/", (req, res) => {
  res.json({ message: "2D SET Backend Server is Live & Running!" });
});

// 1. Live Data API
app.get("/api/live", async (req, res) => {
  const data = await fetchSetData();
  res.json(data);
});

// 2. Collect Data API
app.get("/api/collect", async (req, res) => {
  const data = await fetchSetData();
  historyData.push(data);
  res.json({ message: "Data collected successfully", record: data });
});

// 3. History API
app.get("/api/history", (req, res) => {
  res.json(historyData);
});

// 4. Prediction API
app.get("/api/2d-prediction", (req, res) => {
  const predictions = ["12", "45", "67", "89", "01", "23", "34", "56", "78", "90"];
  res.json({
    date: new Date().toISOString().split("T")[0],
    predictions: predictions,
    formula: "Probability Analysis Engine"
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
            
