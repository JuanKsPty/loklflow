import { useTestDatabase } from './env';

// Corre antes de que el archivo de test importe nada, y por tanto antes de `AppModule`.
// Ese orden es lo único que garantiza que la app se conecte a la base de pruebas: ni
// dotenv ni ConfigModule sobrescriben una variable que ya esté en process.env.
useTestDatabase();
