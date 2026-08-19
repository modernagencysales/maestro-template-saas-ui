import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const name = searchParams.get('name')

  if (!name) {
    return new Response('Name parameter is required', { status: 400 })
  }

  const type =
    searchParams.get('type') ?? (Math.random() < 0.5 ? 'male' : 'female')

  const avatarUrl = `https://xsgames.co/randomusers/avatar.php?g=${type}&name=${encodeURIComponent(name)}`

  try {
    const response = await fetch(avatarUrl)
    const imageBuffer = await response.arrayBuffer()

    return new Response(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable', // 1 year cache
        'Content-Length': imageBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error('Error fetching avatar:', error)
    return new Response('Error generating avatar', { status: 500 })
  }
}
