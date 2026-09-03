// ==========================================================================
// VERCEL SERVERLESS API - VERIFY PAYMENT SIGNATURE (STEP 3)
// ==========================================================================

import crypto from 'crypto';

const KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "5KM22mbCi7i8EUrnJLFkDJzO").trim();

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

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body || {};

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ ok: false, error: 'Missing required signature parameters' });
        }

        // HMAC-SHA256 signature verification
        const generatedSignature = crypto
            .createHmac('sha256', KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ ok: false, error: 'Signature mismatch! Payment verification failed.' });
        }

        return res.status(200).json({
            ok: true,
            verified: true,
            payment_id: razorpay_payment_id,
            order_id: razorpay_order_id
        });

    } catch (err) {
        console.error('[Server Error /api/verify-payment]:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Internal Server Error' });
    }
}
