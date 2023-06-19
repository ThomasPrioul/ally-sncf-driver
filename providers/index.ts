import type { ApplicationContract } from '@ioc:Adonis/Core/Application'

export default class SNCFProvider {
  constructor(protected app: ApplicationContract) {}

  public async boot() {
    const Ally = this.app.container.resolveBinding('Adonis/Addons/Ally')
    const { SncfDriverContract } = await import('../src/SNCF')

    Ally.extend('sncf', (_, __, config, ctx) => {
      return new SncfDriverContract(ctx, config)
    })
  }
}
