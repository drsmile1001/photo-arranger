import { Type as t } from "@sinclair/typebox";

import type { Logger } from "~shared/Logger";
import type { EmptyMap, ServiceMap } from "~shared/ServiceMap";
import { type Result } from "~shared/utils/Result";
import type { MaybePromise } from "~shared/utils/TypeHelper";

export type Plugin<TServiceMap extends ServiceMap = EmptyMap> = {
  name: string;
  init: (
    logger: Logger,
    serviceMap: TServiceMap
  ) => MaybePromise<Result<void, "SKIP" | "ERROR">>;
  dispose?: () => MaybePromise<void>;
};

export function definePlugin<TServiceMap extends ServiceMap = EmptyMap>(
  plugin: Plugin<TServiceMap>
): Plugin<TServiceMap> {
  return plugin;
}

export const pluginSchema = t.Object({
  name: t.String(),
  init: t.Function([t.Optional(t.Any()), t.Optional(t.Any())], t.Any()),
  dispose: t.Optional(t.Function([], t.Any())),
});
