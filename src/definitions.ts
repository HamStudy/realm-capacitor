declare module "@capacitor/core" {
  interface PluginRegistry {
    RealmAdapter: RealmAdapterPlugin;
  }
}

export interface RealmAdapterPlugin {
  echo(options: { value: string }): Promise<{value: string}>;
}
