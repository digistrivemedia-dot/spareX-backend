import { Global, Injectable, Logger, Module } from '@nestjs/common';

import { AppConfig } from '../../config/app-config.service';

export type Email = { to: string; subject: string; text: string };

/** Sends one plain-text email. A real provider (Amazon SES, B-03) is added behind this later. */
export abstract class EmailSender {
  abstract send(email: Email): Promise<void>;
}

/** Local development: the email goes to the log instead of an inbox. */
@Injectable()
export class ConsoleEmailSender extends EmailSender {
  private readonly logger = new Logger('Email');

  constructor(private readonly config: AppConfig) {
    super();
  }

  send({ to, subject, text }: Email): Promise<void> {
    this.logger.log(`From ${this.config.get('EMAIL_FROM')} to ${to}: ${subject}\n${text}`);
    return Promise.resolve();
  }
}

@Global()
@Module({
  // EMAIL_PROVIDER only allows "console" until B-03 is answered, so there is nothing to choose between yet.
  providers: [{ provide: EmailSender, useClass: ConsoleEmailSender }],
  exports: [EmailSender],
})
export class EmailModule {}
