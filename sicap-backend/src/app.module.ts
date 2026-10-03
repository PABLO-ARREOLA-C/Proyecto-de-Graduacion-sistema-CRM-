import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CrmModule } from './modules/crm/crm.module';
import { LogisticsModule } from './modules/logistics/logistics.module';
import { FinancesModule } from './modules/finances/finances.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    ClientsModule,
    ProductsModule,
    OrdersModule,
    CrmModule,
    LogisticsModule,
    FinancesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
