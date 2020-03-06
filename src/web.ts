import { WebPlugin } from '@capacitor/core';
import { RealmAdapterPlugin } from './definitions';

export class RealmAdapterWeb extends WebPlugin implements RealmAdapterPlugin {
  constructor() {
    super({
      name: 'RealmAdapter',
      platforms: ['web']
    });
  }

  async command(options: { msg: string, cmd: string }): Promise<{result: string}> {
    console.log('command:', options);
    return {result: JSON.stringify(options)};
  }
}

const RealmAdapter = new RealmAdapterWeb();

export { RealmAdapter };

import { registerWebPlugin } from '@capacitor/core';
registerWebPlugin(RealmAdapter);
