import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // The Next.js app runs on :3000, API on :3001 — different origins,
  // so CORS headers are required. credentials:true allows the refresh cookie.
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  app.use(cookieParser());
  app.setGlobalPrefix('api');

  // Strips unknown fields and auto-validates DTOs via class-validator —
  // the backend equivalent of Zod on the frontend.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
