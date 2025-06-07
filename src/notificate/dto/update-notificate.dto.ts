import { PartialType } from '@nestjs/swagger';
import { CreateNotificateDto } from './create-notificate.dto';

export class UpdateNotificateDto extends PartialType(CreateNotificateDto) {}
