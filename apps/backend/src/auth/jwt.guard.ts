import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & any>();

    const header = (req.headers as any)?.authorization as string | undefined;
    if (!header) return false;

    const token = header.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : header.trim();

    if (!token) return false;

    const payload = this.auth.verifyUserToken(token);
    req.user = { userId: payload.sub, role: payload.role };

    return true;
  }
}
