import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SocketAppModule } from './socket-app.module';

async function bootstrap() {
  const app = await NestFactory.create(SocketAppModule);
  const port = Number(process.env.SOCKET_PORT || 3002);

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
