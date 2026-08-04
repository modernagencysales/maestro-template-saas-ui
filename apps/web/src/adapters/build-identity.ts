declare const __MAESTRO_WEB_SOURCE_SHA__: string;

const compiledSourceSha =
  typeof __MAESTRO_WEB_SOURCE_SHA__ === "string"
    ? __MAESTRO_WEB_SOURCE_SHA__
    : "unbuilt";

export type WebBuildIdentity = {
  readonly sourceSha: string;
};

export const getWebBuildIdentity = (): WebBuildIdentity => ({
  sourceSha: compiledSourceSha,
});
