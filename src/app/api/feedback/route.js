import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(request) {
  try {
    const { pathname, helpful } = await request.json()
    const { env } = getCloudflareContext();
    const db = env.DB

    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    await db
      .prepare(
        'INSERT INTO feedback (pathname, helpful, created_at) VALUES (?, ?, ?)'
      )
      .bind(pathname, helpful ? 1 : 0, new Date().toISOString())
      .run()

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Feedback error:', error)
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
