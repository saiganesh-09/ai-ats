import { Global, Module } from '@nestjs/common';
import { LocalStorageService, STORAGE } from './storage.service';

// To move to S3: implement ObjectStorage with the AWS SDK and swap this provider.
@Global()
@Module({
  providers: [{ provide: STORAGE, useClass: LocalStorageService }],
  exports: [STORAGE],
})
export class StorageModule {}
