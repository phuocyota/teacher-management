import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { SuccessResponseInterceptor } from './common/interceptors/success-response.interceptor';
import { ResponseLoggerInterceptor } from './common/interceptors/response-logger.interceptor';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
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
    .addTag('Upload', 'File upload endpoints')
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

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://160.250.132.143:5173',
      'https://fe.kidostudent.kidoedu.vn/',
      'https://kidostudent.kidoedu.vn/',
      'http://localhost:5174',
      'http://160.250.132.143:5174',
      'https://fe.kidocanteen.kidoedu.vn/',
      'http://localhost:5171',
      'https://fe.parent.kidocanteen.kidoedu.vn',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  app.useGlobalInterceptors(new ResponseLoggerInterceptor());
  app.useGlobalInterceptors(new SuccessResponseInterceptor());

  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
bootstrap();
