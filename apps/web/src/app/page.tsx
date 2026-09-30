export const dynamic = 'force-dynamic';

async function fetchApiStatus(): Promise<'ok' | 'down'> {
  try {
    const res = await fetch(`${process.env.API_URL}/health`, { cache: 'no-store' });
    const body = (await res.json()) as { status: string; db: string };
    return body.status === 'ok' && body.db === 'ok' ? 'ok' : 'down';
  } catch {
    return 'down';
  }
}

export default async function HomePage() {
  const status = await fetchApiStatus();
  return (
    <main>
      <h1>DescribeIA</h1>
      <p>API: {status}</p>
    </main>
  );
}
