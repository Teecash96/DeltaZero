import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CategoryHub } from "@/components/marketplace/category-hub";
import { CATEGORY_DEFINITIONS, CATEGORY_ORDER, isRiskCategory } from "@/src/lib/marketplace/categories";
import { getLiveMarketplaceDiscovery } from "@/src/server/marketplace/live-registry";

export const dynamic = "force-dynamic";

export function generateStaticParams() { return CATEGORY_ORDER.map((category) => ({ category })); }

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const definition = isRiskCategory(category) ? CATEGORY_DEFINITIONS[category] : undefined;
  return { title: definition ? `${definition.name} | DeltaZero` : "Category not found | DeltaZero", description: definition?.description };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!isRiskCategory(category)) notFound();
  const discovery = await getLiveMarketplaceDiscovery();
  return <CategoryHub definition={CATEGORY_DEFINITIONS[category]} agents={discovery.agents.filter((agent) => agent.categories.includes(category))} exclusions={discovery.exclusions.filter((exclusion) => !exclusion.category || exclusion.category === category)} />;
}
