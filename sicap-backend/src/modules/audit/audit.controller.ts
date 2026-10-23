import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class AuditController {
  constructor(private readonly audit: AuditService) {}
  @Get('options')
  options() {
    return this.audit.options();
  }
  @Get()
  list(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }
}
