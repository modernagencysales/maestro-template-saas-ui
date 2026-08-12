import * as z from "zod";
import { Meta } from "@storybook/react-vite";

import { Form, useAppForm } from "../form";
import { Editor } from "./";

export default {
  title: "Components/Editor",
  component: Editor,
} as Meta;

export const Default = {
  args: {},
};

const schema = z.object({
  title: z.string().min(4),
  editor: z.string().min(4),
});

export const Field = {
  render: () => {
    const form = useAppForm({
      defaultValues: { title: "", editor: "" },
      validators: { onBlur: schema, onSubmit: schema },
      onSubmit: async () => null,
    });

    return (
      <Form form={form}>
        <form.Layout>
          <form.AppField name="title">
            {(field) => <field.TextField label="Title" />}
          </form.AppField>
          <form.AppField name="editor">
            {(field) => <field.EditorField label="Editor" />}
          </form.AppField>
          <form.SubmitButton>Submit</form.SubmitButton>
        </form.Layout>
      </Form>
    );
  },
};
