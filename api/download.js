export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 1. Modern WHATWG URL parsing (replaces legacy url.parse)
        const host = req.headers.host || 'localhost';
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const requestUrl = new URL(req.url, `${protocol}://${host}`);

        let targetUrl = requestUrl.searchParams.get('url');

        // Handle POST body fallback
        if (!targetUrl && req.body && req.body.url) {
            targetUrl = req.body.url;
        }

        if (!targetUrl) {
            return res.status(400).json({ error: 'Missing target URL parameter.' });
        }

        // Helper: Extract YouTube Video / Shorts ID
        const extractYouTubeId = (str) => {
            const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
            return match ? match[1] : null;
        };

        const ytVideoId = extractYouTubeId(targetUrl);

        // ENGINE 1: Invidious Open Instances (High reliability for YouTube & Shorts on Vercel)
        if (ytVideoId) {
            const invidiousInstances = [
                'https://inv.tux.pizza',
                'https://invidious.nerdvpn.de',
                'https://invidious.drgns.space',
                'https://inv.us.projectsegfau.lt',
                'https://invidious.io.lol'
            ];

            for (const instance of invidiousInstances) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 4000);

                    const response = await fetch(`${instance}/api/v1/videos/${ytVideoId}`, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (response.ok) {
                        const data = await response.json();

                        // Extract playable format stream (prefer 720p/MP4)
                        const stream = data.formatStreams?.find(s => s.container === 'mp4' && s.qualityLabel === '720p') ||
                            data.formatStreams?.find(s => s.container === 'mp4') ||
                            data.formatStreams?.[0];

                        if (stream && stream.url) {
                            return res.status(200).json({
                                status: 'stream',
                                url: stream.url,
                                filename: `${data.title || 'video'}.mp4`,
                                title: data.title,
                                thumbnail: data.videoThumbnails?.[0]?.url || ''
                            });
                        }
                    }
                } catch (e) {
                    // Attempt next instance on fail
                }
            }
        }

        // ENGINE 2: Cobalt v10 API Community Nodes (Fallback for TikTok, Instagram, Twitter)
        const cobaltNodes = [
            'https://cobalt-api.kwippy.me',
            'https://api.cobalt.v0.tf',
            'https://cobalt.qil.dev'
        ];

        for (const node of cobaltNodes) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);

                const response = await fetch(node, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
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
                    if (data && (data.url || data.picker)) {
                        return res.status(200).json(data);
                    }
                }
            } catch (e) {
                // Attempt next node on fail
            }
        }

        // Return structured 503 error if all providers were unreachable
        return res.status(503).json({
            error: 'Public extraction servers are temporarily rate-limited or unavailable. Please try again shortly.'
        });

    } catch (err) {
        console.error('Server error in api/download:', err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}