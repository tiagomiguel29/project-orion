import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type UserRole = 'admin' | 'user';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  @Index({ unique: true })
  email: string;

  @Column({ type: 'text' })
  passwordHash: string;

  @Column({ type: 'text', default: 'user' })
  role: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  totpEnabled: boolean;

  @Column({ type: 'text', nullable: true })
  totpSecretEncrypted: string | null;

  @Column({ type: 'text', nullable: true })
  totpPendingSecretEncrypted: string | null;

  @Column({ type: 'text', nullable: true })
  mfaChallenge: string | null;

  @Column({ type: 'text', nullable: true })
  mfaChallengePurpose: string | null;

  @Column({ type: 'text', nullable: true })
  mfaChallengeOrigin: string | null;

  @Column({ type: 'text', nullable: true })
  mfaChallengeRpId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  mfaChallengeExpiresAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
