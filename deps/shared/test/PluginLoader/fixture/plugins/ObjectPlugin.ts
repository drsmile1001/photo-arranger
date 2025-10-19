import { definePlugin } from "~shared/PluginLoader";
import { ok } from "~shared/utils/Result";

import type { PluginTestServiceMap } from "./PluginTestServiceMap";

export default definePlugin<PluginTestServiceMap>({
  name: "object-plugin",
  init: (_logger, serviceMap) => {
    const callBack = serviceMap.Callback;
    callBack("Object plugin initialized");
    return ok();
  },
});
