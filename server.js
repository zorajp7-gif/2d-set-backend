const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const SET_API_URL =
  "https://api.settrade.com/api/market/SET/info";

const HISTORY_FILE = path.join(__dirname, "history.json");

// =====================================================
// HISTORY STORAGE
// =====================================================

function loadHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) {
      return [];
    }

    const data = fs.readFileSync(HISTORY_FILE, "utf8");

    if (!data.trim()) {
      return [];
    }

    return JSON.parse(data);
  } catch (error) {
    console.error("History load error:", error.message);
    return [];
  }
}

function saveHistory(history) {
  try {
    // Keep latest 20,000 records
    const limited = history.slice(-20000);

    fs.writeFileSync(
      HISTORY_FILE,
      JSON.stringify(limited, null, 2)
    );
  } catch (error) {
    console.error("History save error:", error.message);
  }
}

// =====================================================
// 2D CALCULATION
// =====================================================

function calculate2D(setLast, setValue) {
  if (
    setLast === undefined ||
    setLast === null ||
    setValue === undefined ||
    setValue === null
  ) {
    return null;
  }

  const setString = String(setLast);
  const valueString = String(setValue);

  // SET decimal last digit
  let setDigit = null;

  if (setString.includes(".")) {
    const decimalPart = setString.split(".")[1];

    if (decimalPart && decimalPart.length > 0) {
      setDigit = decimalPart[decimalPart.length - 1];
    }
  }

  // Value/Volume integer last digit
  const integerPart = valueString.split(".")[0];

  if (!integerPart || !/\d/.test(integerPart)) {
    return null;
  }

  const cleanInteger = integerPart.replace(/\D/g, "");

  if (!cleanInteger) {
    return null;
  }

  const valueDigit =
    cleanInteger[cleanInteger.length - 1];

  if (setDigit === null) {
    return null;
  }

  return `${setDigit}${valueDigit}`;
}

// =====================================================
// GET SET DATA
// =====================================================

async function getSetData() {
  try {
    const response = await axios.get(SET_API_URL, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });

    const data = response.data;

    /*
      SET API response structures can change.
      We try several common field names.
    */

    const setLast =
      data?.last ??
      data?.lastPrice ??
      data?.index ??
      data?.market?.last ??
      data?.data?.last;

    const setValue =
      data?.value ??
      data?.totalValue ??
      data?.marketValue ??
      data?.market?.value ??
      data?.data?.value;

    const volume =
      data?.volume ??
      data?.totalVolume ??
      data?.market?.volume ??
      data?.data?.volume;

    const open =
      data?.open ??
      data?.market?.open ??
      data?.data?.open;

    const high =
      data?.high ??
      data?.market?.high ??
      data?.data?.high;

    const low =
      data?.low ??
      data?.market?.low ??
      data?.data?.low;

    const change =
      data?.change ??
      data?.market?.change ??
      data?.data?.change;

    const changePercent =
      data?.changePercent ??
      data?.percentChange ??
      data?.market?.changePercent ??
      data?.data?.changePercent;

    if (
      setLast === undefined ||
      setLast === null ||
      setValue === undefined ||
      setValue === null
    ) {
      throw new Error(
        "SET API response does not contain expected price/value fields"
      );
    }

    const twoD = calculate2D(setLast, setValue);

    return {
      setLast: String(setLast),
      setValue: String(setValue),
      volume:
        volume !== undefined && volume !== null
          ? String(volume)
          : null,
      open:
        open !== undefined && open !== null
          ? String(open)
          : null,
      high:
        high !== undefined && high !== null
          ? String(high)
          : null,
      low:
        low !== undefined && low !== null
          ? String(low)
          : null,
      change:
        change !== undefined && change !== null
          ? String(change)
          : null,
      changePercent:
        changePercent !== undefined &&
        changePercent !== null
          ? String(changePercent)
          : null,
      twoD
    };
  } catch (error) {
    console.error("SET API error:", error.message);
    throw error;
  }
}

// =====================================================
// DIGIT HELPERS
// =====================================================

function getSetDigit(setLast) {
  const str = String(setLast);

  if (!str.includes(".")) {
    return null;
  }

  const decimal = str.split(".")[1];

  if (!decimal || decimal.length === 0) {
    return null;
  }

  return Number(decimal[decimal.length - 1]);
}

function getValueDigit(setValue) {
  const str = String(setValue);

  const integerPart = str.split(".")[0];

  const clean = integerPart.replace(/\D/g, "");

  if (!clean) {
    return null;
  }

  return Number(clean[clean.length - 1]);
}

// =====================================================
// DIGIT FREQUENCY
// =====================================================

