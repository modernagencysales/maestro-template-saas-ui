import * as React from "react";

import { Editor, type EditorProps } from "../../editor/editor";
import { useFieldContext } from "../form-context";
import { getErrorText } from "../utils";
import { FieldRoot } from "./field-root";
import type { BaseFieldProps } from "./types";

export interface EditorFieldProps
  extends
    BaseFieldProps,
    Omit<
      EditorProps,
      "value" | "defaultValue" | "onChange" | keyof BaseFieldProps
    > {}

/**
 * Rich-text (TipTap) field. Wraps the controlled `Editor` component and binds
 * its HTML value to the form field.
 */
export const EditorField = React.forwardRef<HTMLDivElement, EditorFieldProps>(
  function EditorField(props, ref) {
    const { label, help, orientation, required, rootProps, ...editorProps } =
      props;

    const field = useFieldContext<string>();
    const errorText = getErrorText(field.state.meta.errors);
    const invalid = field.state.meta.isTouched && !!errorText;

    return (
      <FieldRoot
        label={label}
        help={help}
        orientation={orientation}
        required={required}
        rootProps={rootProps}
        invalid={invalid}
        errorText={errorText}
      >
        <Editor
          ref={ref}
          value={field.state.value ?? ""}
          onChange={(html) => field.handleChange(html)}
          onBlur={() => field.handleBlur()}
          {...editorProps}
        />
      </FieldRoot>
    );
  },
);
