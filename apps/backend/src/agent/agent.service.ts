import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export type AgentJwtPayload = {
  sub: string;           // deviceId
  scope: 'ingest';
};
@Injectable()
export class AgentService {
    constructor(@Inject('AGENT_JWT') private readonly jwt: JwtService) {}

    mint(deviceId: string): string {
      const payload: AgentJwtPayload = { sub: deviceId, scope: 'ingest' };
      // No expiration (as requested)
      return this.jwt.sign(payload);
    }
  
    verify(token: string): AgentJwtPayload {
      try {
        const payload = this.jwt.verify<AgentJwtPayload>(token);
        if (!payload?.sub || payload.scope !== 'ingest') {
          throw new UnauthorizedException('Invalid agent token payload');
        }
        return payload;
      } catch {
        throw new UnauthorizedException('Invalid agent token');
      }
    }
}
