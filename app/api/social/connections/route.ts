import { createConnectionHandlers } from "@/lib/social-connections";
const handlers = createConnectionHandlers(false);
export async function GET(request: Request) { return handlers.GET(request); }
export async function POST(request: Request) { return handlers.POST(request); }
export async function DELETE(request: Request) { return handlers.DELETE(request); }
