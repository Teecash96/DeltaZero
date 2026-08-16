import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CategoryHub } from "@/components/marketplace/category-hub";
import { CATEGORY_DEFINITIONS, CATEGORY_ORDER, isRiskCategory } from "@/src/lib/marketplace/categories";
import { getAgentsForCategory } from "@/src/lib/marketplace/fixtures";

export function generateStaticParams() {
  return CATEGORY_ORDER.map((category) => ({ category }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const definition = isRiskCategory(category) ? CATEGORY_DEFINITIONS[category] : undefined;
  return { title: definition ? `${definition.name} | DeltaZero` : "Category not found | DeltaZero", description: definition?.description };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!isRiskCategory(category)) notFound();
  return <CategoryHub definition={CATEGORY_DEFINITIONS[category]} agents={getAgentsForCategory(category)} />;
}
