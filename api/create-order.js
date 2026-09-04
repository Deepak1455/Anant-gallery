// ==========================================================================
// VERCEL SERVERLESS API - CREATE SECURE ORDER (STEP 1)
// ==========================================================================

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const KEY_ID = (process.env.RAZORPAY_KEY_ID || "").trim();
    const KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();

    if (!KEY_ID || !KEY_SECRET) {
        console.error("[Razorpay Config Error]: Environment variables RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET are missing.");
        return res.status(500).json({ error: 'Payment gateway configuration missing on server.' });
    }

    try {
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { body = {}; }
        }

        const amountInRupees = Number(body?.amount) || 999;
        const amountInPaise = Math.round(amountInRupees * 100);

        if (amountInPaise < 100) {
            return res.status(400).json({ error: 'Minimum amount must be at least 100 paise (₹1)' });
        }

        const receipt = `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const authHeader = 'Basic ' + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');

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

        if (!rzpResponse.ok) {
            console.error('[Razorpay Order Creation Error]:', orderData);
            return res.status(rzpResponse.status || 500).json({ 
                error: orderData.error?.description || 'Failed to initialize payment order.' 
            });
        }

        return res.status(200).json({
            ok: true,
            order_id: orderData.id,
            amount: orderData.amount,
            currency: orderData.currency,
            key_id: KEY_ID
        });

    } catch (err) {
        console.error('[Server Error /api/create-order]:', err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}
