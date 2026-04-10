import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { AgentService } from './agent.service';

@Injectable()
export class GrpcAgentJwtGuard implements CanActivate {
  constructor(private readonly auth: AgentService) {}

  canActivate(context: ExecutionContext): boolean {
    const metadata = context.switchToRpc().getContext();

    const authHeader = metadata?.get('authorization')?.[0] as
      | string
      | undefined;

    if (!authHeader) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Missing authorization',
      });
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : authHeader.trim();

    if (!token) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Missing token',
      });
    }

    try {
      const payload = this.auth.verify(token);
      // attach authenticated deviceId
      context.switchToRpc().getContext().agent = { deviceId: payload.sub };
    } catch (error) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Invalid token',
      });
    }

    return true;
  }
}
