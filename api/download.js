// api/download.js

export default async function handler(req, res) {
    // Set CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const rawUrl = req.query.url;
    if (!rawUrl) {
        return res.status(400).json({ error: 'Missing "url" parameter.' });
    }

    // Normalize YouTube Shorts and short links to standard watch format
    let cleanUrl = rawUrl.trim();
    try {
        const u = new URL(cleanUrl);
        if ((u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) && u.pathname.includes('/shorts/')) {
            const match = u.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                cleanUrl = `https://www.youtube.com/watch?v=${match[1]}`;
            }
        } else if (u.hostname.includes('youtu.be')) {
            const videoId = u.pathname.slice(1).split('?')[0];
            if (videoId) {
                cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
            }
        }
    } catch (e) {
        // If parsing fails, fall back to the raw URL
    }

    // Active pool of public processing nodes
    const nodes = [
        'https://co.wuk.sh',
        'https://cobalt.hyper.lol',
        'https://cobalt.api.sciter.io',
        'https://api.cobalt.tools',
        'https://cobalt-api.kwippy.me',
        'https://api.cobalt.v0.tf',
        'https://cobalt.qil.dev'
    ];

    for (const node of nodes) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout per node

            const response = await fetch(node, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                body: JSON.stringify({
                    url: cleanUrl,
                    videoQuality: '720'
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) continue;

            const data = await response.json();

            if (data && data.url) {
                return res.status(200).json({ success: true, downloadUrl: data.url });
            } else if (data && data.picker && data.picker[0] && data.picker[0].url) {
                return res.status(200).json({ success: true, downloadUrl: data.picker[0].url });
            }
        } catch (err) {
            // Node offline or timed out, try next node
            continue;
        }
    }

    return res.status(500).json({ error: 'All backend nodes are currently busy or blocked by YouTube.' });
}