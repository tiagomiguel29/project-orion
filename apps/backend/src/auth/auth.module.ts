import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/user/entities/user.entity';
import { JwtGuard } from './jwt.guard';
import { UserPasskeyEntity } from './entities/user-passkey.entity';
import { MfaJwtGuard } from './mfa-jwt.guard';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, UserPasskeyEntity])],
  providers: [AuthService, JwtGuard, MfaJwtGuard,
    {
      provide: 'USER_JWT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new JwtService({ secret: config.get<string>('USER_JWT_SECRET') }),
    },
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
