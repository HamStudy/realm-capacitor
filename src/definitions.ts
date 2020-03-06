declare module "@capacitor/core" {
  interface PluginRegistry {
    RealmAdapter: RealmAdapterPlugin;
  }
}

export interface RealmAdapterPlugin {
    command(options: { msg: string, cmd: string }): Promise<{result: string}>;
}
