import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { Inject, UseGuards } from '@nestjs/common';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { RealtimeService } from './realtime.service';

@WebSocketGateway({
  cors: { origin: '*', credentials: false },
})
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly realtime: RealtimeService,
    @Inject('REDIS_URL') private readonly redisUrl: string | null,
  ) {}

  afterInit() {
    if (this.redisUrl) {
      const pubClient = new Redis(this.redisUrl);
      const subClient = pubClient.duplicate();
      this.server.adapter(createAdapter(pubClient, subClient));
      console.log('Socket.IO Redis adapter enabled');
    }
    this.realtime.setServer(this.server);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('subscribeDashboard')
  async subscribeDashboard(@ConnectedSocket() socket: any) {
    socket.join('dashboard');
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

    socket.join(this.realtime.deviceRoom(deviceId));
    return { ok: true, message: `subscribed to ${deviceId}` };
  }
}
