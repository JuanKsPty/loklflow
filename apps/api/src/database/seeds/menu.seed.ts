import { DataSource } from 'typeorm';
import { Category } from '../../menu/entities/category.entity';
import { Product } from '../../menu/entities/product.entity';
import type { PreparationStation } from '../../menu/preparation-station.constants';

const CATEGORIES = [
  { name: 'Entradas', description: 'Para empezar', sortOrder: 1 },
  { name: 'Platos fuertes', description: 'Lo principal', sortOrder: 2 },
  { name: 'Bebidas', description: 'Frías y calientes', sortOrder: 3 },
];

type SeedProduct = {
  name: string;
  price: number;
  description?: string;
  station: PreparationStation;
};

const PRODUCTS: Record<string, SeedProduct[]> = {
  Entradas: [
    { name: 'Guacamole', price: 85, description: 'Con totopos', station: 'kitchen' },
    { name: 'Sopa de tortilla', price: 70, station: 'kitchen' },
  ],
  'Platos fuertes': [
    { name: 'Tacos al pastor (orden)', price: 95, station: 'kitchen' },
    { name: 'Enchiladas verdes', price: 120, station: 'kitchen' },
  ],
  Bebidas: [
    { name: 'Agua de horchata', price: 35, station: 'bar' },
    { name: 'Refresco', price: 30, station: 'immediate' },
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
            station: p.station,
          }),
        );
      } else if (existing.station !== p.station) {
        // Mantener al día la estación de los productos demo ya existentes.
        existing.station = p.station;
        await productsRepo.save(existing);
      }
    }
  }

  console.log('✓ Menu seeded (categorías y productos de ejemplo)');
}
