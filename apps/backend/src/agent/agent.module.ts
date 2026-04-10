import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { AgentService } from './agent.service';
import { GrpcAgentJwtGuard } from './grpc-agent-auth.guard';

export const AGENT_JWT = 'AGENT_JWT';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: AGENT_JWT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new JwtService({ secret: config.get<string>('AGENT_JWT_SECRET') }),
    },
    AgentService,
    GrpcAgentJwtGuard,
  ],
  exports: [AgentService, GrpcAgentJwtGuard],
})
export class AgentModule {}
