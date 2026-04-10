import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<any>();

    // socket.io: token can be passed via handshake auth or query
    const token =
      client?.handshake?.auth?.token ||
      client?.handshake?.headers?.authorization?.replace('Bearer ', '') ||
      client?.handshake?.query?.token;

    if (!token || typeof token !== 'string') return false;

    const payload = this.auth.verifyUserToken(token);
    client.user = { userId: payload.sub, role: payload.role };

    return true;
  }
}
