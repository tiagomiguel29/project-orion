import { Test, TestingModule } from '@nestjs/testing';
import { MetricsQueueService } from './metrics-queue.service';

describe('MetricsQueueService', () => {
  let service: MetricsQueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsQueueService],
    }).compile();

    service = module.get<MetricsQueueService>(MetricsQueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
