// ==========================================================================
// VERCEL SERVERLESS API - CREATE RAZORPAY ORDER (AUTHENTICATION FIXED)
// ==========================================================================

const KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_TXCUlCZB4AyWw9";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "l4xBvoLA7zAD6NSawS3vDn1k";

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

        const amountInRupees = Number(body?.amount);
        if (!amountInRupees || amountInRupees < 1) {
            return res.status(400).json({ error: 'Invalid amount. Minimum is ₹1 (100 paise)' });
        }

        const amountInPaise = Math.round(amountInRupees * 100);
        const receipt = `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        // 🌟 BASIC AUTH HEADER WITH MATCHED CREDENTIALS
        const authHeader = 'Basic ' + Buffer.from(`${KEY_ID.trim()}:${KEY_SECRET.trim()}`).toString('base64');

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

        if (!rzpResponse.ok || !orderData.id) {
            console.error('[Razorpay Auth Error]:', orderData);
            return res.status(rzpResponse.status || 500).json({ 
                error: orderData.error?.description || 'Razorpay Authentication failed. Check Keys.' 
            });
        }

        return res.status(200).json({
            ok: true,
            orderId: orderData.id,
            amount: orderData.amount,
            currency: orderData.currency,
            keyId: KEY_ID
        });

    } catch (err) {
        console.error('[Server Error /api/create-order]:', err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}
