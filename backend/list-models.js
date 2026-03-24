import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenerativeAI } from '@google/generative-ai';

async function listModels() {
    console.log('🔍 Listing available Gemini models...');
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // The SDK might not have a direct listModels, but we can try to fetch from the API directly
        // or use the listModels method if available in this version
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        
        if (data.models) {
            console.log('✅ Available Models:');
            data.models.forEach(m => console.log(`- ${m.name} (Supports: ${m.supportedGenerationMethods.join(', ')})`));
        } else {
            console.log('❌ No models found or error:', JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error('💥 Error listing models:', error);
    }
}

listModels();