function createDigitCounts() {
  return {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0
  };
}

function calculateDigitProbability(history, type) {
  const counts = createDigitCounts();

  let total = 0;

  for (const item of history) {
    let digit = null;

    if (type === "set") {
      digit = getSetDigit(item.setLast);
    }

    if (type === "value") {
      digit = getValueDigit(item.setValue);
    }

    if (
      digit !== null &&
      digit >= 0 &&
      digit <= 9
    ) {
      counts[digit]++;
      total++;
    }
  }

  /*
    Laplace smoothing.
    This prevents a digit from getting exactly 0%.
  */

  const smoothedTotal = total + 10;

  const probability = {};

  for (let i = 0; i <= 9; i++) {
    probability[i] =
      (counts[i] + 1) / smoothedTotal;
  }

  return {
    counts,
    probability,
    total
  };
}

// =====================================================
// HISTORICAL 2D PATTERN
// =====================================================

function calculate2DHistory(history) {
  const counts = {};

  for (let i = 0; i <= 99; i++) {
    counts[String(i).padStart(2, "0")] = 0;
  }

  let total = 0;

  for (const item of history) {
    if (
      item.twoD &&
      /^\d{2}$/.test(String(item.twoD))
    ) {
      counts[String(item.twoD)]++;
      total++;
    }
  }

  return {
    counts,
    total
  };
}

// =====================================================
// TREND SCORE
// =====================================================

function calculateTrendScore(history) {
  if (history.length < 2) {
    return 50;
  }

  const recent = history.slice(-20);

  let positive = 0;
  let negative = 0;

  for (let i = 1; i < recent.length; i++) {
    const previous = Number(recent[i - 1].setLast);
    const current = Number(recent[i].setLast);

    if (
      Number.isFinite(previous) &&
      Number.isFinite(current)
    ) {
      if (current > previous) {
        positive++;
      } else if (current < previous) {
        negative++;
      }
    }
  }

  const total = positive + negative;

  if (total === 0) {
    return 50;
  }

  return Math.round(
    (positive / total) * 100
  );
}

// =====================================================
// 2D PREDICTION ENGINE
// =====================================================

function calculate2DPrediction(history) {
  const setStats =
    calculateDigitProbability(history, "set");

  const valueStats =
    calculateDigitProbability(history, "value");

  const twoDHistory =
    calculate2DHistory(history);

  const trendScore =
    calculateTrendScore(history);

  const results = [];

  /*
    Generate all 00-99 combinations
  */

  for (let first = 0; first <= 9; first++) {
    for (let second = 0; second <= 9; second++) {
      const number =
        `${first}${second}`;

      const setProbability =
        setStats.probability[first];

      const valueProbability =
        valueStats.probability[second];

      /*
        Base probability
      */

      const baseScore =
        setProbability *
        valueProbability;

      /*
        Historical 2D frequency.
        Small influence only.
      */

      const historicalCount =
        twoDHistory.counts[number] || 0;

      const historicalTotal =
        twoDHistory.total;

      const historicalProbability =
        historicalTotal > 0
          ? (historicalCount + 1) /
            (historicalTotal + 100)
          : 0.01;

      /*
        Trend adjustment.
        We use a small adjustment so that
        trend doesn't dominate digit probability.
      */

      const trendMultiplier =
        trendScore >= 60
          ? 1.05
          : trendScore <= 40
          ? 0.95
          : 1.0;

      const rawScore =
        baseScore *
        (1 + historicalProbability) *
        trendMultiplier;

      results.push({
        number,
        rawScore,
        setDigitProbability:
          setProbability,
        valueDigitProbability:
          valueProbability,
        historicalCount
      });
    }
  }

  /*
    Convert all 100 scores to percentages.
  */

  const totalScore =
    results.reduce(
      (sum, item) =>
        sum + item.rawScore,
      0
    );

  for (const item of results) {
    item.probability =
      totalScore > 0
        ? (item.rawScore / totalScore) * 100
        : 1;
  }

  /*
    Highest probability first
  */

  results.sort(
    (a, b) =>
      b.probability -
      a.probability
  );

  return {
    top10: results
      .slice(0, 10)
      .map((item, index) => ({
        rank: index + 1,
        number: item.number,
        probability:
          Number(
            item.probability.toFixed(2)
          ),
        setDigitProbability:
          Number(
            (
              item.setDigitProbability *
              100
            ).toFixed(2)
          ),
        valueDigitProbability:
          Number(
            (
              item.valueDigitProbability *
              100
            ).toFixed(2)
          ),
        historicalCount:
          item.historicalCount
      })),
    all100: results.map(item => ({
      number: item.number,
      probability:
        Number(
          item.probability.toFixed(4)
        )
    })),
    setDigitProbability:
      Object.fromEntries(
        Object.entries(
          setStats.probability
        ).map(([digit, value]) => [
          digit,
          Number(
            (value * 100).toFixed(2)
          )
        ])
      ),
    valueDigitProbability:
      Object.fromEntries(
        Object.entries(
          valueStats.probability
        ).map(([digit, value]) => [
          digit,
          Number(
            (value * 100).toFixed(2)
          )
        ])
      ),
    historicalSamples:
      history.length,
    historical2DSamples:
      twoDHistory.total,
    trendScore
  };
}

