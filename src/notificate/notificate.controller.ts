import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { NotificateService } from './notificate.service';
import { CreateNotificateDto } from './dto/create-notificate.dto';
import { UpdateNotificateDto } from './dto/update-notificate.dto';

@Controller('notificate')
export class NotificateController {
  constructor(private readonly notificateService: NotificateService) {}

  @Post()
  create(@Body() createNotificateDto: CreateNotificateDto) {
    return this.notificateService.create(createNotificateDto);
  }

  @Get()
  findAll() {
    return this.notificateService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.notificateService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateNotificateDto: UpdateNotificateDto) {
    return this.notificateService.update(+id, updateNotificateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.notificateService.remove(+id);
  }
}
