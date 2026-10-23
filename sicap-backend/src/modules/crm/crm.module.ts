import { Module } from '@nestjs/common';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { PurchaseAlertsService } from './purchase-alerts.service';

@Module({
  controllers: [CrmController],
  providers: [CrmService, PurchaseAlertsService],
  exports: [CrmService],
})
export class CrmModule {}
