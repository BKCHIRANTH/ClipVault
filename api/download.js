// api/download.js
export default async function handler(req, res) {
    console.log("=== API REQUEST RECEIVED ===");
    console.log("HTTP Method:", req.method);
    console.log("Query Parameters:", req.query);

    // Set CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        console.log("Handling CORS OPTIONS preflight request.");
        return res.status(200).end();
    }

    const { url } = req.query;

    if (!url) {
        console.warn("WARNING: Missing 'url' query parameter.");
        return res.status(400).json({ error: 'Video URL parameter is required.' });
    }

    const nodes = [
        'https://cobalt-api.kwippy.me',
        'https://api.cobalt.v0.tf',
        'https://cobalt.qil.dev'
    ];

    for (const node of nodes) {
        try {
            console.log(`Attempting stream fetch from node: ${node}`);
            const response = await fetch(node, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: url, videoQuality: '720' })
            });

            console.log(`Node ${node} HTTP Response Status:`, response.status);
            const data = await response.json();
            console.log(`Node ${node} Raw Data:`, JSON.stringify(data));

            if (data && data.url) {
                console.log("SUCCESS: Stream URL found ->", data.url);
                return res.status(200).json({ success: true, downloadUrl: data.url });
            } else if (data && data.picker && data.picker[0] && data.picker[0].url) {
                console.log("SUCCESS: Stream URL found in picker ->", data.picker[0].url);
                return res.status(200).json({ success: true, downloadUrl: data.picker[0].url });
            }
        } catch (e) {
            console.error(`ERROR fetching from node ${node}:`, e.message);
        }
    }

    console.error("FAIL: All upstream extraction nodes failed.");
    return res.status(500).json({ error: 'All backend nodes are currently busy.' });
}