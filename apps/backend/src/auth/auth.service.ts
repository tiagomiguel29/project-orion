import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from '@simplewebauthn/server';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { generateSecret, generateURI, verify as verifyOtp } from 'otplib';
import { UserEntity } from 'src/user/entities/user.entity';
import { UserPasskeyEntity } from './entities/user-passkey.entity';
import { MfaMethod } from './dtos/login-response.dto';

export type UserJwtPayload = {
  sub: string;           // userId
  role: UserEntity['role'];
  scope: 'api' | 'mfa';
};

const MFA_CHALLENGE_WINDOW_MS = 10 * 60 * 1000;
const MFA_PENDING_TOKEN_TTL = '10m';
const DEFAULT_WEBAUTHN_ORIGIN = 'http://localhost:3000';
const DEFAULT_WEBAUTHN_RP_NAME = 'SCOPE';
const TOTP_ISSUER = 'SCOPE';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(UserPasskeyEntity)
    private readonly passkeysRepo: Repository<UserPasskeyEntity>,
    private readonly config: ConfigService,
    @Inject('USER_JWT') private readonly jwt: JwtService,
  ) {}

  async setupRequired(): Promise<boolean> {
    const count = await this.usersRepo.count();
    return count === 0;
  }

  async registerFirst(name: string, email: string, password: string) {
    const count = await this.usersRepo.count();
    if (count > 0) {
      throw new ForbiddenException('Setup already completed');
    }

    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.usersRepo.save(
      this.usersRepo.create({
        email: email.toLowerCase(),
        name,
        passwordHash,
        role: 'admin',
        isActive: true,
      }),
    );

    return this.issueApiToken(user);
  }

  async login(email: string, password: string) {
    const user = await this.usersRepo.findOne({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passkeyCount = await this.passkeysRepo.count({ where: { userId: user.id } });
    const availableMethods = this.getMfaMethods(user, passkeyCount);

    if (availableMethods.length === 0) {
      return this.issueApiToken(user);
    }

    return {
      mfaRequired: true,
      pendingToken: this.issuePendingMfaToken(user),
      availableMethods,
    };
  }

  verifyUserToken(token: string): UserJwtPayload {
    return this.verifyScopedToken(token, 'api');
  }

  verifyMfaToken(token: string): UserJwtPayload {
    return this.verifyScopedToken(token, 'mfa');
  }

  async verifyTotpMfa(userId: string, code: string) {
    const user = await this.findUserByIdOrThrow(userId);
    if (!user.totpEnabled || !user.totpSecretEncrypted) {
      throw new BadRequestException('TOTP is not enabled for this account');
    }

    const result = await verifyOtp({
      secret: this.decryptSecret(user.totpSecretEncrypted),
      token: this.normalizeOtpCode(code),
    });

    if (!result.valid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    return this.issueApiToken(user);
  }

  async getMfaStatus(userId: string) {
    const user = await this.findUserByIdOrThrow(userId);
    const passkeys = await this.passkeysRepo.find({
      where: { userId: user.id },
      order: { createdAt: 'ASC' },
    });

    return {
      totpEnabled: Boolean(user.totpEnabled && user.totpSecretEncrypted),
      availableMethods: this.getMfaMethods(user, passkeys.length),
      passkeys: passkeys.map((passkey) => ({
        id: passkey.id,
        name: passkey.name,
        deviceType: passkey.deviceType,
        backedUp: passkey.backedUp,
        createdAt: passkey.createdAt,
        lastUsedAt: passkey.lastUsedAt,
      })),
    };
  }

  async beginTotpSetup(userId: string) {
    const user = await this.findUserByIdOrThrow(userId);

    if (user.totpEnabled && user.totpSecretEncrypted) {
      throw new BadRequestException('TOTP is already enabled');
    }

    const secret = generateSecret();
    const issuer = this.config.get<string>('TOTP_ISSUER') ?? TOTP_ISSUER;
    const accountName = user.email;

    user.totpPendingSecretEncrypted = this.encryptSecret(secret);
    await this.usersRepo.save(user);

    return {
      secret,
      issuer,
      accountName,
      uri: generateURI({
        issuer,
        label: accountName,
        secret,
      }),
    };
  }

  async confirmTotpSetup(userId: string, code: string) {
    const user = await this.findUserByIdOrThrow(userId);
    if (!user.totpPendingSecretEncrypted) {
      throw new BadRequestException('No pending TOTP setup found');
    }

    const secret = this.decryptSecret(user.totpPendingSecretEncrypted);
    const result = await verifyOtp({
      secret,
      token: this.normalizeOtpCode(code),
    });

    if (!result.valid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    user.totpSecretEncrypted = this.encryptSecret(secret);
    user.totpPendingSecretEncrypted = null;
    user.totpEnabled = true;
    await this.usersRepo.save(user);

    return this.getMfaStatus(user.id);
  }

  async disableTotp(userId: string) {
    const user = await this.findUserByIdOrThrow(userId);
    user.totpEnabled = false;
    user.totpSecretEncrypted = null;
    user.totpPendingSecretEncrypted = null;
    await this.usersRepo.save(user);

    return this.getMfaStatus(user.id);
  }

  async beginPasskeyRegistration(userId: string, originHeader?: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const user = await this.findUserByIdOrThrow(userId);
    const passkeys = await this.passkeysRepo.find({ where: { userId: user.id } });
    const webAuthn = this.resolveWebAuthnContext(originHeader);

    const options = await generateRegistrationOptions({
      rpName: webAuthn.rpName,
      rpID: webAuthn.rpId,
      userName: user.email,
      userID: Buffer.from(user.id, 'utf8'),
      userDisplayName: user.name,
      excludeCredentials: passkeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: this.toAuthenticatorTransports(passkey.transports),
      })),
    });

    await this.storeMfaChallenge(user, {
      challenge: options.challenge,
      purpose: 'passkey-registration',
      origin: webAuthn.origin,
      rpId: webAuthn.rpId,
    });

    return options;
  }

  async finishPasskeyRegistration(userId: string, response: RegistrationResponseJSON, name?: string) {
    const user = await this.findUserByIdOrThrow(userId);
    const challenge = await this.assertActiveMfaChallenge(user, 'passkey-registration');

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.origin,
      expectedRPID: challenge.rpId,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new UnauthorizedException('Passkey registration could not be verified');
    }

    const credentialId = verification.registrationInfo.credential.id;
    const existingCredential = await this.passkeysRepo.findOne({ where: { credentialId } });
    if (existingCredential) {
      throw new ConflictException('This passkey is already registered');
    }

    const existingCount = await this.passkeysRepo.count({ where: { userId: user.id } });

    await this.passkeysRepo.save(
      this.passkeysRepo.create({
        userId: user.id,
        name: this.getPasskeyName(name, existingCount + 1),
        credentialId,
        publicKey: Buffer.from(verification.registrationInfo.credential.publicKey).toString('base64url'),
        counter: verification.registrationInfo.credential.counter,
        transports: verification.registrationInfo.credential.transports ?? null,
        deviceType: verification.registrationInfo.credentialDeviceType,
        backedUp: verification.registrationInfo.credentialBackedUp,
        lastUsedAt: null,
      }),
    );

    await this.clearMfaChallenge(user);

    return this.getMfaStatus(user.id);
  }

  async beginPasskeyAuthentication(userId: string, originHeader?: string): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const user = await this.findUserByIdOrThrow(userId);
    const passkeys = await this.passkeysRepo.find({ where: { userId: user.id } });
    if (passkeys.length === 0) {
      throw new BadRequestException('No passkeys are registered for this account');
    }

    const webAuthn = this.resolveWebAuthnContext(originHeader);
    const options = await generateAuthenticationOptions({
      rpID: webAuthn.rpId,
      allowCredentials: passkeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: this.toAuthenticatorTransports(passkey.transports),
      })),
      userVerification: 'discouraged',
    });

    await this.storeMfaChallenge(user, {
      challenge: options.challenge,
      purpose: 'passkey-authentication',
      origin: webAuthn.origin,
      rpId: webAuthn.rpId,
    });

    return options;
  }

  async finishPasskeyAuthentication(userId: string, response: AuthenticationResponseJSON) {
    const user = await this.findUserByIdOrThrow(userId);
    const challenge = await this.assertActiveMfaChallenge(user, 'passkey-authentication');
    const passkey = await this.passkeysRepo.findOne({
      where: {
        userId: user.id,
        credentialId: response.id,
      },
    });

    if (!passkey) {
      throw new UnauthorizedException('Passkey not recognized');
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.origin,
      expectedRPID: challenge.rpId,
      credential: this.toWebAuthnCredential(passkey),
      requireUserVerification: false,
    });

    if (!verification.verified) {
      throw new UnauthorizedException('Passkey verification failed');
    }

    passkey.counter = verification.authenticationInfo.newCounter;
    passkey.deviceType = verification.authenticationInfo.credentialDeviceType;
    passkey.backedUp = verification.authenticationInfo.credentialBackedUp;
    passkey.lastUsedAt = new Date();
    await this.passkeysRepo.save(passkey);
    await this.clearMfaChallenge(user);

    return this.issueApiToken(user);
  }

  async deletePasskey(userId: string, passkeyId: string) {
    const passkey = await this.passkeysRepo.findOne({ where: { id: passkeyId, userId } });
    if (!passkey) {
      throw new BadRequestException('Passkey not found');
    }

    await this.passkeysRepo.remove(passkey);
    return this.getMfaStatus(userId);
  }

  async changeName(userId: string, newName: string) {
    const user = await this.findUserByIdOrThrow(userId);
    const name = newName.trim();
    if (!name) {
      throw new BadRequestException('Name cannot be empty');
    }

    user.name = name;
    await this.usersRepo.save(user);
  }

  async changeEmail(userId: string, newEmail: string) {
    const user = await this.findUserByIdOrThrow(userId);
    const email = newEmail.trim().toLowerCase();

    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing && existing.id !== user.id) {
      throw new ConflictException('Email already in use');
    }

    user.email = email;
    await this.usersRepo.save(user);
  }

  private issueApiToken(user: UserEntity) {
    const token = this.jwt.sign({
      sub: user.id,
      role: user.role,
      scope: 'api',
    });

    return {
      mfaRequired: false,
      token,
      user: this.toAuthUser(user),
    };
  }

  private issuePendingMfaToken(user: UserEntity): string {
    return this.jwt.sign(
      {
        sub: user.id,
        role: user.role,
        scope: 'mfa',
      },
      { expiresIn: MFA_PENDING_TOKEN_TTL },
    );
  }

  async getMe(userId: string) {
    const user = await this.findUserByIdOrThrow(userId);
    return this.toAuthUser(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.findUserByIdOrThrow(userId);

    const validCurrentPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validCurrentPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await this.usersRepo.save(user);
  }

  private verifyScopedToken(token: string, expectedScope: UserJwtPayload['scope']): UserJwtPayload {
    try {
      const payload = this.jwt.verify<{ sub: string; role: string; scope: string }>(token);
      if (!payload?.sub || payload.scope !== expectedScope) {
        throw new UnauthorizedException('Invalid token');
      }

      return {
        sub: payload.sub,
        role: payload.role as UserEntity['role'],
        scope: payload.scope as UserJwtPayload['scope'],
      };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private async findUserByIdOrThrow(userId: string): Promise<UserEntity> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private toAuthUser(user: UserEntity) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  private getMfaMethods(user: UserEntity, passkeyCount: number): MfaMethod[] {
    const methods: MfaMethod[] = [];

    if (passkeyCount > 0) {
      methods.push('passkey');
    }

    if (user.totpEnabled && user.totpSecretEncrypted) {
      methods.push('totp');
    }

    return methods;
  }

  private async storeMfaChallenge(
    user: UserEntity,
    options: { challenge: string; purpose: string; origin: string; rpId: string },
  ) {
    user.mfaChallenge = options.challenge;
    user.mfaChallengePurpose = options.purpose;
    user.mfaChallengeOrigin = options.origin;
    user.mfaChallengeRpId = options.rpId;
    user.mfaChallengeExpiresAt = new Date(Date.now() + MFA_CHALLENGE_WINDOW_MS);
    await this.usersRepo.save(user);
  }

  private async assertActiveMfaChallenge(user: UserEntity, purpose: string) {
    if (
      !user.mfaChallenge ||
      user.mfaChallengePurpose !== purpose ||
      !user.mfaChallengeOrigin ||
      !user.mfaChallengeRpId ||
      !user.mfaChallengeExpiresAt
    ) {
      throw new UnauthorizedException('MFA challenge not found');
    }

    if (user.mfaChallengeExpiresAt.getTime() < Date.now()) {
      await this.clearMfaChallenge(user);
      throw new UnauthorizedException('MFA challenge expired');
    }

    return {
      challenge: user.mfaChallenge,
      origin: user.mfaChallengeOrigin,
      rpId: user.mfaChallengeRpId,
    };
  }

  private async clearMfaChallenge(user: UserEntity) {
    user.mfaChallenge = null;
    user.mfaChallengePurpose = null;
    user.mfaChallengeOrigin = null;
    user.mfaChallengeRpId = null;
    user.mfaChallengeExpiresAt = null;
    await this.usersRepo.save(user);
  }

  private resolveWebAuthnContext(originHeader?: string) {
    const configuredOrigins = this.parseConfiguredOrigins(
      this.config.get<string>('WEBAUTHN_ORIGIN') ?? this.config.get<string>('CORS_ORIGIN'),
    );
    const origin =
      configuredOrigins.find((value) => value === originHeader) ??
      originHeader ??
      configuredOrigins[0] ??
      DEFAULT_WEBAUTHN_ORIGIN;

    const rpId = this.config.get<string>('WEBAUTHN_RP_ID') ?? this.getHostFromOrigin(origin) ?? 'localhost';
    const rpName = this.config.get<string>('WEBAUTHN_RP_NAME') ?? DEFAULT_WEBAUTHN_RP_NAME;

    return { origin, rpId, rpName };
  }

  private parseConfiguredOrigins(rawValue?: string): string[] {
    if (!rawValue || rawValue === '*') {
      return [];
    }

    return rawValue
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private getHostFromOrigin(origin?: string): string | null {
    if (!origin) {
      return null;
    }

    try {
      return new URL(origin).hostname;
    } catch {
      return null;
    }
  }

  private getEncryptionKey(): Buffer {
    const secret = this.config.get<string>('MFA_ENCRYPTION_SECRET')
      ?? this.config.get<string>('USER_JWT_SECRET')
      ?? 'scope-mfa-secret';

    return createHash('sha256').update(secret).digest();
  }

  private encryptSecret(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv, authTag, encrypted].map((value) => value.toString('base64url')).join('.');
  }

  private decryptSecret(payload: string): string {
    const [iv, authTag, encrypted] = payload.split('.');
    if (!iv || !authTag || !encrypted) {
      throw new UnauthorizedException('Stored MFA secret is invalid');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getEncryptionKey(),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(authTag, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private normalizeOtpCode(code: string): string {
    return code.replace(/[\s-]/g, '');
  }

  private getPasskeyName(name: string | undefined, ordinal: number): string {
    const trimmed = name?.trim();
    if (trimmed) {
      return trimmed;
    }

    return `Passkey ${ordinal}`;
  }

  private toAuthenticatorTransports(
    transports: string[] | null | undefined,
  ): AuthenticatorTransportFuture[] | undefined {
    if (!transports?.length) {
      return undefined;
    }

    return transports as AuthenticatorTransportFuture[];
  }

  private toWebAuthnCredential(passkey: UserPasskeyEntity): WebAuthnCredential {
    return {
      id: passkey.credentialId,
      publicKey: Buffer.from(passkey.publicKey, 'base64url'),
      counter: passkey.counter,
      transports: this.toAuthenticatorTransports(passkey.transports),
    };
  }
}
