import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { UserPasskeyEntity } from './entities/user-passkey.entity';

// bcrypt's native exports are non-configurable, so jest.spyOn can't redefine
// them — mock the module instead.
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersRepo: jest.Mocked<Repository<UserEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserPasskeyEntity),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(), getOrThrow: jest.fn() },
        },
        {
          provide: 'USER_JWT',
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepo = module.get(getRepositoryToken(UserEntity));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('changes password when current password is valid', async () => {
    const user = {
      id: 'user-1',
      isActive: true,
      passwordHash: 'old-hash',
    } as UserEntity;

    usersRepo.findOne.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
    usersRepo.save.mockResolvedValue(user);

    await service.changePassword('user-1', 'current-password', 'new-password-1');

    expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(usersRepo.save).toHaveBeenCalledWith(expect.objectContaining({ passwordHash: 'new-hash' }));
  });

  it('throws when current password is invalid', async () => {
    const user = {
      id: 'user-1',
      isActive: true,
      passwordHash: 'old-hash',
    } as UserEntity;

    usersRepo.findOne.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.changePassword('user-1', 'wrong-password', 'new-password-1')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usersRepo.save).not.toHaveBeenCalled();
  });
});
