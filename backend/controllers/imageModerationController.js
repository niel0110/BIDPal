import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * POST /api/image-moderation/check
 * Scans an image for explicit, illegal, or prohibited content.
 * Body: { imageBase64: string, mimeType: string }
 */
export const checkImageContent = async (req, res) => {
    try {
        const { imageBase64, mimeType } = req.body;

        if (!imageBase64 || !mimeType) {
            return res.status(400).json({ error: 'imageBase64 and mimeType are required' });
        }

        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,        threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT,         threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,  threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', safetySettings });

        const prompt = `You are a strict content moderation system for a Philippine secondhand goods auction marketplace. Sellers upload product photos to list items for sale.

Your task: determine if this image is appropriate to use as a product photo in a public marketplace.

REJECT the image if it contains ANY of the following:
1. EXPLICIT_SEXUAL — nudity, pornography, sexual acts, or sexually suggestive material
2. VIOLENCE — graphic violence, gore, blood, or dismemberment
3. ILLEGAL_ITEMS — illegal drugs, drug paraphernalia, unregistered firearms, stolen goods, counterfeit currency or documents
4. HATE_SYMBOLS — hate symbols, extremist imagery, or content promoting violence against groups
5. OFFENSIVE_GESTURES — obscene gestures such as middle fingers, or any gesture intended to offend or harass
6. CSAM — any sexual content involving minors
7. NOT_A_PRODUCT — the image is clearly not a product photo (e.g., memes, screenshots of text, random offensive illustrations unrelated to any item for sale)

ACCEPT the image only if it clearly shows a physical product suitable for sale: clothing, electronics, furniture, collectibles, shoes, bags, toys, appliances, books, jewelry, or similar secondhand goods.

Be strict. If the image is not clearly a product photo, or if it contains any prohibited content, mark it as unsafe.

Respond ONLY in this exact JSON format with no extra text:
{
  "safe": true or false,
  "flags": ["list violated category codes, empty array if safe"],
  "reason": "one sentence explanation"
}`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { mimeType, data: imageBase64 } }
        ]);

        const candidate = result.response.candidates?.[0];
        if (!candidate || candidate.finishReason === 'SAFETY') {
            console.warn('[Moderation] Blocked by Gemini safety filters — treating as unsafe');
            return res.json({
                safe: false,
                flags: ['EXPLICIT_CONTENT'],
                reason: 'This image was flagged and blocked by the content safety system.'
            });
        }

        const text = result.response.text().trim();
        console.log('[Moderation] Gemini response:', text);

        let cleaned = text;
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        }

        const parsed = JSON.parse(cleaned);

        return res.json({
            safe: parsed.safe === true,
            flags: Array.isArray(parsed.flags) ? parsed.flags : [],
            reason: parsed.reason || ''
        });

    } catch (error) {
        const msg = error.message || '';
        console.error('[Moderation] Error:', msg);

        if (
            msg.includes('SAFETY') || msg.includes('safety') ||
            msg.includes('blocked') || msg.includes('harassment') ||
            msg.includes('explicit')
        ) {
            return res.json({
                safe: false,
                flags: ['EXPLICIT_CONTENT'],
                reason: 'This image was flagged and blocked by the content safety system.'
            });
        }

        return res.json({ safe: true, flags: [], reason: 'Content check unavailable — image allowed by default.' });
    }
};
