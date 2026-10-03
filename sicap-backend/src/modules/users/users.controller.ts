import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
@Controller('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) idUsuario: string) {
    return this.usersService.findOne(idUsuario);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) idUsuario: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(idUsuario, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) idUsuario: string) {
    return this.usersService.remove(idUsuario);
  }
}
