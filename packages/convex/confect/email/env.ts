import * as Config from "effect/Config";
import * as Option from "effect/Option";

const optionalEmailEnv = (name: string) =>
  Config.string(name).pipe(Config.option, Config.map(Option.getOrUndefined));

export const loadEmailEnvConfig = Config.all({
  POSTMARK_SERVER_TOKEN: optionalEmailEnv("POSTMARK_SERVER_TOKEN"),
  EMAIL_TRANSACTIONAL_FROM: optionalEmailEnv("EMAIL_TRANSACTIONAL_FROM"),
  EMAIL_MARKETING_FROM: optionalEmailEnv("EMAIL_MARKETING_FROM"),
  EMAIL_REPLY_TO: optionalEmailEnv("EMAIL_REPLY_TO"),
  EMAIL_UNSUBSCRIBE_SECRET: optionalEmailEnv("EMAIL_UNSUBSCRIBE_SECRET"),
});

export const readEmailHttpEnv = () => ({
  POSTMARK_WEBHOOK_USERNAME: process.env.POSTMARK_WEBHOOK_USERNAME,
  POSTMARK_WEBHOOK_PASSWORD: process.env.POSTMARK_WEBHOOK_PASSWORD,
  EMAIL_UNSUBSCRIBE_SECRET: process.env.EMAIL_UNSUBSCRIBE_SECRET,
});
