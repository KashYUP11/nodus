import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
console.log("Using API Key:", apiKey ? "FOUND" : "MISSING");

if (apiKey) {
    const client = new GoogleGenAI({ apiKey });

    async function test() {
        try {
            const result = await client.models.generateContent({
                model: "gemini-1.5-flash",
                contents: "Hi"
            });
            console.log("Success:", result.text?.trim());
        } catch (e) {
            console.error("Failed:", e);
        }
    }
    test();
}
