import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIProvider, Message } from "./types";

export class GeminiProvider implements AIProvider {
    private genAI: GoogleGenerativeAI | null = null;
    // private apiKey: string = ""; // Unused
    private modelName: string = "gemini-2.0-flash"; // Default

    constructor(apiKey: string, modelName: string = "gemini-2.0-flash") {
        this.modelName = modelName;
        this.updateApiKey(apiKey);
    }

    updateApiKey(apiKey: string) {
        // this.apiKey = apiKey;
        if ((window as any).electronAPI) {
            (window as any).electronAPI.log(`GeminiProvider: updateApiKey called with length: ${apiKey ? apiKey.length : 0}`);
        }
        if (apiKey) {
            const validKey = apiKey.trim();
            this.genAI = new GoogleGenerativeAI(validKey);
        } else {
            this.genAI = null;
        }
    }

    setModel(modelName: string) {
        this.modelName = modelName;
    }

    hasKey(): boolean {
        return this.genAI !== null;
    }

    async chat(messages: Message[], signal?: AbortSignal): Promise<string> {
        if (signal?.aborted) throw new Error("Request cancelled by user");
        if (!this.genAI) {
            throw new Error("API Key not set.");
        }

        // Filter out system messages for history (Gemini handles system instruction separately, or we prepend)
        // For simplicity, we'll prepend system messages to the first user message or just ignore if not critical.
        // Actually, let's treat 'system' as 'user' but labeled.

        let history = messages.slice(0, -1).map(m => ({
            role: m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.role === 'system' ? `[System: ${m.content}]` : m.content }]
        }));

        const lastMessage = messages[messages.length - 1];
        if (!lastMessage) return ""; // Should not happen

        const model = this.genAI.getGenerativeModel({ model: this.modelName });

        const chat = model.startChat({
            history: history,
            generationConfig: {
                maxOutputTokens: 2000,
            },
        });

        const result = await chat.sendMessage(lastMessage.content);
        const response = await result.response;
        return response.text();
    }

    async generateText(prompt: string, signal?: AbortSignal): Promise<string> {
        if (!this.genAI) {
            throw new Error("API Key not set. Please configure it in Settings.");
        }

        // Prioritize user selected model
        const modelsToTry = [
            this.modelName,
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-flash-latest",
            "gemini-pro-latest",
            "gemini-1.5-flash",
            "gemini-1.5-pro"
        ];

        // Unique models
        const uniqueModels = [...new Set(modelsToTry.filter(m => m))];

        const errors: string[] = [];

        if ((window as any).electronAPI) {
            (window as any).electronAPI.log(`GeminiProvider: Starting generation. Priority model: ${this.modelName}`);
        }

        for (const modelName of uniqueModels) {
            try {
                if ((window as any).electronAPI) {
                    (window as any).electronAPI.log(`GeminiProvider: Attempting with model: ${modelName}`);
                }

                const model = this.genAI.getGenerativeModel({ model: modelName });

                if (signal?.aborted) {
                    throw new Error("Request aborted");
                }

                const plainTextPrompt = `${prompt}\n\nIMPORTANT: Output the response in plain text only. Do NOT use Markdown formatting (no bold, italics, headers, code blocks, etc.).`;
                const result = await model.generateContent(plainTextPrompt);

                if (signal?.aborted) {
                    throw new Error("Request aborted");
                }

                const response = await result.response;
                const text = response.text();

                // Track usage if available (not standard in text() result, but might be in response object)
                if (response.usageMetadata && (window as any).electronAPI?.log) {
                    const usage = `${response.usageMetadata.totalTokenCount} tokens`;
                    (window as any).electronAPI.log(`GeminiProvider: Usage for ${modelName}: ${usage}`);
                    // We could emit this event to UI?
                }

                if ((window as any).electronAPI) {
                    (window as any).electronAPI.log(`GeminiProvider: Success with model: ${modelName}`);
                }
                return text;

            } catch (error: any) {
                const errorMessage = error.message || error.toString();
                errors.push(`${modelName}: ${errorMessage}`);

                if ((window as any).electronAPI) {
                    (window as any).electronAPI.log(`GeminiProvider: Failed with model ${modelName}: ${errorMessage}`);
                }

                if (signal?.aborted || errorMessage === "Request aborted" || errorMessage.includes("cancelled")) {
                    throw new Error("Request cancelled by user");
                }

                // If it's an API key or permission error, stop immediately, don't fallback.
                if (errorMessage.includes("API key") || errorMessage.includes("permission") || errorMessage.includes("403")) {
                    throw new Error(`Gemini API Error: ${errorMessage}`);
                }
            }
        }

        throw new Error(`All Gemini models failed.\nDetails:\n${errors.join('\n')}`);
    }

    async translateToJapanese(text: string, signal?: AbortSignal): Promise<string> {
        const prompt = `Translate the following text to natural Japanese. Output ONLY the translation.\n\nText: ${text}`;
        return this.generateText(prompt, signal);
    }

    async answerQuestion(question: string, signal?: AbortSignal): Promise<string> {
        const prompt = `Answer the following question in Japanese. Keep the answer concise and helpful.\n\nQuestion: ${question}`;
        return this.generateText(prompt, signal);
    }

    async transcribeAudio(audioBlob: Blob): Promise<string> {
        if (!this.genAI) {
            throw new Error("API Key not set.");
        }

        // Use efficient model for audio - Force 1.5 Flash if current model isn't apt
        const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Convert Blob to Base64
        const base64Audio = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                // Remove data URL prefix
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
        });

        // mimeType from blob
        const mimeType = audioBlob.type || "audio/wav";

        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: mimeType,
                    data: base64Audio
                }
            },
            { text: "Transcribe the audio to text. Output only the transcription." }
        ]);

        const response = await result.response;
        return response.text();
    }
}
