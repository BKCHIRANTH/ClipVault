// api/download.js

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const rawUrl = reqUrl.searchParams.get('url') || (req.body && req.body.url);

        if (!rawUrl) {
            return res.status(200).json({ success: false, error: 'Please enter a valid video URL.' });
        }

        const cleanUrl = rawUrl.trim();
        const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([\w-]{11})/);
        const videoId = ytMatch ? ytMatch[1] : null;

        if (videoId) {
            const pipedInstances = [
                'https://pipedapi.kavin.rocks',
                'https://api.piped.yt',
                'https://pipedapi.tokhmi.xyz',
                'https://pipedapi.privacy.com.de'
            ];

            for (const instance of pipedInstances) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3000);

                    const response = await fetch(`${instance}/streams/${videoId}`, { signal: controller.signal });
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
                                downloadUrl: bestStream.url
                            });
                        }
                    }
                } catch (e) {
                    // Continue
                }
            }
        }

        return res.status(200).json({
            success: false,
            error: 'Extraction servers busy.'
        });
    } catch (err) {
        return res.status(200).json({
            success: false,
            error: 'Unexpected server error.'
        });
    }
}