import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { SuccessResponseInterceptor } from './common/interceptors/success-response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Teacher Management API')
    .setDescription('API for managing teachers and lectures')
    .setVersion('1.0')
    .addTag('Teacher', 'Teacher management endpoints')
    .addTag('Lecture', 'Lecture management endpoints')
    .addTag('User', 'User management endpoints')
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Device', 'Device management endpoints')
    .addTag('License', 'License management endpoints')
    .addTag('Course', 'Course management endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Nhập JWT token',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  app.useGlobalInterceptors(new SuccessResponseInterceptor());

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
