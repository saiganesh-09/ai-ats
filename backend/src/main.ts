import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // The Next.js app runs on :3000, API on :3001 — different origins,
  // so CORS headers are required. credentials:true allows the refresh cookie.
  // Security headers (X-Frame-Options, CSP basics, nosniff…) — standard for production.
  app.use(helmet());
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
  // Uniform error envelope: { success:false, error:{code,message} } — no stacks.
  app.useGlobalFilters(new HttpExceptionFilter());

  // Interactive OpenAPI docs at /api/docs — "Try it out" works end-to-end:
  // register/login pastes a Bearer token into the Authorize lock.
  const spec = new DocumentBuilder()
    .setTitle('AI ATS API')
    .setDescription(
      'Multi-tenant applicant tracking system. All responses use the uniform ' +
      'envelope — errors: {success:false, error:{code,message}}.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, () =>
    SwaggerModule.createDocument(app, spec),
  );

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
