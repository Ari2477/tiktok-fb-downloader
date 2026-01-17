const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = 3000;

/* ===============================
   TikTok Downloader (No Watermark)
================================= */
async function tiktokDownload(url) {
  try {
    const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const res = await axios.get(api, { timeout: 10000 });

    if (!res.data || !res.data.data) return null;

    return {
      title: res.data.data.title || "TikTok Video",
      video: res.data.data.play,
      music: res.data.data.music,
      cover: res.data.data.cover
    };
  } catch (err) {
    console.error("TikTok error:", err.message);
    return null;
  }
}

/* ===============================
   Extract Video ID from Facebook URLs
================================= */
function extractFacebookVideoId(url) {
  // For share links like https://www.facebook.com/share/r/1BhaqeryTv/
  if (url.includes('/share/r/')) {
    const match = url.match(/\/share\/r\/([^\/?]+)/);
    return match ? match[1] : null;
  }
  
  // For watch links: https://www.facebook.com/watch/?v=123456789
  const watchMatch = url.match(/[?&]v=(\d+)/);
  if (watchMatch) return watchMatch[1];
  
  // For video links: https://www.facebook.com/username/videos/123456789/
  const videoMatch = url.match(/\/videos\/(\d+)/);
  if (videoMatch) return videoMatch[1];
  
  // For reel links: https://www.facebook.com/reel/123456789
  const reelMatch = url.match(/\/reel\/(\d+)/);
  if (reelMatch) return reelMatch[1];
  
  // For fb.watch links: https://fb.watch/abc123def/
  const fbWatchMatch = url.match(/fb\.watch\/([^\/?]+)/);
  if (fbWatchMatch) return fbWatchMatch[1];
  
  return null;
}

/* ===============================
   Convert Share Link to Watch Link
================================= */
async function convertShareLinkToWatchLink(shareUrl) {
  try {
    console.log("Converting share link:", shareUrl);
    
    // Follow the redirect chain
    const response = await axios.get(shareUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      maxRedirects: 5,
      timeout: 15000,
      validateStatus: null // Accept all status codes
    });
    
    // Get final URL after all redirects
    let finalUrl = response.request?.res?.responseUrl || shareUrl;
    console.log("Final URL after redirects:", finalUrl);
    
    // Extract video ID from final URL
    const videoId = extractFacebookVideoId(finalUrl);
    
    if (videoId) {
      // Convert to standard watch URL
      const watchUrl = `https://www.facebook.com/watch/?v=${videoId}`;
      console.log("Converted to watch URL:", watchUrl);
      return watchUrl;
    }
    
    return finalUrl;
  } catch (err) {
    console.error("Error converting share link:", err.message);
    return shareUrl;
  }
}

