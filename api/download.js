// api/download.js

const COBALT_NODES = [
    'https://cobalt-api.kwippy.me',
    'https://api.cobalt.v0.tf',
    'https://cobalt.qil.dev',
    'https://coapi.kelig.me',
    'https://cobalt-api.ayo.tf',
    'https://api.cobalt.tacohitbox.com',
    'https://cblt.fariz.dev',
    'https://dlapi.miichelle.moe',
    'https://cobapi.elrant.team',
    'https://nyc1.coapi.ggtyler.dev',
    'https://cal1.coapi.ggtyler.dev'
];

// Converts Shorts/youtu.be URLs to standard watch URLs for maximum node compatibility
function normalizeUrl(rawUrl) {
    try {
        const u = new URL(rawUrl);

        // Convert YouTube Shorts -> Standard Watch URL
        if ((u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) && u.pathname.includes('/shorts/')) {
            const match = u.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                return `https://www.youtube.com/watch?v=${match[1]}`;
            }
        }

        // Convert Youtu.be short link -> Standard Watch URL
        if (u.hostname.includes('youtu.be')) {
            const videoId = u.pathname.slice(1).split('?')[0];
            if (videoId) {
                return `https://www.youtube.com/watch?v=${videoId}`;
            }
        }

        return rawUrl;
    } catch (e) {
        return rawUrl;
    }
}

async function tryFetchNode(nodeUrl, targetUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6-second timeout per node

    try {
        const res = await fetch(nodeUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({
                url: targetUrl,
                videoQuality: '720',
                youtubeVideoCodec: 'h264'
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!res.ok) {
            throw new Error(`Node ${nodeUrl} returned status ${res.status}`);
        }

        const data = await res.json();

        if (data.url || (data.picker && data.picker.length > 0)) {
            return data;
        }

        throw new Error('No valid direct video URL returned');
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const rawUrl = req.query.url || req.body?.url;
    if (!rawUrl) {
        return res.status(400).json({ error: 'Missing "url" parameter.' });
    }

    const cleanUrl = normalizeUrl(rawUrl);

    // Split nodes into parallel batches of 4 to maximize speed and uptime
    const BATCH_SIZE = 4;
    let successfulResult = null;

    for (let i = 0; i < COBALT_NODES.length; i += BATCH_SIZE) {
        const batch = COBALT_NODES.slice(i, i + BATCH_SIZE);

        try {
            successfulResult = await Promise.any(
                batch.map(node => tryFetchNode(node, cleanUrl))
            );
            if (successfulResult) break;
        } catch (batchErr) {
            // If all 4 in batch fail/timeout, proceed to next batch
        }
    }

    if (successfulResult) {
        return res.status(200).json(successfulResult);
    }

    return res.status(500).json({
        error: 'All backend nodes are currently busy or blocking this media link. Please try again in a moment or try another video link.'
    });
}