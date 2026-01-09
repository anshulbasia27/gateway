import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(request: Request) {
  const { messages } = await request.json();
  try {
    const stream = await streamText({
      model: openai('gpt-4o'),
      system: 'You are a helpful assistant.',
      messages,
    });
    return stream.toAIStreamResponse();
  } catch (error) {
    return new Response('Error processing request', { status: 500 });
  }
}
