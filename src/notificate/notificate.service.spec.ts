import { Test, TestingModule } from '@nestjs/testing';
import { NotificateService } from './notificate.service';

describe('NotificateService', () => {
  let service: NotificateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificateService],
    }).compile();

    service = module.get<NotificateService>(NotificateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