/* ===============================
   IMPROVED Facebook Downloader
   Supports ALL URL formats including share links
================================= */
async function facebookDownload(url) {
  console.log("Processing Facebook URL:", url);
  
  // Step 1: Convert share links to watch links
  if (url.includes('/share/r/') || url.includes('/sharer.php')) {
    console.log("Detected share link, converting...");
    url = await convertShareLinkToWatchLink(url);
    console.log("Using converted URL:", url);
  }
  
  // Step 2: Try multiple download APIs
  const apiEndpoints = [
    // API 1: ytdown - supports most formats
    {
      name: "ytdown.net",
      url: `https://ytdown.net/api/convert`,
      method: "POST",
      data: `url=${encodeURIComponent(url)}`,
      parser: (data) => {
        const links = [];
        if (data?.url) {
          links.push({ url: data.url, quality: data.quality || "HD" });
        }
        if (data?.url2) {
          links.push({ url: data.url2, quality: "SD" });
        }
        return links;
      }
    },
    
    // API 2: fdown - good for Facebook
    {
      name: "fdown.net",
      url: `https://fdown.net/`,
      method: "POST",
      data: `URL=${encodeURIComponent(url)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://fdown.net',
        'Referer': 'https://fdown.net/'
      },
      parser: (html) => {
        const links = [];
        // Parse HD link
        const hdMatch = html.match(/href="([^"]+)"[^>]*>Download \(HD\)/);
        if (hdMatch) links.push({ url: hdMatch[1], quality: "HD" });
        // Parse SD link
        const sdMatch = html.match(/href="([^"]+)"[^>]*>Download \(SD\)/);
        if (sdMatch) links.push({ url: sdMatch[1], quality: "SD" });
        return links;
      }
    },
    
    // API 3: snapfb - specialized for Facebook
    {
      name: "snapfb.com",
      url: `https://snapfb.com/api/v1/fetch`,
      method: "POST",
      data: { url: url },
      parser: (data) => {
        const links = [];
        if (data?.video) {
          links.push({ url: data.video, quality: "HD" });
        }
        return links;
      }
    },
    
    // API 4: y2mate - works with Facebook
    {
      name: "y2mate.com",
      url: `https://www.y2mate.com/mates/analyze/ajax`,
      method: "POST",
      data: `url=${encodeURIComponent(url)}&q_auto=1&ajax=1`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      parser: (data) => {
        const links = [];
        if (data?.result) {
          const hdMatch = data.result.match(/href="([^"]+)"[^>]*>HD/);
          const sdMatch = data.result.match(/href="([^"]+)"[^>]*>SD/);
          if (hdMatch) links.push({ url: hdMatch[1], quality: "HD" });
          if (sdMatch) links.push({ url: sdMatch[1], quality: "SD" });
        }
        return links;
      }
    }
  ];
  
  // Try each API endpoint
  for (const endpoint of apiEndpoints) {
    try {
      console.log(`Trying ${endpoint.name}...`);
      
      let response;
      const config = {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...endpoint.headers
        }
      };
      
      if (endpoint.method === "POST") {
        response = await axios.post(endpoint.url, endpoint.data, config);
      } else {
        response = await axios.get(endpoint.url, config);
      }
      
      if (response.data) {
        const links = endpoint.parser(response.data);
        if (links.length > 0) {
          console.log(`✓ Success with ${endpoint.name}, found ${links.length} links`);
          return { 
            links, 
            api: endpoint.name,
            originalUrl: url 
          };
        }
      }
    } catch (err) {
      console.log(`✗ ${endpoint.name} failed:`, err.message);
      continue; // Try next API
    }
  }
  
  // Last resort: Direct HTML parsing
  try {
    console.log("Trying direct HTML parsing as last resort...");
    const directLinks = await facebookDirectParse(url);
    if (directLinks.length > 0) {
      return { 
        links: directLinks, 
        api: "direct-html",
        originalUrl: url 
      };
    }
  } catch (err) {
    console.log("Direct parsing failed:", err.message);
  }
  
  return { 
    links: [], 
    api: "all-failed",
    originalUrl: url 
  };
}

/* ===============================
   Direct HTML Parser (Fallback)
================================= */
async function facebookDirectParse(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': 'locale=en_US' // Add locale cookie for better parsing
      },
      timeout: 15000
    });

    const html = response.data;
    const links = [];

    // Extract video URLs using multiple patterns
    const patterns = [
      /"hd_src":"([^"]+)"/g,
      /"sd_src":"([^"]+)"/g,
      /"playable_url":"([^"]+)"/g,
      /"playable_url_quality_hd":"([^"]+)"/g,
      /"source":"([^"]+\.mp4[^"]*)"/g,
      /<meta\s+property="og:video"\s+content="([^"]+)"/gi,
      /<meta\s+property="og:video:url"\s+content="([^"]+)"/gi,
      /video_src["']?\s*:\s*["']([^"']+)["']/g,
      /(https:\/\/[^"]+\.mp4[^"]*)/g
    ];

    for (const pattern of patterns) {
      const matches = html.match(pattern);
      if (matches) {
        for (const match of matches) {
          // Extract URL from match
          let videoUrl = match;
          if (pattern.toString().includes('"')) {
            const urlMatch = match.match(/"([^"]+)"/);
            if (urlMatch) videoUrl = urlMatch[1];
          }
          
          // Clean up the URL
          videoUrl = videoUrl.replace(/\\\//g, '/')
                             .replace(/\\u0025/g, '%')
                             .replace(/\\u0026/g, '&');
          
          // Only add if it looks like a video URL
          if (videoUrl.includes('.mp4') || videoUrl.includes('video')) {
            links.push({ 
              url: videoUrl, 
              quality: videoUrl.includes('hd') ? "HD" : "SD" 
            });
          }
        }
      }
    }

    // Remove duplicates
    const uniqueLinks = [];
    const seenUrls = new Set();
    
    for (const link of links) {
      if (!seenUrls.has(link.url)) {
        seenUrls.add(link.url);
        uniqueLinks.push(link);
      }
    }

    return uniqueLinks.slice(0, 5); // Return max 5 links
  } catch (err) {
    console.error("Direct parse error:", err.message);
    return [];
  }
}

