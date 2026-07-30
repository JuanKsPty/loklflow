import { ApiTags } from '@nestjs/swagger';
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Público: los balanceadores y el pipeline de CI comprueban la salud sin credenciales.
  @Public()
  @Get('health')
  health(): { status: string } {
    return this.appService.health();
  }
}
