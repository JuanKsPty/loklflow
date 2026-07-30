import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Header, Query, StreamableFile } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { DateRangeDto } from './dto/date-range.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { UTF8_BOM, toCsv, type CsvColumn } from './csv';

/** Columnas del CSV de ventas, en el orden en que se exportan. */
const SALES_COLUMNS: CsvColumn<Record<string, unknown>>[] = [
  { key: 'processedAt', header: 'Fecha' },
  { key: 'orderNumber', header: 'Cuenta' },
  { key: 'method', header: 'Método' },
  { key: 'amount', header: 'Importe' },
  { key: 'reference', header: 'Referencia' },
  { key: 'subtotal', header: 'Subtotal orden' },
  { key: 'discountAmount', header: 'Descuento' },
  { key: 'tipAmount', header: 'Propina' },
  { key: 'orderTotal', header: 'Total orden' },
  { key: 'orderStatus', header: 'Estado' },
  { key: 'shiftId', header: 'Turno' },
];

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('sales-summary')
  @RequirePermissions('pos:read')
  salesSummary(@Query() range: DateRangeDto) {
    return this.reports.salesSummary(range);
  }

  @Get('top-products')
  @RequirePermissions('pos:read')
  topProducts(@Query() range: DateRangeDto) {
    return this.reports.topProducts(range);
  }

  @Get('prep-times')
  @RequirePermissions('pos:read')
  prepTimes(@Query() range: DateRangeDto) {
    return this.reports.prepTimes(range);
  }

  @Get('sales-by-day')
  @RequirePermissions('pos:read')
  salesByDay(@Query() range: DateRangeDto) {
    return this.reports.salesByDay(range);
  }

  /**
   * Exportación a CSV. Se usa StreamableFile, nativo en Nest 11, en lugar de manipular
   * la respuesta de Express a mano.
   */
  @Get('sales.csv')
  @RequirePermissions('pos:read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="ventas.csv"')
  async salesCsv(@Query() range: DateRangeDto) {
    const rows = await this.reports.salesRows(range);
    const csv = UTF8_BOM + toCsv(rows, SALES_COLUMNS);
    return new StreamableFile(Buffer.from(csv, 'utf-8'));
  }
}
