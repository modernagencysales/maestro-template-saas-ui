import { Badge } from "@chakra-ui/react";
import { Tag, type TagProps } from "@saas-ui/react";

import { useTags } from "../../common/hooks/use-tags";

export const ContactTag: React.FC<TagProps & { tag: string }> = (props) => {
  const { tag, ...rest } = props;

  const tags = useTags();

  const t = tags.find((t) => t.id === tag);

  if (!t) return null;

  return (
    <Tag size="sm" colorPalette="gray" height="6" {...rest}>
      <Badge bg={t.color ?? undefined} boxSize="2" rounded="full" me="2" />
      {t.name}
    </Tag>
  );
};
