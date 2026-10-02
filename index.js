
const express = require('express');
const mongoose = require('mongoose');
const dns = require('dns');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static('public'));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schema
const urlSchema = new mongoose.Schema({
  original_url: {
    type: String,
    required: true
  },
  short_url: {
    type: Number,
    required: true,
    unique: true
  }
});

const Url = mongoose.model('Url', urlSchema);

// Homepage
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Create shortened URL
app.post('/api/shorturl', async (req, res) => {
  const url = req.body.url;

  if (!url) {
    return res.json({ error: 'invalid url' });
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);

    if (
      !['http:', 'https:'].includes(parsedUrl.protocol) ||
      !parsedUrl.hostname
    ) {
      return res.json({ error: 'invalid url' });
    }
  } catch (err) {
    return res.json({ error: 'invalid url' });
  }

  // Verify hostname using DNS
  dns.lookup(parsedUrl.hostname, async (err) => {
    if (err) {
      return res.json({ error: 'invalid url' });
    }

    try {
      // Check if URL already exists
      const existingUrl = await Url.findOne({
        original_url: url
      });

      if (existingUrl) {
        return res.json({
          original_url: existingUrl.original_url,
          short_url: existingUrl.short_url
        });
      }

      // Generate next short URL number
      const lastUrl = await Url.findOne().sort({ short_url: -1 });
      const shortUrl = lastUrl ? lastUrl.short_url + 1 : 1;

      // Save to database
      const newUrl = new Url({
        original_url: url,
        short_url: shortUrl
      });

      await newUrl.save();

      return res.json({
        original_url: newUrl.original_url,
        short_url: newUrl.short_url
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        error: 'server error'
      });
    }
  });
});

// Redirect to original URL
app.get('/api/shorturl/:short_url', async (req, res) => {
  const shortUrl = Number(req.params.short_url);

  if (!Number.isInteger(shortUrl) || shortUrl < 1) {
    return res.json({ error: 'No short URL found' });
  }

  try {
    const urlData = await Url.findOne({
      short_url: shortUrl
    });

    if (!urlData) {
      return res.json({ error: 'No short URL found' });
    }

    return res.redirect(urlData.original_url);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: 'server error'
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
