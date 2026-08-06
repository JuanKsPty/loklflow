import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Público: los balanceadores y el pipeline de CI comprueban la salud sin credenciales.
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'El proceso responde. No consulta la base de datos.' })
  health(): { status: string } {
    return this.appService.health();
  }

  @Public()
  @Get('ready')
  @ApiOperation({
    summary: 'El proceso puede atender: responde y la base de datos contesta.',
    description:
      'Devuelve 503 si la base no responde. Es lo que hay que vigilar desde fuera; ' +
      '`/health` no detecta el fallo más probable, que es justo ese.',
  })
  async ready(): Promise<{ status: string; database: string }> {
    const result = await this.appService.ready();
    if (!result.ok) {
      // El motivo concreto se queda en el log del servidor: este endpoint es público y el
      // mensaje del driver incluye el host y el puerto de la base.
      throw new ServiceUnavailableException('La base de datos no responde');
    }
    return { status: 'ok', database: 'up' };
  }
}
