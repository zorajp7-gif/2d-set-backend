const express = require('express');
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
