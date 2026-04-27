import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
console.log("Using API Key:", apiKey ? "FOUND" : "MISSING");

if (apiKey) {
    const genAI = new GoogleGenAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    async function test() {
        try {
            const result = await model.generateContent("Hi");
            console.log("Success:", result.response.text());
        } catch (e) {
            console.error("Failed:", e);
        }
    }
    test();
}
