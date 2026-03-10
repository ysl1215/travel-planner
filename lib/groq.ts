import Groq from "groq-sdk";

let groqClient: Groq | null = null;

export function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY environment variable is not set");
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

export async function generateWithGroq(
  systemPrompt: string,
  userPrompt: string,
  model: string = "llama-3.3-70b-versatile"
): Promise<string> {
  const client = getGroqClient();

  const completion = await client.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    model,
    temperature: 0.7,
    max_tokens: 4096,
  });

  return completion.choices[0]?.message?.content ?? "";
}

export async function streamWithGroq(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  model: string = "llama-3.3-70b-versatile"
): Promise<ReadableStream> {
  const client = getGroqClient();

  const stream = await client.chat.completions.create({
    messages,
    model,
    temperature: 0.7,
    max_tokens: 2048,
    stream: true,
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) {
          controller.enqueue(encoder.encode(text));
        }
      }
      controller.close();
    },
  });
}
