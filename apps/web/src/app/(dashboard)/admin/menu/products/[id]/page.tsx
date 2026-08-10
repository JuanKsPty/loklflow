import { notFound } from 'next/navigation';
import { serverFetch } from '@/lib/api/server-client';
import { ProductForm } from '@/components/admin/menu/product-form';
import { RecipeEditor } from '@/components/admin/inventory/recipe-editor';
import { PageHeader } from '@/components/page-header';
import type { Category, Ingredient, Modifier, Product, RecipeIngredient } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  try {
    const [product, categories, modifiers] = await Promise.all([
      serverFetch<Product>(`/menu/products/${id}`),
      serverFetch<Category[]>('/menu/categories'),
      serverFetch<Modifier[]>('/menu/modifiers'),
    ]);

    // La receta va aparte y sin bloquear: si el inventario falla, editar el producto tiene
    // que seguir funcionando. Es una función añadida, no un requisito para tocar el menú.
    let ingredients: Ingredient[] = [];
    let recipe: RecipeIngredient[] = [];
    try {
      [ingredients, recipe] = await Promise.all([
        serverFetch<Ingredient[]>('/inventory/ingredients'),
        serverFetch<RecipeIngredient[]>(`/inventory/recipes/${id}`),
      ]);
    } catch {
      // sin inventario disponible, el editor de receta simplemente no se muestra
    }

    return (
      <div>
        <PageHeader title="Editar producto" description={product.name} />
        <ProductForm product={product} categories={categories} modifiers={modifiers} />
        {ingredients.length > 0 && (
          <RecipeEditor productId={product.id} ingredients={ingredients} recipe={recipe} />
        )}
      </div>
    );
  } catch {
    notFound();
  }
}
