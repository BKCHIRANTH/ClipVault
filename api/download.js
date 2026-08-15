// api/download.js

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const rawUrl = req.query.url || (req.body && req.body.url);
    if (!rawUrl) {
        return res.status(400).json({ error: 'Please enter a valid video URL.' });
    }

    let cleanUrl = rawUrl.trim();

    // Convert YouTube Shorts link format to standard watch format
    const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) {
        cleanUrl = `https://www.youtube.com/watch?v=${ytMatch[1]}`;
    }

    // Active API nodes that return direct MP4 video streams
    const apiNodes = [
        'https://api.cobalt.tools',
        'https://co.wuk.sh',
        'https://cobalt-api.kwippy.me',
        'https://cobalt.hyper.lol'
    ];

    for (const node of apiNodes) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(node, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                },
                body: JSON.stringify({
                    url: cleanUrl,
                    videoQuality: '720'
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                const directStreamUrl = data.url || (data.picker && data.picker[0] && data.picker[0].url);

                // Accept only direct media streams (reject web page redirects)
                if (directStreamUrl && !directStreamUrl.includes('cobalt.tools/#')) {
                    return res.status(200).json({
                        success: true,
                        downloadUrl: directStreamUrl
                    });
                }
            }
        } catch (err) {
            // Try next node if current one times out or fails
        }
    }

    return res.status(500).json({
        error: 'Failed to extract direct MP4 link. Please try again in a few seconds.'
    });
}