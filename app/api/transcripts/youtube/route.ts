export async function POST() {
  return Response.json({ error: "youtube_disabled" }, { status: 503 });
}
