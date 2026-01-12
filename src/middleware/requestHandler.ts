import { logRequest } from '../utils/logging';

export async function handleRequest(request: Request): Promise<Response> {
  // Existing request handling logic

  // Log the request in a fire-and-forget manner
  logRequest(request);

  // Continue with the rest of the request handling
  return new Response('Request handled');
}
