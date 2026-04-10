import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RealtimeService } from './realtime.service';
import { RealtimeGateway } from './realtime.gateway';
import { AgentModule } from 'src/agent/agent.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AgentModule, AuthModule],
  providers: [
    RealtimeService,
    RealtimeGateway,
    {
      provide: 'REDIS_URL',
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => cfg.get<string>('REDIS_URL') ?? null,
    },
  ],
  exports: [RealtimeService],
})
export class RealtimeModule {}
