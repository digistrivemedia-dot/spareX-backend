import { Global, Injectable, Logger, Module } from '@nestjs/common';

/** Sends one text message to an E.164 number. A real provider (MSG91, B-02) is added behind this later. */
export abstract class SmsSender {
  abstract send(phone: string, message: string): Promise<void>;
}

/** Local development: the message, including any code, goes to the log instead of a phone. */
@Injectable()
export class ConsoleSmsSender extends SmsSender {
  private readonly logger = new Logger('SMS');

  send(phone: string, message: string): Promise<void> {
    this.logger.log(`To ${phone}: ${message}`);
    return Promise.resolve();
  }
}

@Global()
@Module({
  // SMS_PROVIDER only allows "console" until B-02 is answered, so there is nothing to choose between yet.
  providers: [{ provide: SmsSender, useClass: ConsoleSmsSender }],
  exports: [SmsSender],
})
export class SmsModule {}
