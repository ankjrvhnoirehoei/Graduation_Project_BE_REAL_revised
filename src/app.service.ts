import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(@InjectConnection() private readonly connection: Connection) {}

 onModuleInit() {
    if (this.connection.readyState === 1) {
      console.log('✅ MongoDB connected successfully!');
    } else {
      console.log('❌ MongoDB not connected. State:', this.connection.readyState);
    }
  }

  getHello(): string {
    return 'Hello World!';
  }
}
