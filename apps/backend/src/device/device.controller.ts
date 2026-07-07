import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { BaseResponse } from 'src/common/dtos/base-response';
import { JwtGuard } from 'src/auth/jwt.guard';

import { DeviceService } from './device.service';
import { AgentService } from 'src/agent/agent.service';

import { CreateDeviceDto } from './dtos/create-device.dto';
import { CreateDeviceResponseDto } from './dtos/create-device-response.dto';
import { ListDevicesResponseDto } from './dtos/list-devices.dto';
import { DashboardService } from './dashboard/dashboard.service';
import { DashboardRangeQueryDto } from './dtos/dashboard-range-query.dto';
import { DeviceCardDto } from './dtos/device-card.dto';

@Controller('devices')
export class DeviceController {
  constructor(
    private readonly devices: DeviceService,
    private readonly agents: AgentService,
    private readonly dashboard: DashboardService,
  ) {}

  @UseGuards(JwtGuard) // remove AdminGuard if not needed
  @Post()
  async createDevice(
    @Body() dto: CreateDeviceDto,
    @Req() req: any,
  ): Promise<BaseResponse<CreateDeviceResponseDto>> {
    const device = await this.devices.createDevice({
      externalId: dto.externalId,
      hostname: dto.hostname,
    });

    // Mint the durable enrollment token (sub=device.externalId). The agent
    // stores this once and exchanges it for short-lived access tokens.
    const token = this.agents.mintEnrollment(device.externalId);

    const payload = {
      token,
      device,
    };

    return new BaseResponse(
      true,
      'Device created',
      plainToInstance(CreateDeviceResponseDto, payload, {
        excludeExtraneousValues: true,
      }),
    );
  }

  @UseGuards(JwtGuard)
  @Delete(':externalId')
  async deleteDevice(
    @Param('externalId') externalId: string,
  ): Promise<BaseResponse<null>> {
    await this.devices.deleteDevice(externalId);
    // Revoke so any outstanding tokens for a reused externalId can't ingest.
    await this.agents.revoke(externalId);
    return new BaseResponse(true, 'Device and all related data deleted', null);
  }

  @UseGuards(JwtGuard)
  @Post(':externalId/revoke')
  async revokeDevice(
    @Param('externalId') externalId: string,
  ): Promise<BaseResponse<null>> {
    await this.agents.revoke(externalId);
    return new BaseResponse(true, 'Device credentials revoked', null);
  }

  @UseGuards(JwtGuard)
  @Get('dashboard')
  async dashboardLoad(): Promise<BaseResponse<ListDevicesResponseDto>> {
    const payload = await this.dashboard.getDashboardPayload();

    return new BaseResponse(
      true,
      'Dashboard loaded',
      plainToInstance(ListDevicesResponseDto, payload, { excludeExtraneousValues: true }),
    );
  }

  @UseGuards(JwtGuard)
  @Get('dashboard/:externalId')
  async dashboardDeviceLoad(
    @Param('externalId') externalId: string,
    @Query() query: DashboardRangeQueryDto,
  ): Promise<BaseResponse<DeviceCardDto>> {
    const payload = await this.dashboard.getDeviceDashboardPayload(externalId, query.range);

    return new BaseResponse(
      true,
      'Device dashboard loaded',
      plainToInstance(DeviceCardDto, payload, { excludeExtraneousValues: true }),
    );
  }
}
