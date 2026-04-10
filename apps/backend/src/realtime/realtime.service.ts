import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  emitToDevice(deviceId: string, event: string, payload: any) {
    if (!this.server) return;
    this.server.to(this.deviceRoom(deviceId)).emit(event, payload);
  }

  emitToDashboard(event: string, payload: any) {
    if (!this.server) return;
    this.server.to('dashboard').emit(event, payload);
  }

  deviceRoom(deviceId: string) {
    return `device:${deviceId}`;
  }
}
