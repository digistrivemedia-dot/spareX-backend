import { Body, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put } from '@nestjs/common';

import { type Actor, CurrentActor } from '../../common/http/auth-decorators';
import { B2cController } from '../../common/http/surfaces';
import { CustomersService } from './customers.service';
import {
  B2cAddressInputDto,
  B2cAddressView,
  B2cUserView,
  UpdateB2cProfileDto,
} from './dto/b2c-customer.dto';

/** The signed-in customer's own profile and address book. Every query is scoped to that customer. */
@B2cController('me', { tag: 'account' })
export class CustomersB2cController {
  constructor(private readonly customers: CustomersService) {}

  @Patch()
  updateProfile(
    @CurrentActor() actor: Actor,
    @Body() body: UpdateB2cProfileDto,
  ): Promise<B2cUserView> {
    return this.customers.updateProfile(actor.id, body);
  }

  /** Saved addresses, the default first. */
  @Get('addresses')
  listAddresses(@CurrentActor() actor: Actor): Promise<B2cAddressView[]> {
    return this.customers.listAddresses(actor.id);
  }

  @Get('addresses/:id')
  getAddress(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<B2cAddressView> {
    return this.customers.getAddress(actor.id, id);
  }

  /** Making an address the default takes the default off the others. */
  @Post('addresses')
  createAddress(
    @CurrentActor() actor: Actor,
    @Body() body: B2cAddressInputDto,
  ): Promise<B2cAddressView> {
    return this.customers.createAddress(actor.id, body);
  }

  @Put('addresses/:id')
  updateAddress(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: B2cAddressInputDto,
  ): Promise<B2cAddressView> {
    return this.customers.updateAddress(actor.id, id, body);
  }

  /** Deleting the default makes the next address the default. */
  @Delete('addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAddress(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<void> {
    return this.customers.deleteAddress(actor.id, id);
  }
}
