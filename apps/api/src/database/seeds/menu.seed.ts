import { DataSource } from 'typeorm';
import { Category } from '../../menu/entities/category.entity';
import { Product } from '../../menu/entities/product.entity';

const CATEGORIES = [
  { name: 'Entradas', description: 'Para empezar', sortOrder: 1 },
  { name: 'Platos fuertes', description: 'Lo principal', sortOrder: 2 },
  { name: 'Bebidas', description: 'Frías y calientes', sortOrder: 3 },
];

const PRODUCTS: Record<string, { name: string; price: number; description?: string }[]> = {
  Entradas: [
    { name: 'Guacamole', price: 85, description: 'Con totopos' },
    { name: 'Sopa de tortilla', price: 70 },
  ],
  'Platos fuertes': [
    { name: 'Tacos al pastor (orden)', price: 95 },
    { name: 'Enchiladas verdes', price: 120 },
  ],
  Bebidas: [
    { name: 'Agua de horchata', price: 35 },
    { name: 'Refresco', price: 30 },
  ],
};

export async function seedMenu(dataSource: DataSource) {
  const categoriesRepo = dataSource.getRepository(Category);
  const productsRepo = dataSource.getRepository(Product);

  for (const c of CATEGORIES) {
    let category = await categoriesRepo.findOne({ where: { name: c.name } });
    if (!category) {
      category = await categoriesRepo.save(categoriesRepo.create(c));
    }

    for (const p of PRODUCTS[c.name] ?? []) {
      const existing = await productsRepo.findOne({ where: { name: p.name } });
      if (!existing) {
        await productsRepo.save(
          productsRepo.create({
            name: p.name,
            price: p.price,
            description: p.description ?? null,
            categoryId: category.id,
          }),
        );
      }
    }
  }

  console.log('✓ Menu seeded (categorías y productos de ejemplo)');
}
