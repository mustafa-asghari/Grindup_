import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

export function getOpenAI(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
    }

    openaiClient ??= new OpenAI({ apiKey });
    return openaiClient;
}

export const openai = new Proxy({} as OpenAI, {
    get(_target, prop) {
        return getOpenAI()[prop as keyof OpenAI];
    },
});

export async function getEmbedding(text: string): Promise<number[]> {
    const response = await getOpenAI().embeddings.create({
        model: "text-embedding-3-small",
        input: text.replace(/\n/g, ' '),
    });
    return response.data[0].embedding;
}
