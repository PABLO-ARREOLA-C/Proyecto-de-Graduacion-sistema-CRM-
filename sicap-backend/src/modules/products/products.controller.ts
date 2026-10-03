import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { ProductsService } from './products.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Roles('Administrador')
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Roles('Administrador', 'Repartidor')
  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Roles('Administrador', 'Repartidor')
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.productsService.findOne(id);
  }

  @Roles('Administrador')
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  @Roles('Administrador')
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.productsService.remove(id);
  }

  @Roles('Administrador')
  @Post(':id/promotions')
  createPromotion(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreatePromotionDto,
  ) {
    return this.productsService.createPromotion(id, dto);
  }

  @Roles('Administrador', 'Repartidor')
  @Get(':id/promotions')
  findPromotions(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.productsService.findPromotions(id);
  }

  @Roles('Administrador')
  @Patch(':id/promotions/:promotionId')
  updatePromotion(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('promotionId', new ParseUUIDPipe())
    promotionId: string,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.productsService.updatePromotion(id, promotionId, dto);
  }

  @Roles('Administrador')
  @Delete(':id/promotions/:promotionId')
  removePromotion(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('promotionId', new ParseUUIDPipe())
    promotionId: string,
  ) {
    return this.productsService.removePromotion(id, promotionId);
  }
}
