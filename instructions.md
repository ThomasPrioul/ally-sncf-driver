The package has been configured successfully!

Make sure to first define the mapping inside the `contracts/ally.ts` file as follows.

```ts
import { SncfDriverContract, SncfDriverConfig } from 'ally-sncf-driver/build/standalone'

declare module '@ioc:Adonis/Addons/Ally' {
  interface SocialProviders {
    // ... other mappings
    sncf: {
      config: SncfDriverConfig
      implementation: SncfDriverContract
    }
  }
}
```
