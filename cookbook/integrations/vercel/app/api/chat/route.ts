import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    if (!messages || !Array.isArray(messages)) {
      throw new Error('Invalid request payload');
    }
    const stream = await streamText({
      model: openai('gpt-4o'),
      system: 'You are a helpful assistant.',
      messages,
    });
    return stream.toAIStreamResponse();
  } catch (error) {
    return new Response('Forbidden', { status: 403 });
  }
}
