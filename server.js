const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// SET data source
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

  const decimalPart = lastText.includes('.')
    ? lastText.split('.')[1]
    : '';

  const integerPart = valueText.split('.')[0];

  const topDigit = decimalPart.slice(-1);
  const bottomDigit = integerPart.slice(-1);

  if (!/^\d$/.test(topDigit) || !/^\d$/.test(bottomDigit)) {
    throw new Error(
      'SET Last or SET Value has an invalid format'
    );
  }

  return `${topDigit}${bottomDigit}`;
}

function getSetIndex(payload) {
  if (!payload || !Array.isArray(payload.index)) {
    throw new Error(
      'SET API response does not contain an index array'
    );
  }

  const index = payload.index.find((item) => {
    const name = String(
      item.index_name ||
      item.index_display_name ||
      ''
    ).toUpperCase();

    return name === 'SET';
  });

  if (!index) {
    throw new Error('SET index was not found in API response');
  }

  return index;
}

function getSession() {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      hour: 'numeric',
      hour12: false
    }).format(new Date())
  );

  return hour < 14 ? 'morning' : 'afternoon';
}


// --------------------------------------------------
// HOME
// --------------------------------------------------

app.get('/', (req, res) => {
  res.json({
    name: '2D SET INDEX backend',
    status: 'ok',
    endpoint: '/api/live'
  });
});


// --------------------------------------------------
// HEALTH
// --------------------------------------------------

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});


// --------------------------------------------------
// LIVE 2D
// --------------------------------------------------

app.get('/api/live', async (req, res) => {
  try {

    console.log('Fetching SET data...');

    const response = await axios.get(SET_API_URL, {
      timeout: 15000,

      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    console.log('SET API status:', response.status);

    const index = getSetIndex(response.data);

    // SET index
    const setLastNumber = toNumber(
      index.last,
      'SET Last'
    );

    // SET total value is Baht.
    // Convert to million Baht.
    const setValueNumber =
      toNumber(
        index.total_value,
        'SET Value'
      ) / 1000000;

    const setLast =
      setLastNumber.toFixed(2);

    const setValue =
      setValueNumber.toFixed(2);

    // Calculate 2D
    const result2D =
      calculate2D(
        setLast,
        setValue
      );

    const result = {
      success: true,

      setLast: setLast,
      setValue: setValue,

      result2D: result2D,

      // Compatibility aliases
      set: setLast,
      value: setValue,
      twoD: result2D,

      session: getSession(),

      marketStatus:
        response.data.market_status ||
        'Unknown',

      sourceTimestamp:
        response.data.datetime ||
        null,

      timestamp:
        new Date().toISOString()
    };

    console.log('2D RESULT:', result);

    res.json(result);

  } catch (error) {

    console.error('SET API ERROR:', {
      message: error.message,
      status: error.response?.status,
      response: error.response?.data
    });

    res.status(502).json({
      success: false,

      message:
        'Unable to retrieve SET data from upstream source',

      error: error.message,

      upstreamStatus:
        error.response?.status || null,

      timestamp:
        new Date().toISOString()
    });
  }
});


// --------------------------------------------------
// ERROR HANDLER
// --------------------------------------------------

app.use((err, req, res, next) => {

  console.error(
    'Unhandled server error:',
    err
  );

  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});


// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `2D SET Backend running on port ${PORT}`
    );
  }
);
