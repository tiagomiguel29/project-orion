import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from 'src/user/entities/user.entity';

@Entity('user_passkeys')
export class UserPasskeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  @Index({ unique: true })
  credentialId: string;

  @Column({ type: 'text' })
  publicKey: string;

  @Column({ type: 'integer', default: 0 })
  counter: number;

  @Column({ type: 'simple-json', nullable: true })
  transports: string[] | null;

  @Column({ type: 'text', nullable: true })
  deviceType: string | null;

  @Column({ type: 'boolean', default: false })
  backedUp: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
