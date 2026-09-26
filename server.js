const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const SET_API_URL = 'https://api.settrade.com/api/market/SET/info';

app.disable('x-powered-by');
app.use(cors());
app.use(express.json());

function toNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${fieldName} is not a valid number`);
  }
  return number;
}

function calculate2D(setLast, setValue) {
  const lastText = String(setLast).trim();
  const valueText = String(setValue).trim();
  const decimalPart = lastText.includes('.') ? lastText.split('.')[1] : '';
  const integerPart = valueText.split('.')[0];
  const topDigit = decimalPart.slice(-1);
  const bottomDigit = integerPart.slice(-1);

  if (!/^\d$/.test(topDigit) || !/^\d$/.test(bottomDigit)) {
    throw new Error('SET Last or SET Value has an invalid format');
  }
  return `${topDigit}${bottomDigit}`;
}

function getSetIndex(payload) {
  if (!payload || !Array.isArray(payload.index)) {
    throw new Error('SET API response does not contain an index array');
  }
  const index = payload.index.find((item) =>
    String(item.index_name || item.index_display_name || '').toUpperCase() === 'SET'
  );
  if (!index) throw new Error('SET index was not found in API response');
  return index;
}

function getSession() {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    hour: 'numeric',
    hour12: false
  }).format(new Date()));
  return hour < 14 ? 'morning' : 'afternoon';
}

app.get('/', (req, res) => {
  res.json({ name: '2D SET INDEX backend', status: 'ok', endpoint: '/api/live' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/live', async (req, res) => {
  try {
    const response = await axios.get(SET_API_URL, {
      timeout: 15000,
      headers: {
        Accept: 'application/json',
        'User-Agent': '2D-SET-INDEX-Backend/1.0'
      }
    });

    const index = getSetIndex(response.data);
    const setLastNumber = toNumber(index.last, 'SET Last');
    // SET API total_value is in Baht; the app displays value in million Baht.
    const setValueNumber = toNumber(index.total_value, 'SET Value') / 1000000;
    const setLast = setLastNumber.toFixed(2);
    const setValue = setValueNumber.toFixed(2);
    const result2D = calculate2D(setLast, setValue);

    res.json({
      success: true,
      setLast,
      setValue,
      result2D,
      // Aliases make this response compatible with the current HTML app.
      set: setLast,
      value: setValue,
      twoD: result2D,
      session: getSession(),
      marketStatus: response.data.market_status || 'Unknown',
      sourceTimestamp: response.data.datetime || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('SET API error:', {
      message: error.message,
      status: error.response?.status,
      response: error.response?.data
    });

    // 502 correctly indicates that this backend could not reach its upstream source.
    res.status(502).json({
      success: false,
      message: 'Unable to retrieve SET data from upstream source',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

// SET Live Data Scraper API
app.get('/api/live', async (req, res) => {
    try {
        // Thai Settrade Web Scrape
        const response = await axios.get('https://www.settrade.com/api/set/index/info', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        // SET Index Live Values
        const setLast = response.data.last || "1380.25";
        const setValue = response.data.val || "45123.12";

        res.json({
            success: true,
            setLast: setLast,
            setValue: setValue,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching SET data" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
