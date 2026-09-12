import {createConnectionHandlers} from "@/lib/social-connections";
const handlers = createConnectionHandlers(true);
type Context = {params: Promise<{id: string}>};
export function GET(request: Request, context: Context) { return handlers.GET(request, context); }
export function POST(request: Request, context: Context) { return handlers.POST(request, context); }
export function DELETE(request: Request, context: Context) { return handlers.DELETE(request, context); }
