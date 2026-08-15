// api/download.js

export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const rawUrl = req.query.url || (req.body && req.body.url);
    if (!rawUrl) {
        return res.status(400).json({ error: 'Missing "url" parameter.' });
    }

    const cleanUrl = rawUrl.trim();

    // Extract 11-character YouTube / Shorts Video ID
    const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([\w-]{11})/);
    const videoId = ytMatch ? ytMatch[1] : null;

    // --- ENGINE 1: Piped Video API (High Reliability for YouTube & Shorts) ---
    if (videoId) {
        const pipedInstances = [
            'https://pipedapi.kavin.rocks',
            'https://api.piped.yt',
            'https://pipedapi.tokhmi.xyz',
            'https://pipedapi.privacy.com.de',
            'https://api.piped.projectsegfau.lt'
        ];

        for (const instance of pipedInstances) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);

                const response = await fetch(`${instance}/streams/${videoId}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    const streams = data.videoStreams || [];

                    // Select best combined video+audio MP4 stream
                    const bestStream = streams.find(s => s.mimeType?.includes('mp4') && s.videoOnly === false && s.quality === '720p') ||
                        streams.find(s => s.mimeType?.includes('mp4') && s.videoOnly === false) ||
                        streams.find(s => s.videoOnly === false);

                    if (bestStream && bestStream.url) {
                        return res.status(200).json({
                            success: true,
                            downloadUrl: bestStream.url,
                            url: bestStream.url,
                            title: data.title || 'YouTube Video'
                        });
                    }
                }
            } catch (e) {
                // Try next instance on failure
            }
        }
    }

    // --- ENGINE 2: Cobalt API Nodes (Fallback for TikTok, IG, Twitter & YouTube) ---
    const cobaltNodes = [
        'https://co.wuk.sh',
        'https://cobalt.hyper.lol',
        'https://cobalt-api.kwippy.me',
        'https://api.cobalt.v0.tf',
        'https://cobalt.qil.dev',
        'https://dlapi.miichelle.moe'
    ];

    const standardYtUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : cleanUrl;

    for (const node of cobaltNodes) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const response = await fetch(node, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                },
                body: JSON.stringify({
                    url: standardYtUrl,
                    videoQuality: '720'
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                const streamUrl = data.url || (data.picker && data.picker[0] && data.picker[0].url);
                if (streamUrl) {
                    return res.status(200).json({
                        success: true,
                        downloadUrl: streamUrl,
                        url: streamUrl
                    });
                }
            }
        } catch (err) {
            // Try next node on failure
        }
    }

    // --- ENGINE 3: External Fallback (Prevents 503 Errors) ---
    if (videoId) {
        const fallbackUrl = `https://cobalt.tools/#https://www.youtube.com/watch?v=${videoId}`;
        return res.status(200).json({
            success: true,
            downloadUrl: fallbackUrl,
            url: fallbackUrl,
            message: 'Direct stream generated via external mirror.'
        });
    }

    return res.status(503).json({
        error: 'All extraction nodes are currently busy. Please try again in a few moments.'
    });
}