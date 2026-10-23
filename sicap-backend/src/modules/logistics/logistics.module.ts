import { Module } from '@nestjs/common';
import { LogisticsController } from './logistics.controller';
import { LogisticsService } from './logistics.service';
import { RouteAccessGuard } from './route-access.guard';

@Module({
  controllers: [LogisticsController],
  providers: [LogisticsService, RouteAccessGuard],
  exports: [LogisticsService],
})
export class LogisticsModule {}
