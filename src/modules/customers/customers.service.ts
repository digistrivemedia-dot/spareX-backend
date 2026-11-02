import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { HydratedDocument, Model } from 'mongoose';

import { newId } from '../../common/database/base-schema';
import { AppError, ErrorCode } from '../../common/errors/app-error';
import { Customer, type CustomerAddress, MAX_ADDRESSES } from './customers.schema';
import {
  B2cAddressView,
  type B2cAddressInputDto,
  B2cUserView,
  type UpdateB2cProfileDto,
} from './dto/b2c-customer.dto';

const ADDRESS_NOT_FOUND = 'We could not find that address.';

/** Exactly one address is the default whenever there are any; checkout pre-selects it. */
function settleDefault(addresses: CustomerAddress[], changedId: string, wantsDefault: boolean) {
  if (wantsDefault) {
    for (const address of addresses) address.isDefault = address._id === changedId;
  }
  if (addresses.length > 0 && !addresses.some((address) => address.isDefault)) {
    addresses[0].isDefault = true;
  }
}

function toAddress(id: string, input: B2cAddressInputDto): CustomerAddress {
  return {
    _id: id,
    label: input.label,
    name: input.name,
    phone: `+91${input.mobile}`,
    line1: input.line1,
    area: input.area,
    city: input.city,
    state: input.state,
    pincode: input.pin,
    isDefault: input.isDefault,
  };
}

function sortedViews(addresses: CustomerAddress[]): B2cAddressView[] {
  return addresses
    .map((address) => B2cAddressView.from(address))
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
}

@Injectable()
export class CustomersService {
  constructor(@InjectModel(Customer.name) private readonly customers: Model<Customer>) {}

  /** The customer with this E.164 number (any status), or null. */
  findByPhone(phone: string): Promise<Customer | null> {
    return this.customers.findOne({ phone }).lean<Customer>();
  }

  /** The customer with this id (any status), or null. */
  findById(id: string): Promise<Customer | null> {
    return this.customers.findById(id).lean<Customer>();
  }

  /** Creates the account the first time a number signs in. */
  async createWithPhone(phone: string, name: string): Promise<Customer> {
    const customer = await this.customers.create({ phone, name });
    return customer.toObject();
  }

  /** Changes the customer's own name, email and GSTIN. */
  async updateProfile(id: string, input: UpdateB2cProfileDto): Promise<B2cUserView> {
    const customer = await this.customers
      .findByIdAndUpdate(id, { $set: input }, { returnDocument: 'after', runValidators: true })
      .lean<Customer>();
    if (!customer) throw AppError.notFound();
    return B2cUserView.from(customer);
  }

  /** The customer's saved addresses, the default first. */
  async listAddresses(customerId: string): Promise<B2cAddressView[]> {
    const customer = await this.loadOwn(customerId);
    return sortedViews(customer.addresses);
  }

  /** One of the customer's own addresses; anyone else's is "not found". */
  async getAddress(customerId: string, addressId: string): Promise<B2cAddressView> {
    const customer = await this.loadOwn(customerId);
    return B2cAddressView.from(this.findAddress(customer, addressId));
  }

  /** Adds an address. Making it the default takes the default off the others. */
  async createAddress(customerId: string, input: B2cAddressInputDto): Promise<B2cAddressView> {
    const customer = await this.loadOwn(customerId);
    if (customer.addresses.length >= MAX_ADDRESSES) {
      throw new AppError(
        ErrorCode.AddressLimitReached,
        `You can save up to ${MAX_ADDRESSES} addresses. Delete one to add another.`,
      );
    }
    const address = toAddress(newId('adr'), input);
    customer.addresses.push(address);
    settleDefault(customer.addresses, address._id, input.isDefault);
    await customer.save();
    return B2cAddressView.from(this.findAddress(customer, address._id));
  }

  /** Replaces an address. */
  async updateAddress(
    customerId: string,
    addressId: string,
    input: B2cAddressInputDto,
  ): Promise<B2cAddressView> {
    const customer = await this.loadOwn(customerId);
    Object.assign(this.findAddress(customer, addressId), toAddress(addressId, input));
    settleDefault(customer.addresses, addressId, input.isDefault);
    await customer.save();
    return B2cAddressView.from(this.findAddress(customer, addressId));
  }

  /** Deletes an address. Deleting the default makes the next address the default. */
  async deleteAddress(customerId: string, addressId: string): Promise<void> {
    const customer = await this.loadOwn(customerId);
    const address = this.findAddress(customer, addressId);
    customer.addresses = customer.addresses.filter((other) => other._id !== address._id);
    settleDefault(customer.addresses, addressId, false);
    await customer.save();
  }

  /** Saving a loaded customer is safe under concurrent edits: `optimisticConcurrency` turns a lost update into 409. */
  private async loadOwn(customerId: string): Promise<HydratedDocument<Customer>> {
    const customer = await this.customers.findById(customerId);
    if (!customer) throw AppError.notFound();
    return customer;
  }

  private findAddress(customer: Customer, addressId: string): CustomerAddress {
    const address = customer.addresses.find((candidate) => candidate._id === addressId);
    if (!address) throw AppError.notFound(ADDRESS_NOT_FOUND);
    return address;
  }
}