/* ===============================
   URL Validator - Now supports ALL formats
================================= */
function validateFacebookURL(url) {
  const patterns = [
    // Standard video URLs
    /(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/[^\/]+\/videos\/\d+/i,
    /(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/watch\/?\?v=\d+/i,
    /(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/reel\/\d+/i,
    /(?:https?:\/\/)?fb\.watch\/[a-zA-Z0-9_-]+/i,
    /(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/[^\/]+\/posts\/\d+/i,
    
    // Share links - NOW SUPPORTED!
    /(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/share\/r\/[a-zA-Z0-9]+/i,
    /(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/sharer\.php/i,
    
    // New formats
    /(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/share\/v\/[a-zA-Z0-9]+/i,
    /(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/share\/[^\/]+\/[^\/]+/i,
    
    // General Facebook URLs (catch-all for testing)
    /(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/.+/i
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

/* ===============================
   API Endpoint
================================= */
app.post("/api/download", async (req, res) => {
  try {
    const { url, platform } = req.body;
    
    if (!url || !platform) {
      return res.json({ success: false, error: "Missing URL or platform" });
    }

    let data;

    if (platform === "tiktok") {
      data = await tiktokDownload(url);
      if (!data) {
        return res.json({
          success: false,
          error: "TikTok download failed. Check the URL and try again."
        });
      }
    }
    else if (platform === "facebook") {
      // Validate Facebook URL (now supports all formats)
      if (!validateFacebookURL(url)) {
        return res.json({
          success: false,
          error: "Invalid Facebook URL. Please use a valid Facebook video link."
        });
      }

      console.log(`Processing Facebook download for: ${url}`);
      data = await facebookDownload(url);
      
      if (!data.links || data.links.length === 0) {
        return res.json({
          success: false,
          error: `No download links found.\nURL: ${data.originalUrl || url}\n\nPossible reasons:\n1. Video is private/restricted\n2. URL format not supported\n3. Video requires login\n4. Try using the direct video link instead of share link`
        });
      }
      
      // Add debug info
      data.debug = {
        processedUrl: data.originalUrl,
        apiUsed: data.api,
        timestamp: new Date().toISOString()
      };
    }
    else {
      return res.json({ success: false, error: "Invalid platform selected" });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error("API error:", err.message);
    res.json({ 
      success: false, 
      error: "Server error. Please try again later." 
    });
  }
});

/* ===============================
   Test Endpoint for Debugging
================================= */
app.post("/api/test-facebook", async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.json({ success: false, error: "No URL provided" });
    }
    
    console.log("=== Facebook URL Test ===");
    console.log("Input URL:", url);
    console.log("Is valid?", validateFacebookURL(url));
    
    const videoId = extractFacebookVideoId(url);
    console.log("Extracted Video ID:", videoId);
    
    // Try conversion for share links
    if (url.includes('/share/r/')) {
      const converted = await convertShareLinkToWatchLink(url);
      console.log("Converted URL:", converted);
    }
    
    res.json({
      success: true,
      data: {
        originalUrl: url,
        isValid: validateFacebookURL(url),
        videoId: videoId,
        isShareLink: url.includes('/share/r/'),
        message: "Check server console for detailed logs"
      }
    });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

/* ===============================
   Health Check Endpoint
================================= */
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    facebookFormats: [
      "Standard: facebook.com/.../videos/...",
      "Watch: facebook.com/watch/?v=...", 
      "Reel: facebook.com/reel/...",
      "Share: facebook.com/share/r/...",
      "fb.watch: fb.watch/..."
    ]
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔍 Test Facebook URLs: http://localhost:${PORT}/api/test-facebook`);
});
