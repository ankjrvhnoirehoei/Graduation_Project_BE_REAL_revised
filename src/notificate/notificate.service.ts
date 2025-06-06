import { Injectable } from '@nestjs/common';
import { CreateNotificateDto } from './dto/create-notificate.dto';
import { UpdateNotificateDto } from './dto/update-notificate.dto';

@Injectable()
export class NotificateService {
  create(createNotificateDto: CreateNotificateDto) {
    return 'This action adds a new notificate';
  }

  findAll() {
    return `This action returns all notificate`;
  }

  findOne(id: number) {
    return `This action returns a #${id} notificate`;
  }

  update(id: number, updateNotificateDto: UpdateNotificateDto) {
    return `This action updates a #${id} notificate`;
  }

  remove(id: number) {
    return `This action removes a #${id} notificate`;
  }
}
