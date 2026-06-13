import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { Sector } from '../../tables/entities/sector.entity';
import { RestaurantTable } from '../../tables/entities/table.entity';

const SECTORS = [
  { name: 'Interior', description: 'Salón principal', tables: [1, 2, 3, 4] },
  { name: 'Terraza', description: 'Al aire libre', tables: [5, 6] },
];

export async function seedTables(dataSource: DataSource) {
  const sectorsRepo = dataSource.getRepository(Sector);
  const tablesRepo = dataSource.getRepository(RestaurantTable);

  for (const s of SECTORS) {
    let sector = await sectorsRepo.findOne({ where: { name: s.name } });
    if (!sector) {
      sector = await sectorsRepo.save(
        sectorsRepo.create({ name: s.name, description: s.description }),
      );
    }

    for (const number of s.tables) {
      const existing = await tablesRepo.findOne({ where: { sectorId: sector.id, number } });
      if (!existing) {
        await tablesRepo.save(
          tablesRepo.create({
            number,
            sectorId: sector.id,
            capacity: 4,
            status: 'available',
            qrCode: randomUUID(),
          }),
        );
      }
    }
  }

  console.log('✓ Tables seeded (sectores y mesas de ejemplo)');
}
