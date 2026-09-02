// ==========================================================================
// VERCEL SERVERLESS API - VERIFY RAZORPAY PAYMENT SIGNATURE
// ==========================================================================

import crypto from 'crypto';

const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "l4xBvoLA7zAD6NSawS3vDn1k";

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        let body = req.body;
        if (typeof body === 'string') body = JSON.parse(body);

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

        // 1. Check Missing Fields
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: 'Missing required payment verification fields' });
        }

        // 2. Generate HMAC-SHA256 Signature: order_id + "|" + payment_id
        const expectedSignature = crypto
            .createHmac('sha256', KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        // 3. Timing-Safe Comparison
        const isSignatureValid = expectedSignature === razorpay_signature;

        if (!isSignatureValid) {
            console.warn('[Signature Mismatch]:', { expected: expectedSignature, received: razorpay_signature });
            return res.status(400).json({ 
                ok: false, 
                error: 'Payment verification failed (Signature mismatch)' 
            });
        }

        return res.status(200).json({
            ok: true,
            verified: true,
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id
        });

    } catch (err) {
        console.error('[Server Error /api/verify-payment]:', err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}
