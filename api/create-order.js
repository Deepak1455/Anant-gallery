// ==========================================================================
// VERCEL SERVERLESS API - CREATE RAZORPAY ORDER (AUTO KEY-PAIR RECOVERY)
// ==========================================================================

const KEY_CANDIDATES = [
    { id: (process.env.RAZORPAY_KEY_ID || "rzp_test_TXCUlCZB4AyWw9").trim(), secret: (process.env.RAZORPAY_KEY_SECRET || "l4xBvoLA7zAD6NSawS3vDn1k").trim() },
    { id: "rzp_test_TXCUlCZB4AyWw9", secret: "14xBvoLA7zAD6NSawS3vDn1k" },
    { id: "rzp_test_TXCTS1kZ6QU5Wn", secret: "YWVUKcbXudYFHE92Lxdt7rGH" }
];

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { body = {}; }
        }

        const amountInRupees = Number(body?.amount) || 999;
        const amountInPaise = Math.round(amountInRupees * 100);
        const receipt = `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        let lastError = null;

        // 🌟 AUTO-TRY ALL KEY PAIRS TO ELIMINATE 401 AUTHENTICATION ERROR
        for (const pair of KEY_CANDIDATES) {
            try {
                const authHeader = 'Basic ' + Buffer.from(`${pair.id}:${pair.secret}`).toString('base64');

                const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
                    method: 'POST',
                    headers: {
                        'Authorization': authHeader,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        amount: amountInPaise,
                        currency: 'INR',
                        receipt: receipt,
                        payment_capture: 1
                    })
                });

                const orderData = await rzpResponse.json();

                if (rzpResponse.ok && orderData.id) {
                    return res.status(200).json({
                        ok: true,
                        orderId: orderData.id,
                        amount: orderData.amount,
                        currency: orderData.currency,
                        keyId: pair.id
                    });
                } else {
                    lastError = orderData.error?.description || 'Auth failed on key pair';
                }
            } catch (err) {
                lastError = err.message;
            }
        }

        return res.status(500).json({ error: `Razorpay Error: ${lastError}` });

    } catch (err) {
        console.error('[Server Error /api/create-order]:', err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}
