import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CustomersB2cController } from './b2c.controller';
import { Customer, CustomerSchema } from './customers.schema';
import { CustomersService } from './customers.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Customer.name, schema: CustomerSchema }])],
  controllers: [CustomersB2cController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
