import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { SuccessResponseInterceptor } from './common/interceptors/success-response.interceptor';
import { ResponseLoggerInterceptor } from './common/interceptors/response-logger.interceptor';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';

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
      'https://localhost:5173',
      'http://160.250.132.143:5173',
      'https://fe.kidostudent.kidoedu.vn',
      'https://kidostudent.kidoedu.vn',
      'http://localhost:5174',
      'http://160.250.132.143:5174',
      'https://fe.kidocanteen.kidoedu.vn',
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

  const LOCAL_UPLOADS = '/var/www/teacher-management/uploads';

  const NAS_UPLOADS = '/mnt/nas-var/teacher-management/uploads';

  app.use('/uploads', (req, res, next) => {
    const relativePath = decodeURIComponent(req.path).replace(/^\/+/, '');

    const localFile = path.resolve(LOCAL_UPLOADS, relativePath);
    const nasFile = path.resolve(NAS_UPLOADS, relativePath);

    // Chống ../ path traversal
    if (!localFile.startsWith(path.resolve(LOCAL_UPLOADS) + path.sep)) {
      return res.status(403).send('Forbidden');
    }

    if (!nasFile.startsWith(path.resolve(NAS_UPLOADS) + path.sep)) {
      return res.status(403).send('Forbidden');
    }

    // Ưu tiên LOCAL
    if (fs.existsSync(localFile) && fs.statSync(localFile).isFile()) {
      console.log(`[UPLOAD] LOCAL: ${localFile}`);
      return res.sendFile(localFile);
    }

    // Không có local thì fallback NAS
    if (fs.existsSync(nasFile) && fs.statSync(nasFile).isFile()) {
      console.log(`[UPLOAD] NAS: ${nasFile}`);
      return res.sendFile(nasFile);
    }

    console.log(`[UPLOAD] NOT FOUND: ${relativePath}`);

    return res.status(404).json({
      statusCode: 404,
      message: 'File not found',
    });
  });

  const port = process.env.PORT ?? 3001;

  await app.listen(port, '0.0.0.0');

  console.log(`Server running on port ${port}`);
}

bootstrap();
