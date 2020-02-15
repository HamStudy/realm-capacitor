import { WebPlugin } from '@capacitor/core';
import { RealmAdapterPlugin } from './definitions';

export class RealmAdapterWeb extends WebPlugin implements RealmAdapterPlugin {
  constructor() {
    super({
      name: 'RealmAdapter',
      platforms: ['web']
    });
  }

  async echo(options: { value: string }): Promise<{value: string}> {
    console.log('ECHO', options);
    return options;
  }
}

const RealmAdapter = new RealmAdapterWeb();

export { RealmAdapter };

import { registerWebPlugin } from '@capacitor/core';
registerWebPlugin(RealmAdapter);
