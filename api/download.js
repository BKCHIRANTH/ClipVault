// api/download.js
export default async function handler(req, res) {
    // Enable CORS so your GitHub Pages frontend can talk to this serverless API
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Backup pool of unblocked Cobalt / Video processing nodes
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
                body: JSON.stringify({ url, videoQuality: '720' })
            });

            const data = await response.json();
            if (data && data.url) {
                return res.status(200).json({ success: true, downloadUrl: data.url });
            }
        } catch (e) {
            // Try next node if one is unreachable
            continue;
        }
    }

    return res.status(500).json({ error: 'Could not fetch stream. All nodes busy.' });
}