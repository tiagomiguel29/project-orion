import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { Inject, OnModuleDestroy, UseGuards } from '@nestjs/common';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { RealtimeService } from './realtime.service';

// Honor the CORS_ORIGIN allowlist (comma-separated) rather than a blanket "*".
const wsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : '*';

@WebSocketGateway({
  cors: { origin: wsOrigin, credentials: false },
  pingInterval: 10000,
  pingTimeout: 5000,
})
export class RealtimeGateway implements OnModuleDestroy {
  private pubClient?: Redis;
  private subClient?: Redis;
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly realtime: RealtimeService,
    @Inject('REDIS_URL') private readonly redisUrl: string | null,
  ) {}

  afterInit() {
    if (this.redisUrl) {
      const pubClient = new Redis(this.redisUrl, { maxRetriesPerRequest: null });
      const subClient = pubClient.duplicate();
      this.pubClient = pubClient;
      this.subClient = subClient;
      this.server.adapter(createAdapter(pubClient, subClient));
      subClient.on('ready', () => this.server.local.emit('stream.recovered'));
      console.log('Socket.IO Redis adapter enabled');
    }
    this.realtime.setServer(this.server);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('subscribeDashboard')
  async subscribeDashboard(@ConnectedSocket() socket: any) {
    await socket.join('dashboard');
    return { ok: true, message: 'subscribed to dashboard' };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('subscribeDevice')
  async subscribeDevice(
    @MessageBody() body: { deviceId: string },
    @ConnectedSocket() socket: any,
  ) {
    const deviceId = body?.deviceId;
    if (!deviceId) return { ok: false, message: 'deviceId required' };

    await socket.join(this.realtime.deviceRoom(deviceId));
    return { ok: true, message: `subscribed to ${deviceId}` };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('unsubscribeDevice')
  async unsubscribeDevice(
    @MessageBody() body: { deviceId: string },
    @ConnectedSocket() socket: any,
  ) {
    if (!body?.deviceId) return { ok: false, message: 'deviceId required' };
    await socket.leave(this.realtime.deviceRoom(body.deviceId));
    return { ok: true };
  }

  onModuleDestroy() {
    this.pubClient?.disconnect();
    this.subClient?.disconnect();
  }
}
