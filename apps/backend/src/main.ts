import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import morgan from 'morgan';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const config = app.get(ConfigService);
 

  const httpPort = Number(config.get('HTTP_PORT', 3000));
  const grpcPort = Number(config.get('GRPC_PORT', 50051));

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      url: `0.0.0.0:${grpcPort}`,
      package: 'telemetry.v1',
      protoPath: join(__dirname, 'proto/telemetry.proto'),
    },
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));

  app.use(morgan('dev'));

  // Enable CORS with origin from env var and default to * if not set
  const corsOrigin = config.get('CORS_ORIGIN', '*');
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  await app.startAllMicroservices();
  await app.listen(httpPort);

  console.log(`HTTP listening on http://localhost:${httpPort}`);
  console.log(`gRPC listening on 0.0.0.0:${grpcPort}`);
}

bootstrap();
