import { getLiveMarketplaceDiscovery } from "@/src/server/marketplace/live-registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const discovery = await getLiveMarketplaceDiscovery();
  return Response.json(discovery, {
    headers: {
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
