/**
 * frontend-route-server-boundary — TanStack Start routes stay declarative.
 * Server handlers are limited to the three WorkOS AuthKit auth routes;
 * loaders are limited to root and app-layout routes. Receipt-managed Starter
 * routes retain their pinned upstream composition.
 *
 * If a new top-level layout route needs a loader, add its exact path to
 * LOADER_ROUTES under review.
 */
const SERVER_HANDLER_ROUTES = new Set([
  "apps/web/src/routes/api/auth/callback.tsx",
  "apps/web/src/routes/api/auth/sign-in.tsx",
  "apps/web/src/routes/api/auth/sign-up.tsx",
]);
const LOADER_ROUTES = new Set([
  "apps/web/src/routes/__root.tsx",
  "apps/web/src/routes/_app.tsx",
]);
const ROUTE_HELPERS = new Map([
  ["handleCallbackRoute", "apps/web/src/routes/api/auth/callback.tsx"],
  ["getSignInUrl", "apps/web/src/routes/api/auth/sign-in.tsx"],
  ["getSignUpUrl", "apps/web/src/routes/api/auth/sign-up.tsx"],
]);

function isFile(filename, suffix) {
  return filename.endsWith(suffix);
}

function isOneOfFiles(filename, suffixes) {
  return suffixes.some((suffix) => isFile(filename, suffix));
}

function isRouteModule(filename) {
  return /apps\/web\/src\/routes\/.*\.(ts|tsx)$/.test(filename);
}

function propertyName(node) {
  if (node.type === "Identifier") return node.name;
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  return null;
}

function isRouteObjectProperty(node) {
  return (
    node.parent?.type === "ObjectExpression" &&
    node.parent.parent?.type === "CallExpression"
  );
}

function reportIfNotExactRoute(context, filename, node, helperName) {
  const allowedFile = ROUTE_HELPERS.get(helperName);
  if (allowedFile && !isFile(filename, allowedFile)) {
    context.report({
      node,
      messageId: "helper",
      data: { name: helperName, allowedFile },
    });
  }
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Restrict TanStack Start route server handlers and loaders",
    },
    schema: [
      {
        type: "object",
        properties: { receiptPath: { type: "string" } },
        additionalProperties: false,
      },
    ],
    messages: {
      server:
        "Only callback/sign-in/sign-up Start routes may define `server.handlers`; move server behavior to an adapter or approved auth route.",
      loader:
        "Only root/workspace-layout Start routes may define `loader`; feature data loading belongs in adapters/components.",
      helper:
        "`{{name}}` is pinned to `{{allowedFile}}`; do not use this WorkOS route helper in other routes.",
    },
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename()).replace(
      /\\/g,
      "/",
    );
    if (
      !isRouteModule(filename) ||
      isSaasUiStarterReceiptFile(filename, receiptOption(context))
    ) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        if (
          String(node.source.value) !== "@workos/authkit-tanstack-react-start"
        ) {
          return;
        }
        for (const specifier of node.specifiers) {
          const imported =
            specifier.type === "ImportSpecifier" &&
            specifier.imported.type === "Identifier"
              ? specifier.imported.name
              : specifier.local.name;
          reportIfNotExactRoute(context, filename, specifier, imported);
        }
      },
      Property(node) {
        const name = propertyName(node.key);
        if (
          name === "server" &&
          !isOneOfFiles(filename, [...SERVER_HANDLER_ROUTES])
        ) {
          context.report({ node: node.key, messageId: "server" });
        }
        if (
          name === "loader" &&
          isRouteObjectProperty(node) &&
          !isOneOfFiles(filename, [...LOADER_ROUTES])
        ) {
          context.report({ node: node.key, messageId: "loader" });
        }
      },
    };
  },
};
import {
  isSaasUiStarterReceiptFile,
  receiptOption,
} from "../saas-ui-registry-receipt.mjs";
