import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterFirstDto } from './dtos/register-first.dto';
import { LoginDto } from './dtos/login.dto';
import { JwtGuard } from './jwt.guard';
import { BaseResponse } from 'src/common/dtos/base-response';
import { SetupRequiredDto } from './dtos/setup-required.dto';
import { plainToInstance } from 'class-transformer';
import { SuccessLoginDto } from './dtos/success-login.dto';
import { MeDto } from './dtos/me.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { LoginResponseDto } from './dtos/login-response.dto';
import { MfaJwtGuard } from './mfa-jwt.guard';
import { VerifyTotpDto } from './dtos/verify-totp.dto';
import { MfaStatusDto } from './dtos/mfa-status.dto';
import { TotpSetupStartDto } from './dtos/totp-setup-start.dto';
import { VerifyPasskeyRegistrationDto } from './dtos/verify-passkey-registration.dto';
import { VerifyPasskeyAuthenticationDto } from './dtos/verify-passkey-authentication.dto';
import { UpdateNameDto } from './dtos/update-name.dto';
import { UpdateEmailDto } from './dtos/update-email.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('setup')
  async setup(): Promise<BaseResponse<SetupRequiredDto>> {
    return new BaseResponse(true, 'Setup required', plainToInstance(SetupRequiredDto, { setupRequired: await this.auth.setupRequired() }));
  }

  @Post('register-first')
  async registerFirst(@Body() dto: RegisterFirstDto): Promise<BaseResponse<SuccessLoginDto>> {
    return new BaseResponse(true, 'Registration successful', plainToInstance(SuccessLoginDto, await this.auth.registerFirst(dto.name, dto.email, dto.password)));
  }

  @Post('login')
  async login(@Body() dto: LoginDto): Promise<BaseResponse<LoginResponseDto>> {
    return new BaseResponse(true, 'Login successful', plainToInstance(LoginResponseDto, await this.auth.login(dto.email, dto.password)));
  }

  @UseGuards(JwtGuard)
  @Get('me')
  async me(@Req() req: any): Promise<BaseResponse<MeDto>> {
    return new BaseResponse(true, 'User information', plainToInstance(MeDto, await this.auth.getMe(req.user.userId)));
  }

  @UseGuards(JwtGuard)
  @Post('change-password')
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto): Promise<BaseResponse<null>> {
    await this.auth.changePassword(req.user.userId, dto.currentPassword, dto.newPassword);
    return new BaseResponse(true, 'Password changed successfully');
  }

  @UseGuards(JwtGuard)
  @Post('change-name')
  async changeName(@Req() req: any, @Body() dto: UpdateNameDto): Promise<BaseResponse<null>> {
    await this.auth.changeName(req.user.userId, dto.newName);
    return new BaseResponse(true, 'Name changed successfully');
  }

  @UseGuards(JwtGuard)
  @Post('change-email')
  async changeEmail(@Req() req: any, @Body() dto: UpdateEmailDto): Promise<BaseResponse<null>> {
    await this.auth.changeEmail(req.user.userId, dto.newEmail);
    return new BaseResponse(true, 'Email changed successfully');
  }

  @UseGuards(MfaJwtGuard)
  @Post('mfa/totp/verify')
  async verifyTotp(@Req() req: any, @Body() dto: VerifyTotpDto): Promise<BaseResponse<SuccessLoginDto>> {
    return new BaseResponse(
      true,
      'TOTP verified successfully',
      plainToInstance(SuccessLoginDto, await this.auth.verifyTotpMfa(req.user.userId, dto.code)),
    );
  }

  @UseGuards(JwtGuard)
  @Get('mfa/status')
  async getMfaStatus(@Req() req: any): Promise<BaseResponse<MfaStatusDto>> {
    return new BaseResponse(
      true,
      'MFA status',
      plainToInstance(MfaStatusDto, await this.auth.getMfaStatus(req.user.userId)),
    );
  }

  @UseGuards(JwtGuard)
  @Post('mfa/totp/setup')
  async beginTotpSetup(@Req() req: any): Promise<BaseResponse<TotpSetupStartDto>> {
    return new BaseResponse(
      true,
      'TOTP setup started',
      plainToInstance(TotpSetupStartDto, await this.auth.beginTotpSetup(req.user.userId)),
    );
  }

  @UseGuards(JwtGuard)
  @Post('mfa/totp/confirm')
  async confirmTotpSetup(@Req() req: any, @Body() dto: VerifyTotpDto): Promise<BaseResponse<MfaStatusDto>> {
    return new BaseResponse(
      true,
      'TOTP enabled successfully',
      plainToInstance(MfaStatusDto, await this.auth.confirmTotpSetup(req.user.userId, dto.code)),
    );
  }

  @UseGuards(JwtGuard)
  @Delete('mfa/totp')
  async disableTotp(@Req() req: any): Promise<BaseResponse<MfaStatusDto>> {
    return new BaseResponse(
      true,
      'TOTP disabled successfully',
      plainToInstance(MfaStatusDto, await this.auth.disableTotp(req.user.userId)),
    );
  }

  @UseGuards(JwtGuard)
  @Post('mfa/passkeys/registration-options')
  async beginPasskeyRegistration(@Req() req: any): Promise<BaseResponse<any>> {
    return new BaseResponse(
      true,
      'Passkey registration options generated',
      await this.auth.beginPasskeyRegistration(req.user.userId, req.headers?.origin),
    );
  }

  @UseGuards(JwtGuard)
  @Post('mfa/passkeys/register')
  async finishPasskeyRegistration(
    @Req() req: any,
    @Body() dto: VerifyPasskeyRegistrationDto,
  ): Promise<BaseResponse<MfaStatusDto>> {
    return new BaseResponse(
      true,
      'Passkey registered successfully',
      plainToInstance(
        MfaStatusDto,
        await this.auth.finishPasskeyRegistration(req.user.userId, dto.response, dto.name),
      ),
    );
  }

  @UseGuards(MfaJwtGuard)
  @Post('mfa/passkeys/authentication-options')
  async beginPasskeyAuthentication(@Req() req: any): Promise<BaseResponse<any>> {
    return new BaseResponse(
      true,
      'Passkey authentication options generated',
      await this.auth.beginPasskeyAuthentication(req.user.userId, req.headers?.origin),
    );
  }

  @UseGuards(MfaJwtGuard)
  @Post('mfa/passkeys/authenticate')
  async finishPasskeyAuthentication(
    @Req() req: any,
    @Body() dto: VerifyPasskeyAuthenticationDto,
  ): Promise<BaseResponse<SuccessLoginDto>> {
    return new BaseResponse(
      true,
      'Passkey verified successfully',
      plainToInstance(SuccessLoginDto, await this.auth.finishPasskeyAuthentication(req.user.userId, dto.response)),
    );
  }

  @UseGuards(JwtGuard)
  @Delete('mfa/passkeys/:passkeyId')
  async deletePasskey(@Req() req: any, @Param('passkeyId') passkeyId: string): Promise<BaseResponse<MfaStatusDto>> {
    return new BaseResponse(
      true,
      'Passkey removed successfully',
      plainToInstance(MfaStatusDto, await this.auth.deletePasskey(req.user.userId, passkeyId)),
    );
  }
}
