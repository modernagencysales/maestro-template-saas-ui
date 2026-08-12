import * as z from "zod";
import { Meta } from "@storybook/react-vite";

import { Form, useAppForm } from "../form";
import { ConfirmPasswordField } from "./";

export default {
  title: "Components/ConfirmPasswordField",
  component: ConfirmPasswordField,
} as Meta;

const schema = z.object({
  password: z.string().min(4),
  confirmPassword: z.string().min(4),
});

export const Default = {
  render: () => {
    const form = useAppForm({
      defaultValues: { password: "", confirmPassword: "" },
      validators: { onBlur: schema, onSubmit: schema },
      onSubmit: async () => null,
    });

    return (
      <Form form={form}>
        <form.Layout>
          <form.AppField name="password">
            {(field) => <field.TextField type="password" label="Password" />}
          </form.AppField>
          <ConfirmPasswordField form={form} />
          <form.SubmitButton>Submit</form.SubmitButton>
        </form.Layout>
      </Form>
    );
  },
};
