// api/download.js

export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Native WHATWG URL API (fixes Node.js url.parse deprecation warning)
        const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const rawUrl = reqUrl.searchParams.get('url') || (req.body && req.body.url);

        if (!rawUrl) {
            return res.status(200).json({ success: false, error: 'Please enter a valid video URL.' });
        }

        const cleanUrl = rawUrl.trim();

        // Extract YouTube / Shorts 11-character Video ID
        const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([\w-]{11})/);
        const videoId = ytMatch ? ytMatch[1] : null;

        // --- ENGINE 1: Cobalt API Nodes (v10 format) ---
        const cobaltNodes = [
            'https://api.cobalt.tools',
            'https://co.wuk.sh',
            'https://cobalt-api.kwippy.me',
            'https://api.cobalt.v0.tf',
            'https://cobalt.qil.dev'
        ];

        const targetUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : cleanUrl;

        for (const node of cobaltNodes) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);

                const response = await fetch(node, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
                // Continue to next node
            }
        }

        // --- ENGINE 2: Piped API Nodes (High Uptime for YouTube Shorts) ---
        if (videoId) {
            const pipedInstances = [
                'https://pipedapi.kavin.rocks',
                'https://pipedapi.adminforge.de',
                'https://api.piped.yt',
                'https://pipedapi.tokhmi.xyz'
            ];

            for (const instance of pipedInstances) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 4000);

                    const response = await fetch(`${instance}/streams/${videoId}`, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                        },
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (response.ok) {
                        const data = await response.json();
                        const streams = data.videoStreams || [];

                        const bestStream = streams.find(s => s.mimeType?.includes('mp4') && s.videoOnly === false && s.quality === '720p') ||
                            streams.find(s => s.mimeType?.includes('mp4') && s.videoOnly === false) ||
                            streams.find(s => s.videoOnly === false);

                        if (bestStream && bestStream.url) {
                            return res.status(200).json({
                                success: true,
                                downloadUrl: bestStream.url,
                                title: data.title || 'Video'
                            });
                        }
                    }
                } catch (err) {
                    // Continue to next instance
                }
            }

            // --- ENGINE 3: Invidious API Nodes ---
            const invidiousInstances = [
                'https://inv.tux.pizza',
                'https://invidious.nerdvpn.de'
            ];

            for (const instance of invidiousInstances) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 4000);

                    const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (response.ok) {
                        const data = await response.json();
                        const format = (data.formatStreams || []).reverse().find(f => f.container === 'mp4');
                        if (format && format.url) {
                            return res.status(200).json({
                                success: true,
                                downloadUrl: format.url,
                                title: data.title || 'Video'
                            });
                        }
                    }
                } catch (err) {
                    // Continue
                }
            }
        }

        return res.status(200).json({
            success: false,
            error: 'Extraction servers are temporarily busy. Please try again in a few moments.'
        });
    } catch (err) {
        return res.status(200).json({
            success: false,
            error: 'An unexpected error occurred. Please try again.'
        });
    }
}