// =====================================================
// SAVE CURRENT DATA
// =====================================================

async function collectAndSave() {
  try {
    const data = await getSetData();

    if (!data.twoD) {
      return data;
    }

    const history = loadHistory();

    const record = {
      timestamp:
        new Date().toISOString(),

      setLast:
        data.setLast,

      setValue:
        data.setValue,

      volume:
        data.volume,

      open:
        data.open,

      high:
        data.high,

      low:
        data.low,

      change:
        data.change,

      changePercent:
        data.changePercent,

      twoD:
        data.twoD
    };

    /*
      Avoid duplicate records if SET/Value
      have not changed.
    */

    const last =
      history[history.length - 1];

    if (
      !last ||
      last.setLast !== record.setLast ||
      last.setValue !== record.setValue
    ) {
      history.push(record);
      saveHistory(history);
    }

    return record;
  } catch (error) {
    console.error(
      "Collect error:",
      error.message
    );

    throw error;
  }
}

// =====================================================
// ROUTES
// =====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    app: "2D SET INDEX Prediction API",
    status: "online"
  });
});

// -----------------------------------------------------
// LIVE
// -----------------------------------------------------

app.get("/api/live", async (req, res) => {
  try {
    const data = await getSetData();

    res.json({
      success: true,
      ...data,
      timestamp:
        new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error fetching SET data",
      message: error.message
    });
  }
});

// -----------------------------------------------------
// COLLECT
// -----------------------------------------------------

app.get("/api/collect", async (req, res) => {
  try {
    const data =
      await collectAndSave();

    res.json({
      success: true,
      message:
        "SET data collected",
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// -----------------------------------------------------
// HISTORY
// -----------------------------------------------------

app.get("/api/history", (req, res) => {
  const history = loadHistory();

  res.json({
    success: true,
    count: history.length,
    data: history.slice(-100)
  });
});

// -----------------------------------------------------
// ANALYSIS
// -----------------------------------------------------

app.get("/api/analysis", async (req, res) => {
  try {
    const history = loadHistory();

    const live =
      await getSetData();

    const trendScore =
      calculateTrendScore(history);

    res.json({
      success: true,

      current: live,

      analysis: {
        trend:
          trendScore >= 60
            ? "BULLISH"
            : trendScore <= 40
            ? "BEARISH"
            : "NEUTRAL",

        trendScore,

        historicalSamples:
          history.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// -----------------------------------------------------
// 2D PREDICTION
// -----------------------------------------------------

app.get(
  "/api/2d-prediction",
  async (req, res) => {
    try {
      const history =
        loadHistory();

      const live =
        await getSetData();

      /*
        Add current record temporarily
        for analysis.
      */

      const analysisHistory = [
        ...history,
        {
          timestamp:
            new Date().toISOString(),

          setLast:
            live.setLast,

          setValue:
            live.setValue,

          volume:
            live.volume,

          twoD:
            live.twoD
        }
      ];

      const prediction =
        calculate2DPrediction(
          analysisHistory
        );

      res.json({
        success: true,

        current: {
          setLast:
            live.setLast,

          setValue:
            live.setValue,

          twoD:
            live.twoD
        },

        prediction
      });
    } catch (error) {
      console.error(
        "Prediction error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Prediction calculation failed",
        message:
          error.message
      });
    }
  }
);

// =====================================================
// AUTOMATIC DATA COLLECTION
// =====================================================

/*
  Collect every 60 seconds.

  IMPORTANT:
  Render free services can sleep/restart.
  Therefore this is useful for collection while
  the service is running, but later we should use
  persistent PostgreSQL for reliable long-term data.
*/

setInterval(async () => {
  try {
    await collectAndSave();

    console.log(
      "Automatic SET data collection completed:",
      new Date().toISOString()
    );
  } catch (error) {
    console.error(
      "Automatic collection failed:",
      error.message
    );
  }
}, 60 * 1000);

// =====================================================
// START
// =====================================================

app.listen(PORT, () => {
  console.log(
    `2D SET INDEX backend running on port ${PORT}`
  );
});
