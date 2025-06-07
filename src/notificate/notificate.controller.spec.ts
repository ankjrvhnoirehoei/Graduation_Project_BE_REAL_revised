import { Test, TestingModule } from '@nestjs/testing';
import { NotificateController } from './notificate.controller';
import { NotificateService } from './notificate.service';

describe('NotificateController', () => {
  let controller: NotificateController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificateController],
      providers: [NotificateService],
    }).compile();

    controller = module.get<NotificateController>(NotificateController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
