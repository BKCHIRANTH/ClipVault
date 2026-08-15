// api/download.js
export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Video URL parameter is required.' });
    }

    // List of active Cobalt processing nodes
    const nodes = [
        'https://cobalt-api.kwippy.me',
        'https://api.cobalt.v0.tf',
        'https://cobalt.qil.dev'
    ];

    for (const node of nodes) {
        try {
            const response = await fetch(node, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: url,
                    videoQuality: '720'
                })
            });

            const data = await response.json();

            if (data && data.url) {
                return res.status(200).json({ success: true, downloadUrl: data.url });
            } else if (data && data.picker && data.picker[0] && data.picker[0].url) {
                return res.status(200).json({ success: true, downloadUrl: data.picker[0].url });
            }
        } catch (e) {
            // Try next node
            continue;
        }
    }

    return res.status(500).json({ error: 'All backend nodes are currently busy. Please try again.' });
}