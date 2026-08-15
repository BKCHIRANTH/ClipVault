// api/download.js

export default async function handler(req, res) {
    // Setup CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Native WHATWG URL parsing (replaces deprecated url.parse)
        const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const rawUrl = reqUrl.searchParams.get('url') || (req.body && req.body.url);

        if (!rawUrl) {
            return res.status(400).json({ success: false, error: 'Please enter a valid video URL.' });
        }

        const cleanUrl = rawUrl.trim();
        const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([\w-]{11})/);
        const videoId = ytMatch ? ytMatch[1] : null;

        if (!videoId) {
            return res.status(400).json({ success: false, error: 'Invalid YouTube Shorts or video link.' });
        }

        // --- ENGINE 1: Multi-Instance Invidious Extraction ---
        const invidiousInstances = [
            'yewtu.be',
            'inv.nadeko.net',
            'invidious.privacydev.net',
            'inv.tux.pizza',
            'iv.melmac.space'
        ];

        for (const domain of invidiousInstances) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3500);

                const response = await fetch(`https://${domain}/api/v1/videos/${videoId}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    const streams = data.formatStreams || [];
                    const bestStream = streams.reverse().find(s => s.container === 'mp4' || s.encoding === 'h264') || streams[0];

                    if (bestStream && bestStream.url) {
                        return res.status(200).json({
                            success: true,
                            downloadUrl: bestStream.url,
                            title: data.title || 'Video'
                        });
                    }
                }
            } catch (err) {
                // Try next instance
            }
        }

        // --- ENGINE 2: Cobalt API Nodes Fallback ---
        const cobaltNodes = [
            'https://api.cobalt.tools',
            'https://co.wuk.sh',
            'https://cobalt-api.kwippy.me'
        ];

        const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;

        for (const node of cobaltNodes) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3500);

                const response = await fetch(node, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                    },
                    body: JSON.stringify({
                        url: targetUrl,
                        videoQuality: '720'
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    const streamUrl = data.url || (data.picker && data.picker[0] && data.picker[0].url);

                    if (streamUrl && !streamUrl.includes('cobalt.tools/#')) {
                        return res.status(200).json({
                            success: true,
                            downloadUrl: streamUrl
                        });
                    }
                }
            } catch (err) {
                // Try next node
            }
        }

        return res.status(503).json({
            success: false,
            error: 'Extraction servers are temporarily busy. Please try again in a few moments.'
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: 'An internal server error occurred.'
        });
    }
}