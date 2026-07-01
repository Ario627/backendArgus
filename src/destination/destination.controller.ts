import { DestinationService } from "./destination.service";
import { CreateDestinationDto } from "./dto/create-destination.dto";
import { UpdateDestinationDto } from "./dto/update-destination.dto";
import { Roles } from "src/common/decorators/roles.decorator";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

@Controller('destination')
export class DestinationController {
  constructor(private readonly destinationService: DestinationService) {}

  @Get()
  @Roles('admin', 'supervisor')
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.destinationService.findAll(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get(':id')
  @Roles('admin', 'supervisor')
  findOne(@Param('id') id: string) {
    return this.destinationService.findOne(id);
  }

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateDestinationDto) {
    return this.destinationService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateDestinationDto) {
    return this.destinationService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.destinationService.softDelete(id);
  }
}