import * as React from "react";

import { useNavigate, useParams } from "@tanstack/react-router";

import { SegmentedControl } from "@workspace/ui/segmented-control";

import { useWorkspaceSlug } from "#features/common/hooks/use-workspace-slug";

import { contactTypes, getContactType } from "./get-contact-type";

const segments = contactTypes.map((type) => ({
  id: type.id,
  label: type.label,
}));

export const ContactTypes = () => {
  const navigate = useNavigate();

  const workspace = useWorkspaceSlug();
  const params = useParams({
    strict: false,
  });

  const type = params?.type?.toString() || "all";

  const [value, setValue] = React.useState(type);

  React.useEffect(() => {
    setValue(type);
  }, [type]);

  const setType = (id: string) => {
    const type = getContactType(id);

    if (!type) return;

    if (type.id === "all") {
      navigate({
        to: "/$workspace/contacts",
        params: {
          workspace,
        },
      });
    } else {
      navigate({
        to: "/$workspace/contacts/$type",
        params: {
          workspace,
          type: type.id,
        },
      });
    }

    setValue(type.id);
  };

  return (
    <SegmentedControl
      segments={segments}
      value={value}
      onChange={setType}
      size="xs"
    />
  );
};
