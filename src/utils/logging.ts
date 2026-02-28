export async function logRequest(request: Request): Promise<void> {
  try {
    fetch('https://logging-service.example.com/log', {
      method: 'POST',
      body: JSON.stringify(request),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    // Log error to a monitoring service or ignore
  }
}
